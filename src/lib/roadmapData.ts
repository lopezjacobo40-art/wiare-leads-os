/* ─────────────────────────────────────────────
   Roadmap de construcción de la agencia WIARE.
   Las 10 fases del funnel natural, de menor a mayor madurez.
   Se usan como SEMILLA: si la tabla roadmap_os está vacía
   en el primer load, se insertan estas filas. A partir de ahí
   el estado vive en Supabase y es editable desde la UI.
   ───────────────────────────────────────────── */

export type EstadoFase = 'completado' | 'en_progreso' | 'pendiente'

export interface Fase {
  id: number
  orden: number
  titulo: string
  descripcion: string
  estado: EstadoFase
  created_at?: string
  updated_at?: string
}

/* Semilla — 10 fases. El estado inicial refleja un punto de partida
   razonable; se ajusta desde la propia página una vez sembrado. */
export const FASES_SEMILLA: Omit<Fase, 'id'>[] = [
  {
    orden: 1,
    titulo: 'Definición de oferta y nicho',
    descripcion:
      'Cerrar el ICP (negocios locales en España), el producto (agente de voz + CRM) y el pricing (790€ setup + 90-390€/mes).',
    estado: 'completado',
  },
  {
    orden: 2,
    titulo: 'Producto mínimo vendible',
    descripcion:
      'Agente de voz Sofía sobre Retell AI funcionando, con demo personalizable por lead. Voz española confirmada.',
    estado: 'completado',
  },
  {
    orden: 3,
    titulo: 'Sistema de prospección (Leads OS)',
    descripcion:
      'Extracción de leads, scoring con IA, pipeline Kanban y generación de propuestas. El OS donde vive el día a día.',
    estado: 'completado',
  },
  {
    orden: 4,
    titulo: 'Captación inbound (web + calculadora)',
    descripcion:
      'wiaresolution.com con calculadora de pérdidas conectada al OS. Los leads web entran ya cualificados al pipeline.',
    estado: 'en_progreso',
  },
  {
    orden: 5,
    titulo: 'Captación orgánica (contenido)',
    descripcion:
      'Posts de LinkedIn sobre casos de uso de WIARE para atraer clínicas y negocios locales sin depender solo de outbound.',
    estado: 'en_progreso',
  },
  {
    orden: 6,
    titulo: 'Máquina de ventas',
    descripcion:
      'Guion de discovery, manejo de objeciones y simulador de llamadas para entrenar el cierre de forma repetible.',
    estado: 'en_progreso',
  },
  {
    orden: 7,
    titulo: 'Primeros clientes de pago',
    descripcion:
      'Cerrar los primeros setups cobrados y dejar el agente activo. Validar el ciclo completo lead → cobrado → activo.',
    estado: 'pendiente',
  },
  {
    orden: 8,
    titulo: 'Delivery y onboarding repetible',
    descripcion:
      'Proceso estándar de implementación: del setup cobrado al agente en producción en 7 días, sin reinventar cada vez.',
    estado: 'pendiente',
  },
  {
    orden: 9,
    titulo: 'Customer success y retención',
    descripcion:
      'Seguimiento de clientes activos, métricas de llamadas atendidas y reducción de bajas. La mensualidad recurrente sólida.',
    estado: 'pendiente',
  },
  {
    orden: 10,
    titulo: 'Escala y sistematización',
    descripcion:
      'Delegar pipeline, automatizar lo repetible y crecer el MRR sin que el fundador sea el cuello de botella.',
    estado: 'pendiente',
  },
]
