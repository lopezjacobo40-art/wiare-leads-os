import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassPlus, PaperPlaneTilt, ChatCircleDots, Handshake,
  Globe, CheckCircle, ArrowRight,
} from '@phosphor-icons/react'
import type { Lead } from '../lib/supabaseClient'

/* ─────────────────────────────────────────────
   Cola del día — el único bloque que hay que mirar por la mañana.
   Cuatro acciones en orden de funnel: analizar → enviar → follow-ups → respuestas.
   El envío tiene cupo diario (deliverability de Gmail): se muestra cuánto queda.
   ───────────────────────────────────────────── */

export const LIMITE_ENVIOS_DIA = 15

export default function ColaDelDia({ leads, enviadosHoy }: { leads: Lead[]; enviadosHoy: number }) {
  const navigate = useNavigate()
  const finHoy = new Date()
  finHoy.setHours(23, 59, 59, 999)

  const porAnalizar = leads.filter((l) => l.fase === 'nuevo').length
  const listosParaEnviar = leads.filter((l) => l.fase === 'listo_para_enviar' && l.email).length
  const cupoRestante = Math.max(0, LIMITE_ENVIOS_DIA - enviadosHoy)
  const enviarHoy = Math.min(listosParaEnviar, cupoRestante)
  const followUps = leads.filter(
    (l) => l.proximo_toque_fecha && new Date(l.proximo_toque_fecha) <= finHoy
  ).length
  const respuestas = leads.filter(
    (l) => l.fase === 'respondido' || l.fase === 'reunion_agendada'
  ).length
  const webSinContactar = leads
    .filter((l) => l.fuente === 'web_calculadora' && l.fase === 'nuevo')
    .sort((a, b) => (b.perdida_mensual_real ?? 0) - (a.perdida_mensual_real ?? 0))

  const irAlCockpit = () =>
    document.getElementById('cockpit-cierre')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const tiles = [
    {
      key: 'analizar',
      icon: MagnifyingGlassPlus,
      label: 'Analizar',
      valor: porAnalizar,
      detalle: porAnalizar > 0 ? 'leads nuevos en cola' : 'cola vacía',
      color: '#6366F1',
      onClick: () => navigate('/leads?fase=nuevo'),
    },
    {
      key: 'enviar',
      icon: PaperPlaneTilt,
      label: 'Enviar',
      valor: enviarHoy,
      detalle:
        cupoRestante === 0
          ? `cupo diario completo (${enviadosHoy}/${LIMITE_ENVIOS_DIA})`
          : `${enviadosHoy}/${LIMITE_ENVIOS_DIA} enviados hoy${listosParaEnviar > enviarHoy ? ` · ${listosParaEnviar} listos` : ''}`,
      color: '#A855F7',
      onClick: () => navigate('/leads?fase=listo_para_enviar'),
    },
    {
      key: 'followups',
      icon: ChatCircleDots,
      label: 'Follow-ups',
      valor: followUps,
      detalle: followUps > 0 ? 'toques para hoy o vencidos' : 'ninguno programado para hoy',
      color: '#22D3EE',
      onClick: irAlCockpit,
    },
    {
      key: 'respuestas',
      icon: Handshake,
      label: 'Respuestas',
      valor: respuestas,
      detalle: respuestas > 0 ? 'esperan tu siguiente paso' : 'sin respuestas abiertas',
      color: '#16A34A',
      onClick: irAlCockpit,
    },
  ]

  const totalPendiente = porAnalizar + enviarHoy + followUps + respuestas + webSinContactar.length

  return (
    <div
      className="card"
      style={{ padding: 20, marginBottom: 32, border: '1px solid var(--color-border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Hoy
        </h2>
        {totalPendiente === 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
            <CheckCircle size={16} weight="fill" /> Día limpio · nada pendiente
          </span>
        )}
      </div>

      {/* Máxima prioridad: leads de la calculadora web sin contactar */}
      {webSinContactar.length > 0 && (
        <button
          onClick={() => navigate('/leads?fuente=web_calculadora&fase=nuevo')}
          aria-label={`${webSinContactar.length} leads de wiaresolution.com sin contactar`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '12px 16px',
            marginBottom: 12,
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
            transition: 'background 200ms ease-out',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,0.06)')}
        >
          <Globe size={16} color="#16A34A" weight="fill" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#16A34A' }}>
              {webSinContactar.length} lead{webSinContactar.length > 1 ? 's' : ''} de wiaresolution.com sin contactar
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Ya saben cuánto pierden · Máxima prioridad
              {webSinContactar[0]?.perdida_mensual_real != null &&
                ` · El más urgente: ${webSinContactar[0].perdida_mensual_real.toLocaleString('es-ES')}€/mes`}
            </span>
          </span>
          <ArrowRight size={14} color="#16A34A" style={{ flexShrink: 0 }} />
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tiles.map((t) => {
          const hecho = t.valor === 0
          return (
            <button
              key={t.key}
              onClick={t.onClick}
              disabled={hecho}
              aria-label={`${t.label}: ${t.valor}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: '14px 16px',
                background: hecho ? 'var(--color-surface)' : 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
                cursor: hecho ? 'default' : 'pointer',
                opacity: hecho ? 0.6 : 1,
                transition: 'background 150ms cubic-bezier(0.4,0,0.2,1), border-color 150ms cubic-bezier(0.4,0,0.2,1)',
              }}
              onMouseEnter={(e) => {
                if (!hecho) e.currentTarget.style.borderColor = t.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: hecho ? 'var(--color-text-tertiary)' : t.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <t.icon size={14} weight={hecho ? 'regular' : 'fill'} /> {t.label}
              </span>
              <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1, color: hecho ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {hecho ? <CheckCircle size={24} weight="fill" color="var(--color-success)" /> : t.valor}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{t.detalle}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
