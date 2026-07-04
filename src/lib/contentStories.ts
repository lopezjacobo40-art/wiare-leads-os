import { supabase } from './supabaseClient'
import type { CarruselImagen } from './contentIdeas'

/* ─────────────────────────────────────────────
   Secuencias de Historias (Stories, vertical 9:16) por objetivo.
   ───────────────────────────────────────────── */

export interface StoryFrame { texto: string }

export interface ContentStory {
  id: string
  objetivo: string
  frames: StoryFrame[] | null
  imagenes: CarruselImagen[] | null
  creado_en: string
}

/* Objetivos disponibles para la secuencia (fijos, seleccionables). */
export const OBJETIVOS_HISTORIA: { id: string; label: string }[] = [
  { id: 'oferta', label: 'Anunciar una oferta' },
  { id: 'dms', label: 'Conseguir respuestas / DMs' },
  { id: 'educar', label: 'Educar rápido (tip)' },
  { id: 'prueba', label: 'Prueba social / caso' },
]

export function objetivoLabel(id: string): string {
  return OBJETIVOS_HISTORIA.find((o) => o.id === id)?.label ?? id
}

export async function fetchStories(): Promise<ContentStory[]> {
  const { data, error } = await supabase
    .from('content_stories_os')
    .select('*')
    .order('creado_en', { ascending: false })
  if (error) { console.error('fetchStories error:', error); return [] }
  return (data as ContentStory[]) ?? []
}

export async function crearStory(objetivo: string, frames: StoryFrame[]): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('content_stories_os')
    .insert({ objetivo, frames })
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function actualizarStory(
  id: string,
  patch: Partial<Pick<ContentStory, 'frames' | 'imagenes'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_stories_os').update(patch).eq('id', id)
  return { error: error?.message ?? null }
}

export async function borrarStory(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_stories_os').delete().eq('id', id)
  return { error: error?.message ?? null }
}
