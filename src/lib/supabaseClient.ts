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
  // ── Propuesta slides (Bloque 4) ──
  propuesta_slides: Record<string, unknown> | null
  propuesta_tipo: string | null
}

export interface Extraccion {
  id: string
  created_at: string
  sector: string
  ciudad: string
  total_leads: number
  estado: string
}

export const FASES = ['nuevo', 'cualificado', 'demo_creada', 'propuesta_creada', 'propuesta_enviada', 'cerrado'] as const

export const FASE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  cualificado: 'Cualificado',
  demo_creada: 'Demo creada',
  propuesta_creada: 'Propuesta creada',
  propuesta_enviada: 'Propuesta enviada',
  cerrado: 'Cerrado',
}
