import { google } from 'googleapis'

/* ─────────────────────────────────────────────
   API route serverless (Vercel Function, Node)
   Exporta los leads a un Google Sheet maestro único:
   - Si existe un sheet cuyo nombre empieza por "WIARE Leads OS" → lo reutiliza.
   - Si no → crea uno nuevo "WIARE Leads OS — [fecha]".
   - Limpia las filas previas (deja el header), reinserta los leads, aplica formato.
   Devuelve { url } del sheet.

   Requiere en env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
   GOOGLE_SHEET_ID es opcional (acelera al saltarse la búsqueda en Drive).
   ───────────────────────────────────────────── */

const SHEET_BASENAME = 'WIARE Leads OS'

const HEADER = [
  'ID', 'Fecha extracción', 'Nombre negocio', 'Sector', 'Ciudad', 'Dirección',
  'Teléfono', 'Web', 'Google Maps', 'Valoración', 'Nº Reseñas', 'Score IA',
  'Nivel', 'Motivo score', 'Volumen llamadas', 'Fase actual', 'MRR estimado (€/mes)',
  'Setup', 'Agent ID Retell', 'Demo creada', 'Propuesta generada',
  'Emails outreach generados', 'Notas', 'Última actualización',
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

// Devuelve color de fondo para la celda de score (RGB 0..1) según el valor.
function colorScore(score: number | null): { red: number; green: number; blue: number } {
  if (score == null) return { red: 1, green: 1, blue: 1 }
  if (score >= 9) return { red: 0.93, green: 0.93, blue: 1 } // indigo claro
  if (score >= 7) return { red: 0.9, green: 0.97, blue: 0.91 } // verde claro
  if (score >= 4) return { red: 1, green: 0.95, blue: 0.86 } // naranja claro
  return { red: 1, green: 0.9, blue: 0.9 } // rojo claro
}

// Convierte un lead a la fila de 24 columnas. Las columnas con link usan fórmula HYPERLINK.
function leadToRow(lead: LeadDTO): unknown[] {
  const maps = lead.google_maps_url
    ? `=HYPERLINK("${lead.google_maps_url}";"Ver mapa")`
    : ''
  const agent = lead.agent_id_retell
    ? `=HYPERLINK("https://app.retellai.com/agents/${lead.agent_id_retell}";"${lead.agent_id_retell}")`
    : ''
  return [
    lead.id,
    fechaCorta(lead.created_at),
    lead.nombre ?? '',
    lead.sector ?? '',
    lead.ciudad ?? '',
    lead.direccion ?? '',
    lead.telefono ?? '',
    lead.web ?? '',
    maps,
    lead.valoracion ?? '',
    lead.num_resenas ?? '',
    lead.score_cualificacion ?? '',
    nivelDe(lead.score_cualificacion),
    lead.motivo_score ?? '',
    lead.volumen_llamadas ?? '',
    FASE_LABELS[lead.fase] ?? lead.fase ?? '',
    lead.mrr_estimado ?? '',
    '790€',
    agent,
    lead.agent_id_retell ? 'Sí' : 'No',
    lead.propuesta_md ? 'Sí' : 'No',
    'No', // emails outreach: no existe en el modelo actual
    lead.notas ?? '',
    new Date().toLocaleString('es-ES'),
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

// Busca un sheet existente cuyo nombre empiece por SHEET_BASENAME.
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

    // 1) Crear el sheet si no existe
    if (!spreadsheetId) {
      const titulo = `${SHEET_BASENAME} — ${new Date().toLocaleDateString('es-ES')}`
      const creado = await sheets.spreadsheets.create({
        requestBody: { properties: { title: titulo } },
      })
      spreadsheetId = creado.data.spreadsheetId!
    }

    // 2) Obtener el sheetId (pestaña) y limpiar todo el contenido
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const firstSheet = meta.data.sheets?.[0]
    const sheetId = firstSheet?.properties?.sheetId ?? 0

    await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'A:X' })

    // 3) Escribir header + filas
    const rows = [HEADER, ...leads.map(leadToRow)]
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    })

    // 4) Formato vía batchUpdate
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
      // Auto-resize de columnas A..X (0..23)
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 24 },
        },
      },
    ]

    // Filas pares: fondo #F4F4F5 (alternancia visible). Col Score (índice 11) con color semántico.
    leads.forEach((lead, i) => {
      const rowIndex = i + 1 // +1 por el header
      if (i % 2 === 1) {
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 24 },
            cell: { userEnteredFormat: { backgroundColor: { red: 0.957, green: 0.957, blue: 0.961 } } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        })
      }
      // Columna Score (L = índice 11) con color según valor
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 11, endColumnIndex: 12 },
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
    return res.status(200).json({ url, count: leads.length })
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
