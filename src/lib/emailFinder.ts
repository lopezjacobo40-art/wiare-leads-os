// Etiqueta legible para la fuente de un email (cómo se obtuvo).
// La fuente se guarda en leads_os.email_fuente como texto libre, así que
// esta función acepta cualquier string y cubre los valores conocidos.
const LABELS: Record<string, string> = {
  apify_maps: 'De Google Maps',
  apify_web: 'Extraído de la web',
  apify_contact: 'Scraper de contacto',
  apify_extractor: 'Extractor de emails',
  sin_email: 'Sin email real',
  manual: 'Añadido manualmente',
  // valores heredados de versiones anteriores
  apify: 'Extraído con Apify',
  web_scraping: 'Extraído de la web',
  patron: 'Patrón de dominio',
  patron_dominio: 'Patrón de dominio',
  maps_descripcion: 'Descripción Maps',
}

export function labelFuente(fuente: string | null | undefined): string {
  if (!fuente) return 'Sin fuente'
  return LABELS[fuente] ?? fuente
}
