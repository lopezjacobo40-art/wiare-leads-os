import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, WhatsappLogo, PaperPlaneTilt, CheckCircle, CalendarPlus,
  Handshake, ChatCircleDots, HourglassMedium, ArrowRight,
} from '@phosphor-icons/react'
import { supabase, type Lead, FASE_LABELS } from '../lib/supabaseClient'
import { construirGmailUrl } from '../lib/emailOutreach'
import { useToast } from './Toast'

/* ─────────────────────────────────────────────
   Cockpit de cierre — cola de trabajo diaria del Dashboard.
   Tres grupos, en orden de dinero:
   1. Respuestas y reuniones (fases respondido / reunion_agendada)
   2. Toques programados para hoy (o vencidos)
   3. Emails enviados sin seguimiento programado (el limbo)
   ───────────────────────────────────────────── */

const MAX_VISIBLE = 5

function soloDigitos(tel: string): string {
  const limpio = tel.replace(/\D/g, '')
  // wa.me exige país sin '+'; los españoles de 9 dígitos llevan 34 delante
  return limpio.length === 9 ? `34${limpio}` : limpio
}

/* Botones de contacto directo (teléfono, WhatsApp, Gmail) */
function AccionesContacto({ lead, onEmailAbierto }: { lead: Lead; onEmailAbierto?: () => void }) {
  const toast = useToast()
  const btn: React.CSSProperties = { padding: 6, minHeight: 32, minWidth: 32 }
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {lead.telefono && (
        <>
          <a
            href={`tel:${lead.telefono.replace(/\s/g, '')}`}
            className="btn-ghost"
            style={btn}
            aria-label={`Llamar a ${lead.nombre}`}
            title={`Llamar ${lead.telefono}`}
          >
            <Phone size={15} />
          </a>
          <a
            href={`https://wa.me/${soloDigitos(lead.telefono)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{ ...btn, color: '#22C55E' }}
            aria-label={`WhatsApp a ${lead.nombre}`}
            title="Abrir WhatsApp"
          >
            <WhatsappLogo size={15} />
          </a>
        </>
      )}
      <button
        className="btn-ghost"
        style={{ ...btn, color: '#A855F7' }}
        aria-label={`Email a ${lead.nombre}`}
        title={lead.email ? 'Redactar Gmail' : 'Sin email'}
        onClick={() => {
          const url = construirGmailUrl(lead)
          if (!url) { toast('Este lead no tiene email', 'error'); return }
          window.open(url, '_blank')
          onEmailAbierto?.()
        }}
      >
        <PaperPlaneTilt size={15} />
      </button>
    </span>
  )
}

function FilaLead({
  lead,
  detalle,
  acciones,
  onOpen,
}: {
  lead: Lead
  detalle: React.ReactNode
  acciones: React.ReactNode
  onOpen: (l: Lead) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: '#fff',
      }}
    >
      <button
        onClick={() => onOpen(lead)}
        style={{ background: 'none', textAlign: 'left', padding: 0, minWidth: 0, flex: 1 }}
        aria-label={`Abrir ${lead.nombre}`}
      >
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.nombre}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {detalle}
        </span>
      </button>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {acciones}
      </span>
    </div>
  )
}

function Grupo({
  icon: Icon,
  color,
  titulo,
  count,
  verTodos,
  children,
}: {
  icon: typeof Phone
  color: string
  titulo: string
  count: number
  verTodos?: () => void
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Icon size={15} weight="fill" /> {titulo}
          <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-full)', padding: '0 8px', fontSize: 11 }}>{count}</span>
        </span>
        {verTodos && count > MAX_VISIBLE && (
          <button className="btn-ghost" onClick={verTodos} style={{ fontSize: 11, padding: '2px 8px', minHeight: 26 }}>
            Ver todos <ArrowRight size={12} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

export default function CockpitCierre({
  leads,
  onOpenLead,
  onRefresh,
}: {
  leads: Lead[]
  onOpenLead: (l: Lead) => void
  onRefresh: () => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  const finHoy = new Date()
  finHoy.setHours(23, 59, 59, 999)

  // 1. Donde está el dinero: respondieron o hay reunión
  const enCierre = leads
    .filter((l) => l.fase === 'respondido' || l.fase === 'reunion_agendada')
    .sort((a, b) => (a.fase === 'reunion_agendada' ? -1 : 1) - (b.fase === 'reunion_agendada' ? -1 : 1))

  // 2. Toques programados para hoy o vencidos
  const toquesHoy = leads
    .filter((l) => l.proximo_toque_fecha && new Date(l.proximo_toque_fecha) <= finHoy)
    .sort((a, b) => new Date(a.proximo_toque_fecha!).getTime() - new Date(b.proximo_toque_fecha!).getTime())

  // 3. El limbo: email enviado sin siguiente toque programado
  const sinSeguimiento = leads.filter((l) => l.fase === 'email_enviado' && !l.proximo_toque_fecha)

  const total = enCierre.length + toquesHoy.length + sinSeguimiento.length
  if (total === 0) return null

  const marcarToqueHecho = async (lead: Lead) => {
    setOcupadoId(lead.id)
    const { error } = await supabase
      .from('leads_os')
      .update({ proximo_toque_fecha: null, proximo_toque_tipo: null })
      .eq('id', lead.id)
    setOcupadoId(null)
    if (error) toast('Error al marcar el toque', 'error')
    else {
      toast(`Toque con ${lead.nombre} completado`, 'success')
      onRefresh()
    }
  }

  const programarToque = async (lead: Lead, tipo: 'Llamada' | 'WhatsApp', dias: number) => {
    setOcupadoId(lead.id)
    const d = new Date()
    d.setDate(d.getDate() + dias)
    const { error } = await supabase
      .from('leads_os')
      .update({ proximo_toque_fecha: d.toISOString(), proximo_toque_tipo: tipo })
      .eq('id', lead.id)
    setOcupadoId(null)
    if (error) toast('Error al programar el toque', 'error')
    else {
      toast(`${tipo} programada en ${dias} días`, 'success')
      onRefresh()
    }
  }

  const fechaCorta = (iso: string) => {
    const f = new Date(iso)
    const hoy = new Date()
    const vencido = f < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    return vencido ? `vencido ${f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : 'hoy'
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CheckCircle size={20} color="var(--color-primary)" weight="fill" />
        Cockpit de cierre ({total})
      </h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <Grupo
          icon={Handshake}
          color="#16A34A"
          titulo="Respuestas y reuniones"
          count={enCierre.length}
          verTodos={() => navigate('/leads?fase=respondido')}
        >
          {enCierre.slice(0, MAX_VISIBLE).map((l) => (
            <FilaLead
              key={l.id}
              lead={l}
              onOpen={onOpenLead}
              detalle={FASE_LABELS[l.fase] ?? l.fase}
              acciones={<AccionesContacto lead={l} />}
            />
          ))}
        </Grupo>

        <Grupo
          icon={ChatCircleDots}
          color="var(--color-primary)"
          titulo="Toques de hoy"
          count={toquesHoy.length}
        >
          {toquesHoy.slice(0, MAX_VISIBLE).map((l) => (
            <FilaLead
              key={l.id}
              lead={l}
              onOpen={onOpenLead}
              detalle={<>{l.proximo_toque_tipo || 'Contacto'} · {fechaCorta(l.proximo_toque_fecha!)}</>}
              acciones={
                <>
                  <AccionesContacto lead={l} />
                  <button
                    className="btn-ghost"
                    disabled={ocupadoId === l.id}
                    onClick={() => marcarToqueHecho(l)}
                    style={{ padding: 6, minHeight: 32, minWidth: 32, color: 'var(--color-success)' }}
                    aria-label={`Marcar toque con ${l.nombre} como hecho`}
                    title="Toque hecho"
                  >
                    <CheckCircle size={15} weight="bold" />
                  </button>
                </>
              }
            />
          ))}
        </Grupo>

        <Grupo
          icon={HourglassMedium}
          color="var(--color-warning)"
          titulo="Enviados sin seguimiento"
          count={sinSeguimiento.length}
          verTodos={() => navigate('/leads?fase=email_enviado')}
        >
          {sinSeguimiento.slice(0, MAX_VISIBLE).map((l) => (
            <FilaLead
              key={l.id}
              lead={l}
              onOpen={onOpenLead}
              detalle="Sin próximo toque programado"
              acciones={
                <>
                  <button
                    className="btn-ghost"
                    disabled={ocupadoId === l.id}
                    onClick={() => programarToque(l, 'Llamada', 3)}
                    style={{ padding: '4px 8px', minHeight: 32, fontSize: 11 }}
                    title="Programar llamada en 3 días"
                  >
                    <CalendarPlus size={13} /> 3d
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={ocupadoId === l.id}
                    onClick={() => programarToque(l, 'WhatsApp', 7)}
                    style={{ padding: '4px 8px', minHeight: 32, fontSize: 11 }}
                    title="Programar WhatsApp en 7 días"
                  >
                    <CalendarPlus size={13} /> 7d
                  </button>
                </>
              }
            />
          ))}
        </Grupo>
      </div>
    </div>
  )
}
