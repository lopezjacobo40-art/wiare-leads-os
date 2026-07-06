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

export type IdeaFormato = 'carrusel' | 'video' | 'reel' | 'post' | 'secuencia' | 'historia'
export type IdeaEstado = 'idea' | 'en_progreso' | 'listo' | 'publicado'

/* Etiqueta e icono por formato (para las tarjetas). El icono se resuelve en el
   componente; aquí solo el texto. Los formatos legacy (video, secuencia) se
   conservan para ideas antiguas; la creación nueva usa FORMATOS_ACTIVOS. */
export const FORMATO_LABELS: Record<IdeaFormato, string> = {
  carrusel: 'Carrusel',
  video: 'Vídeo',
  reel: 'Reel',
  post: 'Post',
  secuencia: 'Secuencia',
  historia: 'Historia',
}

export const FORMATOS_ACTIVOS: IdeaFormato[] = ['carrusel', 'reel', 'post', 'historia']

/* Los 5 slides del carrusel, en orden. El rol define su papel en la plantilla
   (Fase 4) y guía a la IA para generar el copy con estructura Hormozi (PAS). */
export type SlideRol = 'hook' | 'problema' | 'solucion' | 'prueba_social' | 'cta'

export const SLIDE_ROLES: { rol: SlideRol; label: string }[] = [
  { rol: 'hook', label: 'Hook' },
  { rol: 'problema', label: 'Problema' },
  { rol: 'solucion', label: 'Solución' },
  { rol: 'prueba_social', label: 'Prueba social' },
  { rol: 'cta', label: 'CTA' },
]

export interface CopySlide {
  rol: SlideRol
  texto: string
}

export interface CarruselImagen {
  rol: SlideRol
  url: string
}

export interface ContentIdea {
  id: string
  pilar_id: string | null
  titulo: string
  gancho: string | null
  formato: IdeaFormato
  estado: IdeaEstado
  fecha_creacion: string
  copy_slides: CopySlide[] | null
  imagenes: CarruselImagen[] | null
  aspecto: string
  semana: number | null
  // ── Instagram Manager ──
  caption?: string | null
  fecha_publicacion?: string | null
  canal?: string | null
  origen?: 'propia' | 'replicada' | null
  competitor_post_id?: string | null
}

/* Estados del flujo del Instagram Manager, en orden. Mismos valores de BD que
   el antiguo Kanban (idea/en_progreso/listo/publicado); solo cambia la etiqueta.
   Los colores de marca (indigo/cyan) NO se hardcodean aquí: se resuelven en el
   componente desde brand_kit_os. */
export const IDEA_ESTADOS: { id: IdeaEstado; label: string; tono: 'neutro' | 'indigo' | 'cyan' | 'exito' }[] = [
  { id: 'idea', label: 'Backlog', tono: 'neutro' },
  { id: 'en_progreso', label: 'Borrador', tono: 'indigo' },
  { id: 'listo', label: 'Programado', tono: 'cyan' },
  { id: 'publicado', label: 'Publicado', tono: 'exito' },
]

export const ESTADO_LABELS: Record<IdeaEstado, string> = {
  idea: 'Backlog',
  en_progreso: 'Borrador',
  listo: 'Programado',
  publicado: 'Publicado',
}

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
    // Primero el calendario en orden de semana; las ideas sueltas (sin semana) al final
    .order('semana', { ascending: true, nullsFirst: false })
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

/* Crear una publicación completa desde el Instagram Manager. */
export async function crearIdea(
  idea: Partial<ContentIdea> & Pick<ContentIdea, 'titulo' | 'formato'>
): Promise<{ error: string | null; id?: string }> {
  const { data, error } = await supabase
    .from('content_ideas_os')
    .insert({ estado: 'idea', ...idea })
    .select('id')
    .single()
  return { error: error?.message ?? null, id: data?.id }
}

export async function actualizarIdea(
  id: string,
  patch: Partial<Pick<ContentIdea, 'titulo' | 'gancho' | 'formato' | 'estado' | 'pilar_id' | 'copy_slides' | 'imagenes' | 'aspecto' | 'caption' | 'fecha_publicacion'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_ideas_os').update(patch).eq('id', id)
  return { error: error?.message ?? null }
}

export async function borrarIdea(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_ideas_os').delete().eq('id', id)
  return { error: error?.message ?? null }
}
