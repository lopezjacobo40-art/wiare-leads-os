import { supabase } from './supabaseClient'

export type Accion = 'score' | 'content'

const BATCH_SIZE = 5
const BATCH_DELAY = 500 // ms

// Estimación de tokens por acción (input+output aproximado) para el log
const TOKENS_ESTIMADOS: Record<Accion, number> = {
  score: 400,
  content: 2500,
}

// Coste aproximado por acción en € (haiku para score, sonnet para content)
const COSTE_POR_ACCION: Record<Accion, number> = {
  score: 0.001,
  content: 0.02,
}

function usuarioActual(): string {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('wiare_user') ?? 'desconocido'
    }
  } catch (e) {
    // ignorar
  }
  return 'desconocido'
}

function hoy(): string {
  return new Date().toISOString().split('T')[0]
}

function limiteDe(accion: Accion): number {
  const raw =
    accion === 'score'
      ? import.meta.env.VITE_DAILY_SCORE_LIMIT
      : import.meta.env.VITE_DAILY_CONTENT_LIMIT
  const n = Number(raw)
  // Por defecto: 100 scores / 20 contenidos al día
  return Number.isFinite(n) && n > 0 ? n : accion === 'score' ? 100 : 20
}

/* ─────────────────────────────────────────────
   PROTECCIÓN 1 — Rate limit en batch
   Procesa en grupos de 5 con 500ms de pausa entre grupos.
   ───────────────────────────────────────────── */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE)
    const chunkResults = await Promise.all(chunk.map(processor))
    results.push(...chunkResults)
    onProgress?.(Math.min(i + BATCH_SIZE, items.length), items.length)
    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY))
    }
  }
  return results
}

/* ─────────────────────────────────────────────
   PROTECCIÓN 2 — Límite diario por usuario
   ───────────────────────────────────────────── */
export async function checkLimit(accion: Accion, usuario = usuarioActual()): Promise<void> {
  const limite = limiteDe(accion)
  const { count, error } = await supabase
    .from('token_usage_os')
    .select('*', { count: 'exact', head: true })
    .eq('usuario', usuario)
    .eq('accion', accion)
    .eq('fecha', hoy())

  if (error) return // si el contador falla, no bloqueamos el trabajo del usuario
  if ((count ?? 0) >= limite) {
    throw new Error(`Límite diario de ${accion} alcanzado (${limite}/día)`)
  }
}

export async function registrarUso(accion: Accion, usuario = usuarioActual()): Promise<void> {
  await supabase.from('token_usage_os').insert({
    usuario,
    accion,
    tokens_estimados: TOKENS_ESTIMADOS[accion],
  })
}

/* Envuelve una llamada a Claude: verifica límite → ejecuta → registra uso. */
export async function guardedCall<R>(accion: Accion, fn: () => Promise<R>): Promise<R> {
  const usuario = usuarioActual()
  await checkLimit(accion, usuario)
  const result = await fn()
  // Registramos solo tras éxito; no bloqueamos si el insert del log falla
  registrarUso(accion, usuario).catch(() => {})
  return result
}

/* ─────────────────────────────────────────────
   PROTECCIÓN 3 — Estimación de coste de un batch
   ───────────────────────────────────────────── */
export function estimarCoste(accion: Accion, cantidad: number): number {
  return COSTE_POR_ACCION[accion] * cantidad
}

export const BATCH_CONFIRM_THRESHOLD = 20

/* ─────────────────────────────────────────────
   Indicador de uso del día (para el Sidebar)
   ───────────────────────────────────────────── */
export interface UsoHoy {
  score: number
  content: number
  limiteScore: number
  limiteContent: number
}

export async function getUsoHoy(usuario = usuarioActual()): Promise<UsoHoy> {
  const fecha = hoy()
  const [scoreRes, contentRes] = await Promise.all([
    supabase
      .from('token_usage_os')
      .select('*', { count: 'exact', head: true })
      .eq('usuario', usuario)
      .eq('accion', 'score')
      .eq('fecha', fecha),
    supabase
      .from('token_usage_os')
      .select('*', { count: 'exact', head: true })
      .eq('usuario', usuario)
      .eq('accion', 'content')
      .eq('fecha', fecha),
  ])

  return {
    score: scoreRes.count ?? 0,
    content: contentRes.count ?? 0,
    limiteScore: limiteDe('score'),
    limiteContent: limiteDe('content'),
  }
}
