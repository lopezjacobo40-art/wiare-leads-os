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

// 14 columnas A–N, en orden del nuevo funnel v6.
const HEADER = [
  'ID',                        // A
  'Fecha',                     // B
  'Nombre negocio',            // C
  'Sector',                    // D
  'Ciudad',                    // E
  'Teléfono',                  // F
  'Email',                     // G
  'Web',                       // H
  'Score',                     // I
  'Fase',                      // J
  'Ahorro estimado',           // K
  'Brechas (resumen)',         // L
  'Analizado',                 // M
  'Última actualización',      // N
]

const FASE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  negocio_analizado: 'Negocio analizado',
  brechas_detectadas: 'Brechas detectadas',
  email_enviado: 'Email enviado',
}

interface LeadDTO {
  id: string
  created_at: string
  nombre: string
  sector: string
  ciudad: string | null
  telefono: string | null
  email: string | null
  web: string | null
  score_cualificacion: number | null
  fase: string
  ahorro_estimado: string | null
  resumen: string | null
  analizado_at: string | null
}

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-ES')
  } catch {
    return ''
  }
}

// Fuerza texto en celdas que Sheets interpretaría como fórmula con USER_ENTERED
// (teléfonos con '+', valores que empiezan por '=' o '-').
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

// 14 columnas A–N (índices 0–13), en orden del funnel v6.
function leadToRow(lead: LeadDTO): unknown[] {
  return [
    lead.id,                                       // A
    fechaCorta(lead.created_at),                   // B
    lead.nombre ?? '',                             // C
    lead.sector ?? '',                             // D
    lead.ciudad ?? '',                             // E
    comoTexto(lead.telefono),                      // F (texto: evita #ERROR! con '+')
    lead.email ?? '',                              // G
    lead.web ?? '',                                // H
    lead.score_cualificacion ?? '',                // I
    FASE_LABELS[lead.fase] ?? lead.fase ?? '',     // J
    lead.ahorro_estimado ?? '',                    // K
    lead.resumen ?? '',                            // L
    fechaCorta(lead.analizado_at),                 // M
    new Date().toLocaleString('es-ES'),            // N
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
    } else {
      // Sheet ya existe: reescribir solo la fila 1 (A1:N1) con el header v6.
      // No toca datos de las filas siguientes; solo actualiza las cabeceras.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1:N1',
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
        range: `A${rowIndex}:N${rowIndex}`,
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
        range: 'A:N',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: toAppend.map((lead) => leadToRow(lead)) },
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
      // Auto-resize columnas A–N (0–13)
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 14 },
        },
      },
    ]

    // Color score (columna I = índice 8) para todas las filas de leads
    // Solo formateamos las filas modificadas/añadidas para no sobreescribir ediciones manuales del resto
    const leadsConIndice = [
      ...toUpdate.map(({ rowIndex, lead }) => ({ rowIndex, lead })),
      ...toAppend.map((lead, i) => ({ rowIndex: existingIds.length + i, lead })),
    ]

    leadsConIndice.forEach(({ rowIndex, lead }) => {
      const ri = rowIndex - 1 // 0-indexed para la API
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: ri, endRowIndex: ri + 1, startColumnIndex: 8, endColumnIndex: 9 },
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
