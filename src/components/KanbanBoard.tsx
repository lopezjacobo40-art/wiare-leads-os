import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin } from '@phosphor-icons/react'
import { supabase, type Lead } from '../lib/supabaseClient'
import { FASES, FASE_LABELS } from '../lib/supabaseClient'
import ScoreBadge from './ScoreBadge'

const FASE_COLOR: Record<string, string> = {
  nuevo: '#A1A1AA',
  cualificado: '#F59E0B',
  demo_creada: '#6366F1',
  propuesta_enviada: '#8B5CF6',
  cerrado: '#22C55E',
}

function rgbaFromHex(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ── Card del lead ── */
function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: '#fff',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 8,
    cursor: 'grab',
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
    >
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 6 }}>
        {lead.nombre}
      </p>
      {lead.ciudad && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 8,
          }}
        >
          <MapPin size={12} /> {lead.ciudad}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <ScoreBadge score={lead.score_cualificacion} size="sm" />
        {lead.mrr_estimado != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>
            {lead.mrr_estimado}€/mes
          </span>
        )}
      </div>
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
        padding: '12px 16px',
        boxShadow: 'var(--shadow-lg)',
        transform: 'scale(1.02)',
        cursor: 'grabbing',
        width: 220,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 6 }}>
        {lead.nombre}
      </p>
      {lead.ciudad && (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <MapPin size={12} /> {lead.ciudad}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <ScoreBadge score={lead.score_cualificacion} size="sm" />
        {lead.mrr_estimado != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>{lead.mrr_estimado}€/mes</span>
        )}
      </div>
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
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fase })
  const color = FASE_COLOR[fase] ?? '#A1A1AA'

  return (
    <div style={{ width: 220, flex: '0 0 220px' }}>
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
              color: 'var(--color-text-tertiary)',
            }}
          >
            Vacío
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ leads: leadsProp }: { leads: Lead[] }) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>(leadsProp)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => setLeads(leadsProp), [leadsProp])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
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
      setToast('Error al mover el lead')
    } else {
      setToast(`Movido a ${FASE_LABELS[destinoFase] ?? destinoFase}`)
    }
    setTimeout(() => setToast(null), 3000)
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
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
          {FASES.map((fase) => (
            <Column
              key={fase}
              fase={fase}
              leads={leads.filter((l) => l.fase === fase)}
              onOpen={(id) => navigate(`/leads/${id}`)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }}>
          {activeLead ? <LeadCardGhost lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-text-primary)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            animation: 'toast-in 250ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
