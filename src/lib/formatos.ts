/* Formatos de exportación de los diseños (carruseles e historias). */
export type FormatoKey = '4:5' | '1:1' | '9:16'

export const FORMATOS: Record<FormatoKey, { w: number; h: number; label: string }> = {
  '4:5': { w: 1080, h: 1350, label: 'Post 4:5' },
  '1:1': { w: 1080, h: 1080, label: 'Cuadrado 1:1' },
  '9:16': { w: 1080, h: 1920, label: 'Historia 9:16' },
}

export const FORMATO_DEFAULT: FormatoKey = '4:5'
