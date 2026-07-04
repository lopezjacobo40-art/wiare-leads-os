import { createContext, useContext } from 'react'
import { supabase } from './supabaseClient'

/* ─────────────────────────────────────────────
   Brand Kit — fuente ÚNICA de los valores de marca del módulo de Content.
   Ningún componente de Content hardcodea colores, fuentes ni logo:
   todo se lee de la tabla brand_kit_os a través de useBrandKit().
   ───────────────────────────────────────────── */

export interface BrandColores {
  fondo: string
  indigo: string
  cyan: string
}

export interface BrandFuentes {
  headings: string
  body: string
}

export interface BrandKit {
  id: string
  logo_url: string | null
  colores: BrandColores
  fuentes: BrandFuentes
  tono_voz: string | null
  actualizado_en: string
}

/* Lee el registro único de brand_kit_os (el más recientemente actualizado). */
export async function fetchBrandKit(): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from('brand_kit_os')
    .select('*')
    .order('actualizado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('fetchBrandKit error:', error)
    return null
  }
  return (data as BrandKit) ?? null
}

/* Actualiza el registro y refresca actualizado_en. */
export async function updateBrandKit(
  id: string,
  patch: Partial<Pick<BrandKit, 'logo_url' | 'colores' | 'fuentes' | 'tono_voz'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('brand_kit_os')
    .update({ ...patch, actualizado_en: new Date().toISOString() })
    .eq('id', id)
  return { error: error?.message ?? null }
}

/* ── Contexto: el brand kit se carga una vez y lo consumen todas las páginas de Content ── */
interface BrandKitContextValue {
  brand: BrandKit | null
  loading: boolean
  refresh: () => Promise<void>
}

export const BrandKitContext = createContext<BrandKitContextValue>({
  brand: null,
  loading: true,
  refresh: async () => {},
})

export function useBrandKit(): BrandKitContextValue {
  return useContext(BrandKitContext)
}
