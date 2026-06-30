// Google Places API (New) v1 — soporta CORS desde navegador, a diferencia del endpoint legacy.
const KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
import { fetchWithAudit } from './apiAuditor'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.editorialSummary',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

interface PlaceResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  editorialSummary?: { text: string }
  googleMapsUri?: string
}

export interface LeadExtraido {
  nombre: string
  sector: string
  direccion: string | null
  ciudad: string
  telefono: string | null
  web: string | null
  google_maps_url: string | null
  google_place_id: string
  valoracion: number | null
  num_resenas: number | null
  horario: string[] | null
  descripcion: string | null
  fase: string
}

export async function extraerLeads(
  sector: string,
  ciudad: string,
  cantidad: number,
  onProgress?: (lead: LeadExtraido, index: number, total: number) => void
): Promise<LeadExtraido[]> {
  const leads: LeadExtraido[] = []
  let pageToken: string | undefined

  while (leads.length < cantidad) {
    const body: Record<string, unknown> = {
      textQuery: `${sector} en ${ciudad}`,
      languageCode: 'es',
      regionCode: 'ES',
      pageSize: 20,
    }
    if (pageToken) body.pageToken = pageToken

    const res = await fetchWithAudit('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      service: 'GooglePlaces',
      retries: 3,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google Places error ${res.status}: ${err}`)
    }

    const data: { places?: PlaceResult[]; nextPageToken?: string } = await res.json()
    const places = data.places ?? []

    for (const p of places) {
      if (leads.length >= cantidad) break
      const lead: LeadExtraido = {
        nombre: p.displayName?.text ?? 'Sin nombre',
        sector,
        direccion: p.formattedAddress ?? null,
        ciudad,
        telefono: p.nationalPhoneNumber ?? null,
        web: p.websiteUri ?? null,
        google_maps_url: p.googleMapsUri ?? null,
        google_place_id: p.id,
        valoracion: p.rating ?? null,
        num_resenas: p.userRatingCount ?? null,
        horario: p.regularOpeningHours?.weekdayDescriptions ?? null,
        descripcion: p.editorialSummary?.text ?? null,
        fase: 'nuevo',
      }
      leads.push(lead)
      onProgress?.(lead, leads.length, cantidad)
    }

    pageToken = data.nextPageToken
    if (!pageToken || places.length === 0) break
    // El token de página tarda un instante en activarse
    await new Promise((r) => setTimeout(r, 1500))
  }

  return leads
}
