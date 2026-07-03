import type { Lead } from './supabaseClient'

/* ─────────────────────────────────────────────
   Construcción del email de outreach para Gmail.
   Única fuente: antes estaba triplicado en Leads, QuickView y LeadDetalle.

   Prioridad del contenido:
   1. Email generado por el análisis de brechas (email_asunto/email_cuerpo)
   2. Plantilla personalizada de localStorage (email_template_subject/body)
   3. Plantilla por defecto (icebreaker + puntos del análisis)
   ───────────────────────────────────────────── */

const DEFAULT_SUBJECT = 'pregunta rápida'
const DEFAULT_BODY = `{{icebreaker}}

{{puntos}}

Si te cuadra, ¿te paso un audio de 30 segundos por WhatsApp para que escuches cómo sonaría con el nombre de {{nombre_negocio}}? Si no encaja, cero compromiso.

Jacobo.`

export function construirGmailUrl(lead: Lead): string | null {
  if (!lead.email) return null

  let asunto: string
  let cuerpo: string

  if (lead.analisis_brechas?.email_asunto && lead.analisis_brechas?.email_cuerpo) {
    asunto = lead.analisis_brechas.email_asunto
    cuerpo = lead.analisis_brechas.email_cuerpo
  } else {
    const subjectTemplate = localStorage.getItem('email_template_subject') || DEFAULT_SUBJECT
    const bodyTemplate = localStorage.getItem('email_template_body') || DEFAULT_BODY

    const nombreDecisor = lead.decisor_nombre ? lead.decisor_nombre.split(' ')[0] : 'propietario'
    const icebreaker =
      lead.icebreaker || `Hola ${nombreDecisor}, vi vuestro negocio ${lead.nombre} y me pareció muy interesante.`
    const puntos = (lead.analisis_brechas?.puntos_email || []).join('\n\n')

    const reemplazar = (tpl: string) =>
      tpl
        .replace(/{{nombre_negocio}}/g, lead.nombre)
        .replace(/{{nombre_decisor}}/g, nombreDecisor)
        .replace(/{{ciudad}}/g, lead.ciudad || 'tu ciudad')
        .replace(/{{icebreaker}}/g, icebreaker)
        .replace(/{{puntos}}/g, puntos || '- Sin puntos detectados')

    asunto = reemplazar(subjectTemplate)
    cuerpo = reemplazar(bodyTemplate)
  }

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}
