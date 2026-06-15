export interface EmailResult {
  email: string | null
  fuente: 'web_scraping' | 'patron_dominio' | 'maps_descripcion' | 'no_encontrado'
  verificado: boolean
}

/* Llama a la Vercel Function /api/find-email.
   Solo funciona en producción. En dev devuelve no_encontrado. */
export async function buscarEmail(params: {
  web?: string | null
  nombre?: string | null
  descripcion?: string | null
}): Promise<EmailResult> {
  try {
    const res = await fetch('/api/find-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as EmailResult
  } catch {
    return { email: null, fuente: 'no_encontrado', verificado: false }
  }
}

export function labelFuente(fuente: EmailResult['fuente']): string {
  switch (fuente) {
    case 'web_scraping':    return 'Extraído de la web'
    case 'patron_dominio':  return 'Patrón de dominio'
    case 'maps_descripcion': return 'Descripción Maps'
    default:                return 'No encontrado'
  }
}
