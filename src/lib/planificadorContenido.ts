import { actualizarIdea, crearIdea, type ContentIdea } from './contentIdeas'
import { OBJETIVOS_HISTORIA } from './contentStories'

/* ─────────────────────────────────────────────
   Planificador del calendario de contenidos.
   Reparte las ideas reales del backlog/borrador en los días del mes
   (posts/carruseles/reels a las 18:00) y programa historias con
   objetivo rotatorio (12:00). Varios contenidos pueden caer el mismo día.
   Todo lo programado pasa a estado 'listo' con fecha_publicacion.
   ───────────────────────────────────────────── */

/* Días de la semana (ISO: 1=lunes … 7=domingo) según cuántas piezas por semana. */
const DIAS_FEED: Record<number, number[]> = {
  1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
}
const DIAS_HISTORIAS: Record<number, number[]> = {
  1: [2], 2: [2, 6], 3: [2, 4, 6], 4: [2, 3, 5, 6], 5: [2, 3, 4, 5, 6],
  6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
}

const HORA_FEED = 18
const HORA_HISTORIA = 12

function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

/* Fechas del mes que caen en los weekdays dados, desde hoy (si es el mes
   actual) hasta fin de mes, a la hora indicada. */
function slotsDelMes(mes: Date, weekdays: number[], hora: number): Date[] {
  const hoy = new Date()
  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
  const slots: Date[] = []
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    if (!weekdays.includes(isoWeekday(d))) continue
    const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0)
    if (slot <= hoy) continue // no programar en el pasado
    slots.push(slot)
  }
  return slots
}

export interface ResultadoPlan {
  feedProgramadas: number
  historiasProgramadas: number
  slotsSinIdea: number
  error: string | null
}

export async function planificarMes(
  mes: Date,
  opts: { postsSemana: number; historiasSemana: number },
  ideas: ContentIdea[]
): Promise<ResultadoPlan> {
  const feedSlots = slotsDelMes(mes, DIAS_FEED[Math.min(7, Math.max(1, opts.postsSemana))] ?? [1, 3, 5], HORA_FEED)
  const historiaSlots = opts.historiasSemana > 0
    ? slotsDelMes(mes, DIAS_HISTORIAS[Math.min(7, opts.historiasSemana)] ?? [2, 4, 6], HORA_HISTORIA)
    : []

  // Pools: ideas sin fecha aún, sin publicar. Feed = todo lo que no es historia.
  const sinFecha = ideas.filter((i) => !i.fecha_publicacion && i.estado !== 'publicado')
  const poolFeed = sinFecha.filter((i) => i.formato !== 'historia')
  const poolHistorias = sinFecha.filter((i) => i.formato === 'historia')

  let feedProgramadas = 0
  let historiasProgramadas = 0
  let slotsSinIdea = 0

  // 1. Feed: asignar ideas existentes a los slots, en orden
  for (let s = 0; s < feedSlots.length; s++) {
    const idea = poolFeed[s]
    if (!idea) { slotsSinIdea++; continue }
    const { error } = await actualizarIdea(idea.id, {
      fecha_publicacion: feedSlots[s].toISOString(),
      estado: 'listo',
    })
    if (error) return { feedProgramadas, historiasProgramadas, slotsSinIdea, error }
    feedProgramadas++
  }

  // 2. Historias: primero las del backlog; si faltan, se crean con objetivo rotatorio
  for (let s = 0; s < historiaSlots.length; s++) {
    const existente = poolHistorias[s]
    if (existente) {
      const { error } = await actualizarIdea(existente.id, {
        fecha_publicacion: historiaSlots[s].toISOString(),
        estado: 'listo',
      })
      if (error) return { feedProgramadas, historiasProgramadas, slotsSinIdea, error }
    } else {
      const obj = OBJETIVOS_HISTORIA[s % OBJETIVOS_HISTORIA.length]
      const { error } = await crearIdea({
        titulo: `Historia · ${obj.label}`,
        formato: 'historia',
        estado: 'listo',
        fecha_publicacion: historiaSlots[s].toISOString(),
        caption: `Secuencia de historias con objetivo "${obj.label}". Créala en la página Historias y publícala este día.`,
      })
      if (error) return { feedProgramadas, historiasProgramadas, slotsSinIdea, error }
    }
    historiasProgramadas++
  }

  return { feedProgramadas, historiasProgramadas, slotsSinIdea, error: null }
}
