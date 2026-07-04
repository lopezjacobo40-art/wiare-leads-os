import { supabase } from './supabaseClient'

/* ─────────────────────────────────────────────
   Ejemplos de copy real de WIARE — referencia de tono para la IA (Fase 3).
   ───────────────────────────────────────────── */

export type VoiceFuente = 'propuesta' | 'email' | 'web'

export interface BrandVoiceExample {
  id: string
  texto_ejemplo: string
  fuente: VoiceFuente
  fecha: string
}

export const FUENTE_LABELS: Record<VoiceFuente, string> = {
  propuesta: 'Propuesta',
  email: 'Email de outreach',
  web: 'Web',
}

export async function fetchVoiceExamples(): Promise<BrandVoiceExample[]> {
  const { data, error } = await supabase
    .from('brand_voice_examples_os')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) { console.error('fetchVoiceExamples error:', error); return [] }
  return (data as BrandVoiceExample[]) ?? []
}

export async function crearVoiceExample(texto: string, fuente: VoiceFuente): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('brand_voice_examples_os')
    .insert({ texto_ejemplo: texto, fuente })
  return { error: error?.message ?? null }
}

export async function borrarVoiceExample(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('brand_voice_examples_os').delete().eq('id', id)
  return { error: error?.message ?? null }
}
