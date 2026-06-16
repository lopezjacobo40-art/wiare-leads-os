import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

export interface Lead {
  id: string
  created_at: string
  nombre: string
  sector: string
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  web: string | null
  google_maps_url: string | null
  google_place_id: string | null
  valoracion: number | null
  num_resenas: number | null
  horario: string[] | null
  descripcion: string | null
  score_cualificacion: number | null
  motivo_score: string | null
  volumen_llamadas: string | null
  fase: string
  agent_id_retell: string | null
  system_prompt_sofia: string | null
  mrr_estimado: number | null
  coste_interno_mensual: number | null
  propuesta_md: string | null
  notas: string | null
  creado_por: string | null
  // ── Leads de wiaresolution.com (calculadora de pérdidas) ──
  fuente: string | null
  quiz_lead_id: string | null
  perdida_mensual_real: number | null
  perdida_anual_real: number | null
  email: string | null
  tag: string | null
  // ── Email finder (Bloque 3) ──
  email_fuente: string | null
  email_verificado: boolean | null
  // ── Extracción (sesión de extracción Apify) ──
  extraccion_id: string | null
  extraccion_fecha: string | null
  // ── Análisis de brechas (v6) ──
  analisis_brechas: AnalisisBrechas | null
  analizado_at: string | null
}

// Resultado del análisis de brechas que se guarda en leads_os.analisis_brechas (jsonb).
export interface AnalisisBrechas {
  brechas: string[]        // 3 brechas detectadas del negocio
  puntos_email: string[]   // 3 puntos clave listos para pegar en la plantilla
  ahorro_estimado: string  // p.ej. "~1.200€/mes en reservas perdidas"
}

export interface Extraccion {
  id: string
  created_at: string
  sector: string
  ciudad: string
  total_leads: number
  estado: string
  extraccion_id?: string | null
}

export const FASES = ['nuevo', 'negocio_analizado', 'listo_para_enviar', 'email_enviado', 'respondido', 'reunion_agendada'] as const

export const FASE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  negocio_analizado: 'Negocio analizado',
  listo_para_enviar: 'Listo para enviar',
  // Legacy — pueden existir en BD hasta migrar
  brechas_detectadas: 'Brechas detectadas',
  email_enviado: 'Email enviado',
  respondido: 'Respondió',
  reunion_agendada: 'Reunión agendada',
}
