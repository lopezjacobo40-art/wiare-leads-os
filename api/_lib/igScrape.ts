import type { SupabaseClient } from '@supabase/supabase-js'

/* Scrape server-side de un competidor de Instagram (versión cron de
   src/lib/competitors.ts#scrapeCompetitor — misma normalización, pero con
   el actor en modo síncrono y el service role client, sin sesión de usuario). */

const ACTOR_IG = 'apify~instagram-profile-scraper'

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
  videoUrl?: string
  timestamp?: string
}

export interface ResultadoScrape {
  username: string
  error: string | null
  followers?: number | null
  posts?: number
}

export async function scrapeCompetidorServer(
  supabase: SupabaseClient,
  apifyToken: string,
  comp: { id: string; username: string }
): Promise<ResultadoScrape> {
  let items: Record<string, unknown>[]
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_IG}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [comp.username] }),
      }
    )
    if (!r.ok) return { username: comp.username, error: `Apify ${r.status}` }
    items = await r.json()
  } catch (err) {
    return { username: comp.username, error: err instanceof Error ? err.message : 'Error de red con Apify' }
  }

  const perfil = items[0] as Record<string, unknown> | undefined
  if (!perfil) return { username: comp.username, error: 'Sin datos (¿perfil privado o inexistente?)' }

  const followers = (perfil.followersCount as number) ?? null
  const following = (perfil.followsCount as number) ?? null
  const postsCount = (perfil.postsCount as number) ?? null
  const latestPosts = ((perfil.latestPosts as IgLatestPost[]) ?? []).filter((p) => p.id || p.shortCode)

  let engagement: number | null = null
  if (followers && latestPosts.length > 0) {
    const total = latestPosts.reduce((acc, p) => acc + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0)
    engagement = Number((((total / latestPosts.length) / followers) * 100).toFixed(3))
  }

  const { error: snapErr } = await supabase.from('competitor_snapshots_os').insert({
    competitor_id: comp.id,
    followers, following, posts_count: postsCount,
    engagement_rate: engagement,
  })
  if (snapErr) return { username: comp.username, error: `Snapshot: ${snapErr.message}` }

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
      video_url: p.videoUrl ?? null,
      publicado_en: p.timestamp ?? null,
    }))
    await supabase.from('competitor_posts_os').upsert(filas, { onConflict: 'ig_post_id' })
  }

  const nombre = (perfil.fullName as string) ?? null
  await supabase
    .from('competitors_os')
    .update({ ultimo_scrape: new Date().toISOString(), ...(nombre ? { nombre } : {}) })
    .eq('id', comp.id)

  return { username: comp.username, error: null, followers, posts: latestPosts.length }
}
