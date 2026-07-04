import { supabase } from './supabaseClient'

/* ─────────────────────────────────────────────
   Pilares e ideas de contenido (Content OS — Fase 2).
   ───────────────────────────────────────────── */

export interface ContentPillar {
  id: string
  nombre_pilar: string
  descripcion: string | null
  objetivo: string | null
  servicio_relacionado: string | null
  creado_en: string
}

export type IdeaFormato = 'carrusel' | 'video'
export type IdeaEstado = 'idea' | 'en_progreso' | 'listo' | 'publicado'

export interface ContentIdea {
  id: string
  pilar_id: string | null
  titulo: string
  gancho: string | null
  formato: IdeaFormato
  estado: IdeaEstado
  fecha_creacion: string
}

/* Estados del Kanban, en orden de flujo. Los colores de marca (indigo/cyan) NO
   se hardcodean aquí: se resuelven en el componente desde brand_kit_os. Solo se
   marca cuál usa color de marca ('indigo'/'cyan') y cuál usa un neutro de UI. */
export const IDEA_ESTADOS: { id: IdeaEstado; label: string; tono: 'neutro' | 'indigo' | 'cyan' | 'exito' }[] = [
  { id: 'idea', label: 'Ideas', tono: 'neutro' },
  { id: 'en_progreso', label: 'En progreso', tono: 'indigo' },
  { id: 'listo', label: 'Listo', tono: 'cyan' },
  { id: 'publicado', label: 'Publicado', tono: 'exito' },
]

export async function fetchPillars(): Promise<ContentPillar[]> {
  const { data, error } = await supabase
    .from('content_pillars_os')
    .select('*')
    .order('creado_en', { ascending: true })
  if (error) { console.error('fetchPillars error:', error); return [] }
  return (data as ContentPillar[]) ?? []
}

export async function fetchIdeas(): Promise<ContentIdea[]> {
  const { data, error } = await supabase
    .from('content_ideas_os')
    .select('*')
    .order('fecha_creacion', { ascending: false })
  if (error) { console.error('fetchIdeas error:', error); return [] }
  return (data as ContentIdea[]) ?? []
}

export async function crearIdeas(
  ideas: Pick<ContentIdea, 'pilar_id' | 'titulo' | 'gancho' | 'formato'>[]
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('content_ideas_os')
    .insert(ideas.map((i) => ({ ...i, estado: 'idea' as IdeaEstado })))
  return { error: error?.message ?? null }
}

export async function actualizarIdea(
  id: string,
  patch: Partial<Pick<ContentIdea, 'titulo' | 'gancho' | 'formato' | 'estado' | 'pilar_id'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_ideas_os').update(patch).eq('id', id)
  return { error: error?.message ?? null }
}

export async function borrarIdea(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_ideas_os').delete().eq('id', id)
  return { error: error?.message ?? null }
}
