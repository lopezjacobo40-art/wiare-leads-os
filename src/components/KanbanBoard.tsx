import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, MagnifyingGlassPlus, DotsNine } from '@phosphor-icons/react'
import { supabase, type Lead } from '../lib/supabaseClient'
import { FASES, FASE_LABELS } from '../lib/supabaseClient'
import ScoreBadge from './ScoreBadge'
import FuenteBadge from './FuenteBadge'
import { useToast } from './Toast'

// Color por fase. Cada hex corresponde 1:1 con un token de globals.css
// (se mantiene en hex porque rgbaFromHex() deriva los fondos translúcidos a partir de él).
const FASE_COLOR: Record<string, string> = {
  nuevo: '#A1A1AA',               // --color-text-tertiary
  negocio_analizado: '#6366F1',   // --color-primary (indigo)
  brechas_detectadas: '#A855F7',  // violeta
  email_enviado: '#22D3EE',       // cyan (enviado, esperando)
  respondido: '#22C55E',          // verde (respondió — buena señal)
  reunion_agendada: '#16A34A',    // verde fuerte (la conversión que importa)
}

function rgbaFromHex(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* Pill de estado muy compacto */
function EstadoPill({ icon: Icon, label, color, bg }: { icon: typeof MagnifyingGlassPlus; label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        borderRadius: 'var(--radius-full)',
        fontSize: 10,
        fontWeight: 500,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={10} weight="fill" /> {label}
    </span>
  )
}

/* ── Contenido visual de la card (compartido entre card real y ghost) ── */
function CardContenido({ lead }: { lead: Lead }) {
  const analizado = !!lead.analizado_at
  return (
    <>
      {/* Fila 1: nombre (2 líneas máx) */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          lineHeight: 1.3,
          marginBottom: 6,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {lead.nombre}
      </p>

      {lead.fuente === 'web_calculadora' && (
        <div style={{ marginBottom: 8 }}><FuenteBadge fuente={lead.fuente} /></div>
      )}

      {/* Fila 2: ciudad + sector badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        {lead.ciudad ? (
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <MapPin size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.ciudad}</span>
          </span>
        ) : <span />}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {lead.sector}
        </span>
      </div>

      {/* Fila 3: score + MRR (separador arriba) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
        <ScoreBadge score={lead.score_cualificacion} size="sm" />
        {lead.mrr_estimado != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
            {lead.mrr_estimado}€/mes
          </span>
        )}
      </div>

      {/* Indicadores de estado */}
      {analizado && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          <EstadoPill icon={MagnifyingGlassPlus} label="Analizado" color="var(--color-success)" bg="rgba(34,197,94,0.1)" />
        </div>
      )}
    </>
  )
}

/* ── Card del lead ── */
function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 8,
    cursor: 'grab',
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      className="kanban-card"
      style={style}
      aria-label={`${lead.nombre}, fase ${FASE_LABELS[lead.fase] ?? lead.fase}. Pulsa espacio para seleccionar y las flechas para mover entre fases.`}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
    >
      {/* Punto verde pulsante para leads de la web */}
      {lead.fuente === 'web_calculadora' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            background: '#22C55E',
            borderRadius: '50%',
            animation: 'pulse-dot 2s infinite',
          }}
        />
      )}
      {/* Drag handle (visible al hover) */}
      <DotsNine
        size={14}
        weight="bold"
        className="kanban-drag-handle"
        style={{ position: 'absolute', top: 12, right: 12, color: 'var(--color-text-tertiary)' }}
      />
      <CardContenido lead={lead} />
    </div>
  )
}

/* ── Card estática para el overlay de arrastre ── */
function LeadCardGhost({ lead }: { lead: Lead }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-lg)',
        transform: 'scale(1.02)',
        cursor: 'grabbing',
        width: 220,
      }}
    >
      <CardContenido lead={lead} />
    </div>
  )
}

/* ── Columna droppable ── */
function Column({
  fase,
  leads,
  onOpen,
}: {
  fase: string
  leads: Lead[]
  onOpen: (lead: Lead) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fase })
  const color = FASE_COLOR[fase] ?? '#A1A1AA'

  return (
    <div className="kanban-col" style={{ width: 220, flex: '0 0 220px' }}>
      {/* Header columna */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
          {FASE_LABELS[fase] ?? fase}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            background: rgbaFromHex(color, 0.1),
            color,
            borderRadius: 'var(--radius-full)',
            padding: '1px 8px',
          }}
        >
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          background: rgbaFromHex(color, 0.03),
          borderRadius: 'var(--radius-lg)',
          padding: 12,
          minHeight: 200,
          border: isOver ? '1px dashed var(--color-primary)' : '1px dashed transparent',
          transition: 'border-color 150ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 400,
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Sin leads en esta fase
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ leads: leadsProp, onOpenLead }: { leads: Lead[]; onOpenLead?: (lead: Lead) => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [leads, setLeads] = useState<Lead[]>(leadsProp)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => setLeads(leadsProp), [leadsProp])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const leadId = String(active.id)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // El destino puede ser una columna (id = fase) o una card (id = leadId)
    let destinoFase = String(over.id)
    if (!FASES.includes(destinoFase as (typeof FASES)[number])) {
      const overLead = leads.find((l) => l.id === over.id)
      destinoFase = overLead?.fase ?? lead.fase
    }

    if (destinoFase === lead.fase) return

    // Optimista: actualiza UI inmediatamente
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, fase: destinoFase } : l)))

    const { error } = await supabase.from('leads_os').update({ fase: destinoFase }).eq('id', leadId)
    if (error) {
      // Revertir si falla
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, fase: lead.fase } : l)))
      toast('Error al mover el lead', 'error')
    } else {
      toast(`Movido a ${FASE_LABELS[destinoFase] ?? destinoFase}`, 'success')
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="kanban-scroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
          {FASES.map((fase) => (
            <Column
              key={fase}
              fase={fase}
              leads={leads.filter((l) => l.fase === fase)}
              onOpen={(lead) => (onOpenLead ? onOpenLead(lead) : navigate(`/leads/${lead.id}`))}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
          {activeLead ? <LeadCardGhost lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}
