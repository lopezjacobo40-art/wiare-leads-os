import { google } from 'googleapis'

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

// 30 columnas A–Z + AA–AD
const HEADER = [
  'ID',                        // A
  'Fecha extracción',          // B
  'Nombre negocio',            // C
  'Sector',                    // D
  'Ciudad',                    // E
  'Dirección',                 // F
  'Teléfono',                  // G
  'Email',                     // H
  'Email verificado',          // I
  'Web',                       // J
  'Google Maps',               // K
  'Valoración',                // L
  'Nº Reseñas',                // M
  'Score IA',                  // N
  'Nivel',                     // O
  'Motivo score',              // P
  'Volumen llamadas',          // Q
  'Fase actual',               // R
  'MRR estimado (€/mes)',      // S
  'Setup',                     // T
  'Agent ID Retell',           // U
  'Demo creada',               // V
  'Propuesta generada',        // W
  'Email enviado',             // X
  'Fuente',                    // Y
  'Última actualización',      // Z
  'Asunto email outreach',     // AA
  'Cuerpo email outreach',     // AB
  'Firmante outreach',         // AC
  'Fecha outreach',            // AD
]

const FASE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  cualificado: 'Cualificado',
  demo_creada: 'Demo creada',
  propuesta_creada: 'Propuesta creada',
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
}

function nivelDe(score: number | null): string {
  if (score == null) return 'Sin cualificar'
  if (score >= 9) return 'Top'
  if (score >= 7) return 'Caliente'
  if (score >= 4) return 'Templado'
  return 'Frío'
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES')
  } catch {
    return ''
  }
}

function colorScore(score: number | null): { red: number; green: number; blue: number } {
  if (score == null) return { red: 1, green: 1, blue: 1 }
  if (score >= 9) return { red: 0.93, green: 0.93, blue: 1 }
  if (score >= 7) return { red: 0.9, green: 0.97, blue: 0.91 }
  if (score >= 4) return { red: 1, green: 0.95, blue: 0.86 }
  return { red: 1, green: 0.9, blue: 0.9 }
}

// 26 columnas A–Z (índices 0–25)
function leadToRow(lead: LeadDTO): unknown[] {
  const maps = lead.google_maps_url
    ? `=HYPERLINK("${lead.google_maps_url}";"Ver mapa")`
    : ''
  const agent = lead.agent_id_retell
    ? `=HYPERLINK("https://app.retellai.com/agents/${lead.agent_id_retell}";"${lead.agent_id_retell}")`
    : ''
  return [
    lead.id,                                              // A
    fechaCorta(lead.created_at),                          // B
    lead.nombre ?? '',                                    // C
    lead.sector ?? '',                                    // D
    lead.ciudad ?? '',                                    // E
    lead.direccion ?? '',                                 // F
    lead.telefono ?? '',                                  // G
    lead.email ?? '',                                     // H
    lead.email_verificado ? 'Sí' : 'No',                 // I
    lead.web ?? '',                                       // J
    maps,                                                 // K
    lead.valoracion ?? '',                                // L
    lead.num_resenas ?? '',                               // M
    lead.score_cualificacion ?? '',                       // N
    nivelDe(lead.score_cualificacion),                    // O
    lead.motivo_score ?? '',                              // P
    lead.volumen_llamadas ?? '',                          // Q
    FASE_LABELS[lead.fase] ?? lead.fase ?? '',            // R
    lead.mrr_estimado ?? '',                              // S
    '790€',                                               // T
    agent,                                                // U
    lead.agent_id_retell ? 'Sí' : 'No',                  // V
    lead.propuesta_md ? 'Sí' : 'No',                     // W
    'No',                                                 // X email enviado (se rellena desde outreach_os en futuras versiones)
    lead.fuente ?? '',                                    // Y
    new Date().toLocaleString('es-ES'),                   // Z
    lead.outreach_asunto ?? '',                            // AA asunto outreach
    lead.outreach_cuerpo ?? '',                            // AB cuerpo outreach
    '',                                                   // AC firmante outreach
    '',                                                   // AD fecha outreach
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
        range: `A${rowIndex}:AD${rowIndex}`,
        values: [leadToRow(lead)],
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
        range: 'A:AD',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: toAppend.map(leadToRow) },
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
      // Auto-resize columnas A–AD (0–29)
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 30 },
        },
      },
    ]

    // Color score (columna N = índice 13) para todas las filas de leads
    // Solo formateamos las filas modificadas/añadidas para no sobreescribir ediciones manuales del resto
    const leadsConIndice = [
      ...toUpdate.map(({ rowIndex, lead }) => ({ rowIndex, lead })),
      ...toAppend.map((lead, i) => ({ rowIndex: existingIds.length + i, lead })),
    ]

    leadsConIndice.forEach(({ rowIndex, lead }) => {
      const ri = rowIndex - 1 // 0-indexed para la API
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 13, endColumnIndex: 14 },
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
