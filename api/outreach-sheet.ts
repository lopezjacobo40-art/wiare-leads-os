import { google } from 'googleapis'

/* ─────────────────────────────────────────────
   Endpoint: POST /api/outreach-sheet
   Escribe el email de outreach generado en las columnas AA–AD
   de la fila del lead correspondiente en el Sheet maestro.

   Body: { lead_id, asunto, cuerpo, vendedor }
   Requiere: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
   ───────────────────────────────────────────── */

const SHEET_BASENAME = 'WIARE Leads OS'

function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Faltan credenciales de Google.')
  }
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })
  return oauth2
}

async function getSpreadsheetId(auth: ReturnType<typeof getAuth>): Promise<string> {
  if (process.env.GOOGLE_SHEET_ID) return process.env.GOOGLE_SHEET_ID
  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${SHEET_BASENAME}' and trashed=false`,
    fields: 'files(id)',
    orderBy: 'createdTime',
    pageSize: 1,
  })
  const id = res.data.files?.[0]?.id
  if (!id) throw new Error('Sheet maestro no encontrado. Exporta primero desde la pantalla de Leads.')
  return id
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      lead_id?: string
      asunto?: string
      cuerpo?: string
      vendedor?: string
    }

    const { lead_id, asunto, cuerpo, vendedor } = body ?? {}
    if (!lead_id || !asunto || !cuerpo) {
      return res.status(400).json({ error: 'Faltan campos: lead_id, asunto, cuerpo' })
    }

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = await getSpreadsheetId(auth)

    // Leer columna A para encontrar la fila del lead
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:A',
    })
    const ids: string[] = (colA.data.values ?? []).map((r) => String(r[0] ?? ''))
    const rowIndex = ids.findIndex((id) => id === lead_id)

    if (rowIndex < 1) {
      // Lead no está en el Sheet — no bloqueamos, simplemente avisamos
      return res.status(404).json({ error: 'Lead no encontrado en el Sheet. Exporta primero desde Leads.' })
    }

    const fecha = new Date().toLocaleString('es-ES')
    // Columnas AA=26, AB=27, AC=28, AD=29 (0-indexed)
    // En notación A1: fila rowIndex+1 (1-indexed)
    const fila = rowIndex + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `AA${fila}:AD${fila}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[asunto, cuerpo, vendedor ?? 'Jacobo', fecha]],
      },
    })

    // Marcar columna X (Email enviado) como Sí
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `X${fila}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['Sí']] },
    })

    return res.status(200).json({ ok: true, fila })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error escribiendo en Sheets'
    return res.status(500).json({ error: message })
  }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}
