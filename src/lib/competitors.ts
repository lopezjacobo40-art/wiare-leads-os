import { supabase } from './supabaseClient'
import { correrActor } from './apifyClient'

/* ─────────────────────────────────────────────
   Seguimiento de competidores en Instagram.
   Datos públicos vía Apify (instagram-profile-scraper):
   un run devuelve el perfil + sus últimos posts.
   Cada refresh guarda un snapshot (histórico → tendencias)
   y hace upsert de los posts.
   ───────────────────────────────────────────── */

export interface Competitor {
  id: string
  username: string
  nombre: string | null
  activo: boolean
  ultimo_scrape: string | null
  creado_en: string
}

export interface CompetitorSnapshot {
  id: string
  competitor_id: string
  followers: number | null
  following: number | null
  posts_count: number | null
  engagement_rate: number | null
  capturado_en: string
}

export interface CompetitorPost {
  id: string
  competitor_id: string
  ig_post_id: string
  url: string | null
  tipo: string | null
  caption: string | null
  likes: number | null
  comments: number | null
  video_views: number | null
  thumbnail_url: string | null
  publicado_en: string | null
  capturado_en: string
}

/* Competidor + métricas derivadas de sus snapshots (para la tabla). */
export interface CompetitorConMetricas extends Competitor {
  followers: number | null
  engagement_rate: number | null
  posts_count: number | null
  delta_7d: number | null
  delta_30d: number | null
}

const ACTOR_IG = 'apify~instagram-profile-scraper'

export async function fetchCompetitors(): Promise<CompetitorConMetricas[]> {
  const [{ data: comps, error }, { data: snaps }] = await Promise.all([
    supabase.from('competitors_os').select('*').order('creado_en', { ascending: true }),
    supabase
      .from('competitor_snapshots_os')
      .select('*')
      .order('capturado_en', { ascending: false }),
  ])
  if (error) { console.error('fetchCompetitors:', error.message); return [] }

  const snapsPor = new Map<string, CompetitorSnapshot[]>()
  for (const s of (snaps as CompetitorSnapshot[]) ?? []) {
    const lista = snapsPor.get(s.competitor_id) ?? []
    lista.push(s)
    snapsPor.set(s.competitor_id, lista)
  }

  const ahora = Date.now()
  const DIA = 24 * 60 * 60 * 1000

  return ((comps as Competitor[]) ?? []).map((c) => {
    const lista = snapsPor.get(c.id) ?? [] // ya ordenados desc
    const ultimo = lista[0] ?? null
    // Snapshot más cercano anterior a hace N días → delta de followers
    const deltaDesde = (dias: number): number | null => {
      if (!ultimo?.followers) return null
      const corte = ahora - dias * DIA
      const base = lista.find((s) => new Date(s.capturado_en).getTime() <= corte)
      if (!base?.followers) return null
      return ultimo.followers - base.followers
    }
    return {
      ...c,
      followers: ultimo?.followers ?? null,
      engagement_rate: ultimo?.engagement_rate ?? null,
      posts_count: ultimo?.posts_count ?? null,
      delta_7d: deltaDesde(7),
      delta_30d: deltaDesde(30),
    }
  })
}

export async function fetchCompetitorPosts(competitorId: string): Promise<CompetitorPost[]> {
  const { data, error } = await supabase
    .from('competitor_posts_os')
    .select('*')
    .eq('competitor_id', competitorId)
    .order('publicado_en', { ascending: false, nullsFirst: false })
    .limit(24)
  if (error) { console.error('fetchCompetitorPosts:', error.message); return [] }
  return (data as CompetitorPost[]) ?? []
}

export async function addCompetitor(username: string): Promise<{ error: string | null; id?: string }> {
  const limpio = username.trim().replace(/^@/, '').toLowerCase()
  if (!limpio) return { error: 'Escribe un usuario de Instagram' }
  const { data, error } = await supabase
    .from('competitors_os')
    .insert({ username: limpio })
    .select('id')
    .single()
  if (error) {
    return { error: error.code === '23505' ? 'Ese competidor ya está en seguimiento' : error.message }
  }
  return { error: null, id: data?.id }
}

export async function deleteCompetitor(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('competitors_os').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/* Perfil crudo que devuelve el actor de Apify. */
interface IgLatestPost {
  id?: string
  shortCode?: string
  type?: string
  caption?: string
  url?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  displayUrl?: string
  timestamp?: string
}

/* Refresca un competidor: scrape del perfil público + snapshot + upsert de posts.
   Devuelve un resumen o un error legible. */
export async function scrapeCompetitor(
  comp: Competitor
): Promise<{ error: string | null; followers?: number; posts?: number }> {
  const items = await correrActor(ACTOR_IG, {
    usernames: [comp.username],
    resultsLimit: 1,
  })
  const perfil = items[0] as Record<string, unknown> | undefined
  if (!perfil) {
    return { error: `Sin datos para @${comp.username} (¿perfil privado o inexistente?)` }
  }

  const followers = (perfil.followersCount as number) ?? null
  const following = (perfil.followsCount as number) ?? null
  const postsCount = (perfil.postsCount as number) ?? null
  const latestPosts = ((perfil.latestPosts as IgLatestPost[]) ?? []).filter((p) => p.id || p.shortCode)

  // Engagement medio de los últimos posts: (likes+comments)/followers, en %
  let engagement: number | null = null
  if (followers && latestPosts.length > 0) {
    const totalInteracciones = latestPosts.reduce(
      (acc, p) => acc + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0
    )
    engagement = Number((((totalInteracciones / latestPosts.length) / followers) * 100).toFixed(3))
  }

  const { error: snapErr } = await supabase.from('competitor_snapshots_os').insert({
    competitor_id: comp.id,
    followers, following, posts_count: postsCount,
    engagement_rate: engagement,
  })
  if (snapErr) return { error: `Error guardando snapshot: ${snapErr.message}` }

  if (latestPosts.length > 0) {
    const filas = latestPosts.map((p) => ({
      competitor_id: comp.id,
      ig_post_id: String(p.id ?? p.shortCode),
      url: p.url ?? (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
      tipo: p.type ?? null,
      caption: p.caption ?? null,
      likes: p.likesCount ?? null,
      comments: p.commentsCount ?? null,
      video_views: p.videoViewCount ?? null,
      thumbnail_url: p.displayUrl ?? null,
      publicado_en: p.timestamp ?? null,
    }))
    const { error: postsErr } = await supabase
      .from('competitor_posts_os')
      .upsert(filas, { onConflict: 'ig_post_id' })
    if (postsErr) console.error('upsert posts:', postsErr.message)
  }

  const nombre = (perfil.fullName as string) ?? null
  await supabase
    .from('competitors_os')
    .update({ ultimo_scrape: new Date().toISOString(), ...(nombre ? { nombre } : {}) })
    .eq('id', comp.id)

  return { error: null, followers: followers ?? undefined, posts: latestPosts.length }
}
