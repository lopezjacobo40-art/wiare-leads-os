import { useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCorners, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Sparkle, Trash, Rows, VideoCamera, FilmSlate, ImageSquare, CaretDown } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'
import { useBrandKit } from '../../lib/brandKit'
import { generarIdeasContenido } from '../../lib/claudeApi'
import {
  fetchPillars, fetchIdeas, crearIdeas, actualizarIdea, borrarIdea,
  IDEA_ESTADOS, FORMATO_LABELS, type ContentPillar, type ContentIdea, type IdeaEstado, type IdeaFormato,
} from '../../lib/contentIdeas'

/* Icono por formato de la idea. */
const FORMATO_ICONO: Record<IdeaFormato, typeof Rows> = {
  carrusel: Rows,
  video: VideoCamera,
  reel: FilmSlate,
  post: ImageSquare,
}
import { fetchVoiceExamples } from '../../lib/brandVoice'
import IdeaDrawer from '../../components/content/IdeaDrawer'

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/* ── Card ── */
function IdeaCardContenido({ idea, pilarNombre }: { idea: ContentIdea; pilarNombre?: string }) {
  const FormatoIcono = FORMATO_ICONO[idea.formato as IdeaFormato] ?? Rows
  return (
    <>
      {/* Cabecera: chip de semana del calendario + pilar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
        {idea.semana != null ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-subtle)', borderRadius: 'var(--radius-full)', padding: '1px 8px', letterSpacing: '0.02em' }}>
            {idea.semana === 0 ? 'Base' : `S${idea.semana}`}
          </span>
        ) : <span />}
        {pilarNombre && (
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pilarNombre}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 6 }}>
        {idea.titulo}
      </p>
      {idea.gancho && (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {idea.gancho}
        </p>
      )}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
          <FormatoIcono size={11} weight="fill" />
          {FORMATO_LABELS[idea.formato as IdeaFormato] ?? idea.formato}
        </span>
      </div>
    </>
  )
}

function IdeaCard({ idea, pilarNombre, onDelete, onOpen }: { idea: ContentIdea; pilarNombre?: string; onDelete: (id: string) => void; onOpen: (idea: ContentIdea) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id })
  return (
    <div
      ref={setNodeRef}
      className="kanban-card"
      onClick={() => onOpen(idea)}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.4 : 1, position: 'relative',
        background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        padding: '12px 14px', boxShadow: 'var(--shadow-sm)', marginBottom: 8, cursor: 'grab', touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Borrar idea ${idea.titulo}`}
        className="idea-del"
        style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, opacity: 0.5 }}
      >
        <Trash size={13} />
      </button>
      <IdeaCardContenido idea={idea} pilarNombre={pilarNombre} />
    </div>
  )
}

/* ── Columna ── */
function Columna({ estado, label, color, ideas, pilarNombreDe, onDelete, onOpen }: {
  estado: IdeaEstado; label: string; color: string; ideas: ContentIdea[]
  pilarNombreDe: (id: string | null) => string | undefined; onDelete: (id: string) => void; onOpen: (idea: ContentIdea) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <div style={{ width: 260, flex: '0 0 260px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} /> {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, background: rgba(color, 0.1), color, borderRadius: 'var(--radius-full)', padding: '1px 8px' }}>
          {ideas.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{ background: rgba(color, 0.03), borderRadius: 'var(--radius-lg)', padding: 12, minHeight: 240, border: isOver ? '1px dashed var(--color-primary)' : '1px dashed transparent', transition: 'border-color 150ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        <SortableContext items={ideas.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} pilarNombre={pilarNombreDe(idea.pilar_id)} onDelete={onDelete} onOpen={onOpen} />
          ))}
        </SortableContext>
        {ideas.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Vacío</div>
        )}
      </div>
    </div>
  )
}

export default function Ideas() {
  const toast = useToast()
  const { brand } = useBrandKit()
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [pilarSel, setPilarSel] = useState<string>('')
  const [pilarMenuOpen, setPilarMenuOpen] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [ejemplosTono, setEjemplosTono] = useState<string[]>([])
  const [ideaAbierta, setIdeaAbierta] = useState<ContentIdea | null>(null)

  // Colores de estado resueltos desde el brand kit (indigo/cyan no hardcodeados)
  const colorDe = (tono: 'neutro' | 'indigo' | 'cyan' | 'exito'): string => {
    if (tono === 'indigo') return brand?.colores.indigo ?? '#6366F1'
    if (tono === 'cyan') return brand?.colores.cyan ?? '#22D3EE'
    if (tono === 'exito') return 'var(--color-success)'
    return 'var(--color-text-tertiary)'
  }

  const cargar = async () => {
    const [ps, is, ex] = await Promise.all([fetchPillars(), fetchIdeas(), fetchVoiceExamples()])
    setPillars(ps)
    setIdeas(is)
    setEjemplosTono(ex.map((e) => e.texto_ejemplo))
    if (!pilarSel && ps.length > 0) setPilarSel(ps[0].id)
    // Si hay una idea abierta, refresca su copia con los datos nuevos
    setIdeaAbierta((prev) => (prev ? is.find((i) => i.id === prev.id) ?? null : null))
    setLoading(false)
  }
  useEffect(() => { cargar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const pilarNombreDe = (id: string | null) => pillars.find((p) => p.id === id)?.nombre_pilar
  const pilarActual = pillars.find((p) => p.id === pilarSel)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const activeIdea = activeId ? ideas.find((i) => i.id === activeId) ?? null : null

  const generar = async () => {
    if (!pilarActual) { toast('Elige un pilar primero', 'error'); return }
    setGenerando(true)
    try {
      const generadas = await generarIdeasContenido(pilarActual, brand?.tono_voz)
      const { error } = await crearIdeas(generadas.map((g) => ({
        pilar_id: pilarActual.id, titulo: g.titulo, gancho: g.gancho, formato: g.formato,
      })))
      if (error) throw new Error(error)
      toast(`5 ideas nuevas en "${pilarActual.nombre_pilar}"`, 'success')
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al generar ideas', 'error')
    } finally {
      setGenerando(false)
    }
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const idea = ideas.find((i) => i.id === id)
    if (!idea) return
    let destino = String(over.id) as IdeaEstado
    if (!IDEA_ESTADOS.some((s) => s.id === destino)) {
      const overIdea = ideas.find((i) => i.id === over.id)
      destino = (overIdea?.estado ?? idea.estado) as IdeaEstado
    }
    if (destino === idea.estado) return
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, estado: destino } : i)))
    const { error } = await actualizarIdea(id, { estado: destino })
    if (error) {
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, estado: idea.estado } : i)))
      toast('Error al mover la idea', 'error')
    } else {
      toast(`Movida a ${IDEA_ESTADOS.find((s) => s.id === destino)?.label}`, 'success')
    }
  }

  const eliminar = async (id: string) => {
    const prev = ideas
    setIdeas((p) => p.filter((i) => i.id !== id))
    const { error } = await borrarIdea(id)
    if (error) { setIdeas(prev); toast('Error al borrar', 'error') }
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Ideas de contenido"
        subtitulo="Ideación por pilares. Arrastra las ideas por el flujo: idea → en progreso → listo → publicado."
        acciones={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Selector de pilar */}
            <div style={{ position: 'relative' }}>
              <button className="btn-secondary" onClick={() => setPilarMenuOpen((v) => !v)} style={{ minHeight: 40, gap: 8 }} disabled={loading || pillars.length === 0}>
                {pilarActual?.nombre_pilar ?? 'Pilar'}
                <CaretDown size={14} style={{ transform: pilarMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
              {pilarMenuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 220, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 30 }}>
                  {pillars.map((p) => (
                    <button key={p.id} onClick={() => { setPilarSel(p.id); setPilarMenuOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', minHeight: 36, borderRadius: 'var(--radius-sm)', background: p.id === pilarSel ? 'var(--color-surface-2)' : 'transparent', fontSize: 13, fontWeight: 500 }}>
                      {p.nombre_pilar}
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{p.servicio_relacionado}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={generar} disabled={generando || loading} style={{ minHeight: 40, gap: 6 }}>
              {generando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Sparkle size={15} weight="fill" />}
              {generando ? 'Generando…' : 'Generar 5 ideas'}
            </button>
          </div>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="kanban-scroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {IDEA_ESTADOS.map((s) => (
              <Columna key={s.id} estado={s.id} label={s.label} color={colorDe(s.tono)}
                ideas={ideas.filter((i) => i.estado === s.id)} pilarNombreDe={pilarNombreDe} onDelete={eliminar} onOpen={setIdeaAbierta} />
            ))}
          </div>
          <DragOverlay>
            {activeIdea ? (
              <div style={{ width: 236, background: '#fff', border: `1px solid ${brand?.colores.indigo ?? '#6366F1'}`, borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: 'var(--shadow-lg)' }}>
                <IdeaCardContenido idea={activeIdea} pilarNombre={pilarNombreDe(activeIdea.pilar_id)} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {ideaAbierta && (
        <IdeaDrawer
          idea={ideaAbierta}
          pilarNombre={pilarNombreDe(ideaAbierta.pilar_id)}
          ejemplosTono={ejemplosTono}
          onClose={() => setIdeaAbierta(null)}
          onSaved={cargar}
        />
      )}
    </PageTransition>
  )
}
