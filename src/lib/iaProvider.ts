/* Motor de IA para la generación de contenido.
   Claude (Haiku) = calidad calibrada con el ADN Hormozi.
   Gemini (2.5 Flash) = ~3× más barato, ideal para volumen. */

export type ProveedorIA = 'claude' | 'gemini'

export const PROVEEDORES_IA: { id: ProveedorIA; label: string; nota: string }[] = [
  { id: 'claude', label: 'Claude', nota: 'Calidad calibrada (Haiku)' },
  { id: 'gemini', label: 'Gemini', nota: '~3× más barato (Flash)' },
]

const CLAVE_LS = 'ia_provider'

export function getProveedorIA(): ProveedorIA {
  return localStorage.getItem(CLAVE_LS) === 'gemini' ? 'gemini' : 'claude'
}

export function setProveedorIA(p: ProveedorIA): void {
  localStorage.setItem(CLAVE_LS, p)
}
