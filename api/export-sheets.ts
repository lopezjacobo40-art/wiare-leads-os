import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

/* ─────────────────────────────────────────────
   API route serverless (Vercel Function, Node)
   Exporta los leads a un Google Sheet maestro único — modo UPSERT acumulativo:
   - Lee la columna A para construir el mapa ID → número de fila.
   - Actualiza en sitio las filas existentes (batchUpdate).
   - Añade al final las filas nuevas (append).
   - NUNCA borra filas: el sheet es una base de datos acumulativa.
   - Si el sheet no existe lo crea con header A–Z (26 columnas).
   Devuelve { url, updated, created }.

   Requiere en env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
   GOOGLE_SHEET_ID es opcional (acelera al saltarse la búsqueda en Drive).
   ───────────────────────────────────────────── */

const SHEET_BASENAME = 'WIARE Leads OS'

// 37 columnas A–AK, en orden lógico de funnel (identificación → contacto →
// reputación → scoring → funnel → económico → agente → outreach → propuesta)
const HEADER = [
  'ID',                        // A
  'Fecha creación',            // B
  'Nombre negocio',            // C
  'Sector',                    // D
  'Ciudad',                    // E
  'Dirección',                 // F
  'Teléfono',                  // G
  'Email',                     // H
  'Email verificado',          // I
  'Fuente email',              // J
  'Web',                       // K
  'Google Maps',               // L
  'Valoración',                // M
  'Nº reseñas',                // N
  'Horario',                   // O
  'Descripción',               // P
  'Score',                     // Q
  'Nivel',                     // R
  'Motivo score',              // S
  'Vol. llamadas',             // T
  'Fase',                      // U
  'Fuente lead',               // V
  'Fecha extracción',          // W
  'Tag',                       // X
  'Notas',                     // Y
  'Última actualización',      // Z
  'MRR estimado (€/mes)',      // AA
  'Setup',                     // AB
  'Pérdida mensual (€)',       // AC
  'Pérdida anual (€)',         // AD
  'Agente Retell',             // AE
  'Tiene agente',              // AF
  'Asunto email',              // AG
  'Cuerpo email',              // AH
  'Propuesta generada',        // AI
  'Tipo propuesta',            // AJ
  'Propuesta slides',          // AK
]

const FASE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  cualificado: 'Cualificado',
  demo_creada: 'Demo creada',
  propuesta_creada: 'Propuesta creada',
  email_generado: 'Email generado',
  propuesta_enviada: 'Propuesta enviada',
  cerrado: 'Cerrado',
}

interface LeadDTO {
  id: string
  created_at: string
  nombre: string
  sector: string
  ciudad: string | null
  direccion: string | null
  telefono: string | null
  web: string | null
  google_maps_url: string | null
  valoracion: number | null
  num_resenas: number | null
  score_cualificacion: number | null
  motivo_score: string | null
  volumen_llamadas: string | null
  fase: string
  mrr_estimado: number | null
  agent_id_retell: string | null
  propuesta_md: string | null
  notas: string | null
  // ── nuevos campos v5 ──
  email: string | null
  email_verificado: boolean | null
  email_fuente: string | null
  fuente: string | null
  outreach_asunto: string | null
  outreach_cuerpo: string | null
  // ── campos funnel completos ──
  horario: string[] | null
  descripcion: string | null
  perdida_mensual_real: number | null
  perdida_anual_real: number | null
  extraccion_fecha: string | null
  propuesta_slides: Record<string, unknown> | null
  propuesta_tipo: string | null
  tag: string | null
}

function nivelDe(score: number | null): string {
  if (score == null) return 'Sin cualificar'
  if (score >= 9) return 'Top'
  if (score >= 7) return 'Caliente'
  if (score >= 4) return 'Templado'
  return 'Frío'
}

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES')
  } catch {
    return ''
  }
}

// horario llega como array de strings (una entrada por día). Lo aplanamos
// a una sola celda legible; cualquier otra forma → string vacío.
function formatHorario(horario: string[] | null): string {
  if (!Array.isArray(horario) || horario.length === 0) return ''
  return horario.filter(Boolean).join(' · ')
}

// Fuerza texto en celdas que Sheets interpretaría como fórmula con USER_ENTERED
// (teléfonos con '+', valores que empiezan por '=' o '-'). El apóstrofo inicial
// le dice a Sheets "esto es texto literal" y no se muestra en la celda.
function comoTexto(valor: string | null): string {
  if (!valor) return ''
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor
}

function colorScore(score: number | null): { red: number; green: number; blue: number } {
  if (score == null) return { red: 1, green: 1, blue: 1 }
  if (score >= 9) return { red: 0.93, green: 0.93, blue: 1 }
  if (score >= 7) return { red: 0.9, green: 0.97, blue: 0.91 }
  if (score >= 4) return { red: 1, green: 0.95, blue: 0.86 }
  return { red: 1, green: 0.9, blue: 0.9 }
}

// 37 columnas A–AK (índices 0–36), en orden lógico de funnel.
// outreach trae { asunto, cuerpo } leídos directamente de Supabase para evitar
// que el DTO del frontend (que puede llegar truncado) deje las celdas vacías.
function leadToRow(
  lead: LeadDTO,
  outreach: { asunto: string; cuerpo: string },
): unknown[] {
  const maps = lead.google_maps_url
    ? `=HYPERLINK("${lead.google_maps_url}";"Ver mapa")`
    : ''
  const agent = lead.agent_id_retell
    ? `=HYPERLINK("https://app.retellai.com/agents/${lead.agent_id_retell}";"${lead.agent_id_retell}")`
    : ''
  return [
    // ── BLOQUE 1 · IDENTIFICACIÓN (A–G) ──
    lead.id,                                              // A
    fechaCorta(lead.created_at),                          // B
    lead.nombre ?? '',                                    // C
    lead.sector ?? '',                                    // D
    lead.ciudad ?? '',                                    // E
    lead.direccion ?? '',                                 // F
    comoTexto(lead.telefono),                             // G (texto: evita #ERROR! con '+')
    // ── BLOQUE 2 · CONTACTO (H–K) ──
    lead.email ?? '',                                     // H
    lead.email_verificado ? 'Sí' : 'No',                 // I
    lead.email_fuente ?? '',                              // J
    lead.web ?? '',                                       // K
    // ── BLOQUE 3 · REPUTACIÓN Y DATOS (L–P) ──
    maps,                                                 // L
    lead.valoracion ?? '',                                // M
    lead.num_resenas ?? '',                               // N
    formatHorario(lead.horario),                          // O
    lead.descripcion ?? '',                               // P
    // ── BLOQUE 4 · SCORING (Q–T) ──
    lead.score_cualificacion ?? '',                       // Q
    nivelDe(lead.score_cualificacion),                    // R
    lead.motivo_score ?? '',                              // S
    lead.volumen_llamadas ?? '',                          // T
    // ── BLOQUE 5 · FUNNEL (U–Z) ──
    FASE_LABELS[lead.fase] ?? lead.fase ?? '',            // U
    lead.fuente ?? '',                                    // V
    fechaCorta(lead.extraccion_fecha),                    // W
    lead.tag ?? '',                                       // X
    lead.notas ?? '',                                     // Y
    new Date().toLocaleString('es-ES'),                   // Z
    // ── BLOQUE 6 · ECONÓMICO (AA–AD) ──
    lead.mrr_estimado ?? '',                              // AA
    '790€',                                               // AB setup fijo
    lead.perdida_mensual_real ?? '',                      // AC
    lead.perdida_anual_real ?? '',                        // AD
    // ── BLOQUE 7 · AGENTE RETELL (AE–AF) ──
    agent,                                                // AE
    lead.agent_id_retell ? 'Sí' : 'No',                  // AF
    // ── BLOQUE 8 · OUTREACH EMAIL (AG–AH) — leído de Supabase ──
    outreach.asunto,                                      // AG
    outreach.cuerpo,                                      // AH
    // ── BLOQUE 9 · PROPUESTA (AI–AK) ──
    lead.propuesta_md ? 'Sí' : 'No',                     // AI
    lead.propuesta_tipo ?? '',                            // AJ
    lead.propuesta_slides ? 'Sí' : 'No',                 // AK
  ]
}

function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Faltan credenciales de Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN). Configúralas siguiendo GOOGLE_SETUP.md.'
    )
  }
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })
  return oauth2
}

// Lee outreach_asunto / outreach_cuerpo directamente de leads_os para los ids
// dados (RLS desactivado → la anon key basta). Una sola query .in() en vez de
// una por lead, para no degradar el endpoint con muchos leads.
// Devuelve un mapa id → { asunto, cuerpo }; si falla, mapa vacío (celdas vacías).
async function leerOutreach(ids: string[]): Promise<Record<string, { asunto: string; cuerpo: string }>> {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || ids.length === 0) return {}

  try {
    const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    const { data, error } = await supabase
      .from('leads_os')
      .select('id, outreach_asunto, outreach_cuerpo')
      .in('id', ids)

    if (error || !data) return {}

    const mapa: Record<string, { asunto: string; cuerpo: string }> = {}
    for (const row of data as { id: string; outreach_asunto: string | null; outreach_cuerpo: string | null }[]) {
      mapa[row.id] = {
        asunto: row.outreach_asunto ?? '',
        cuerpo: row.outreach_cuerpo ?? '',
      }
    }
    return mapa
  } catch {
    return {}
  }
}

async function buscarSheetExistente(auth: ReturnType<typeof getAuth>): Promise<string | null> {
  if (process.env.GOOGLE_SHEET_ID) return process.env.GOOGLE_SHEET_ID
  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${SHEET_BASENAME}' and trashed=false`,
    fields: 'files(id,name)',
    orderBy: 'createdTime',
    pageSize: 1,
  })
  return res.data.files?.[0]?.id ?? null
}

export default async function handler(req: { method?: string; body?: unknown }, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { leads?: LeadDTO[] }
    const leads = body?.leads ?? []

    // ── FIX outreach: leer asunto/cuerpo reales de Supabase por id ──
    // El DTO del frontend puede llegar sin estos campos; la fuente de verdad es leads_os.
    const outreachMap = await leerOutreach(leads.map((l) => l.id))
    const outreachDe = (id: string) => outreachMap[id] ?? { asunto: '', cuerpo: '' }

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    let spreadsheetId = await buscarSheetExistente(auth)

    // ── 1. Crear el sheet si no existe ──
    if (!spreadsheetId) {
      const titulo = `${SHEET_BASENAME} — ${new Date().toLocaleDateString('es-ES')}`
      const creado = await sheets.spreadsheets.create({
        requestBody: { properties: { title: titulo } },
      })
      spreadsheetId = creado.data.spreadsheetId!

      // Header inicial en sheet nuevo
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [HEADER] },
      })
    } else {
      // Sheet ya existe: solo escribir la cabecera si la fila 1 está vacía
      // (nunca sobreescribir datos existentes en A1).
      const fila1 = await sheets.spreadsheets.values.get({ spreadsheetId, range: '1:1' })
      const fila1Vacia = !fila1.data.values || fila1.data.values.length === 0 || (fila1.data.values[0] ?? []).every((c) => !c)
      if (fila1Vacia) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [HEADER] },
        })
      }
    }

    // ── 2. Obtener sheetId (pestaña) para batchUpdate de formato ──
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const firstSheet = meta.data.sheets?.[0]
    const sheetId = firstSheet?.properties?.sheetId ?? 0

    // ── 3. Leer columna A (IDs existentes) para construir mapa ID → rowIndex ──
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:A',
    })
    const existingIds: string[] = (colA.data.values ?? []).map((r) => String(r[0] ?? ''))
    // existingIds[0] = 'ID' (header), existingIds[1] = primer lead, etc.
    const idToRow: Record<string, number> = {}
    existingIds.forEach((id, idx) => {
      if (idx > 0 && id) idToRow[id] = idx + 1 // fila Sheets es 1-indexed, +1 por header
    })

    // ── 4. Separar leads en: actualizar existentes vs añadir nuevos ──
    const toUpdate: { rowIndex: number; lead: LeadDTO }[] = []
    const toAppend: LeadDTO[] = []

    for (const lead of leads) {
      if (idToRow[lead.id]) {
        toUpdate.push({ rowIndex: idToRow[lead.id], lead })
      } else {
        toAppend.push(lead)
      }
    }

    // ── 5. Actualizar filas existentes con batchUpdate de valores ──
    if (toUpdate.length > 0) {
      const data = toUpdate.map(({ rowIndex, lead }) => ({
        range: `A${rowIndex}:AK${rowIndex}`,
        values: [leadToRow(lead, outreachDe(lead.id))],
      }))
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      })
    }

    // ── 6. Añadir filas nuevas al final ──
    if (toAppend.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:AK',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: toAppend.map((lead) => leadToRow(lead, outreachDe(lead.id))) },
      })
    }

    // ── 7. Formato vía batchUpdate (header + freeze + auto-resize + colores) ──
    // Necesitamos saber el total de filas actuales para formatear correctamente.
    const totalRows = existingIds.length + toAppend.length // incluye header row
    const requests: unknown[] = [
      // Header: fondo #6366F1, texto blanco, negrita
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.39, green: 0.4, blue: 0.95 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
        },
      },
      // Congelar fila header
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Auto-resize columnas A–AK (0–36)
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 37 },
        },
      },
    ]

    // Color score (columna Q = índice 16) para todas las filas de leads
    // Solo formateamos las filas modificadas/añadidas para no sobreescribir ediciones manuales del resto
    const leadsConIndice = [
      ...toUpdate.map(({ rowIndex, lead }) => ({ rowIndex, lead })),
      ...toAppend.map((lead, i) => ({ rowIndex: existingIds.length + i, lead })),
    ]

    leadsConIndice.forEach(({ rowIndex, lead }) => {
      const ri = rowIndex - 1 // 0-indexed para la API
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 16, endColumnIndex: 17 },
          cell: {
            userEnteredFormat: {
              backgroundColor: colorScore(lead.score_cualificacion),
              horizontalAlignment: 'CENTER',
              textFormat: { bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
        },
      })
    })

    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    return res.status(200).json({
      url,
      total: leads.length,
      updated: toUpdate.length,
      created: toAppend.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error exportando a Google Sheets'
    return res.status(500).json({ error: message })
  }
}

// Tipo mínimo de la respuesta de Vercel para no depender de @vercel/node.
interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}
