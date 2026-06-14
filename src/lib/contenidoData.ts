/* ─────────────────────────────────────────────
   Datos del Generador de Contenido.
   Ángulos (casos de uso de WIARE), tonos y longitudes
   que alimentan el prompt del post de LinkedIn.
   ───────────────────────────────────────────── */

export type AnguloId =
  | 'llamadas_perdidas'
  | 'roi'
  | 'antes_despues'
  | 'mito_realidad'
  | 'caso_sector'
  | 'recepcionista_24_7'

export type TonoContenido = 'cercano' | 'profesional' | 'provocador'
export type LongitudId = 'corto' | 'medio'

export interface Angulo {
  id: AnguloId
  label: string
  descripcion: string
  /* Indicación concreta para el modelo. */
  enfoque: string
}

export const ANGULOS: Angulo[] = [
  {
    id: 'llamadas_perdidas',
    label: 'Llamadas perdidas',
    descripcion: 'El coste oculto de no atender el teléfono',
    enfoque:
      'Cada llamada que no se atiende es un cliente que se va a la competencia. Cuantifica el problema y presenta el agente de voz como la solución 24/7.',
  },
  {
    id: 'roi',
    label: 'Retorno (ROI)',
    descripcion: 'Los números: inversión vs recuperación',
    enfoque:
      'Compara el coste de WIARE (790€ + 90-390€/mes) con lo que recupera el negocio. Payback en semanas. Habla con cifras, no con humo.',
  },
  {
    id: 'antes_despues',
    label: 'Antes / Después',
    descripcion: 'La transformación de un negocio local',
    enfoque:
      'Pinta el "antes" (llamadas perdidas, recepción saturada) y el "después" (cada llamada atendida, leads registrados). Concreto y visual.',
  },
  {
    id: 'mito_realidad',
    label: 'Mito vs realidad',
    descripcion: 'Desmonta una objeción común',
    enfoque:
      'Coge un mito ("los clientes quieren hablar con una persona", "una IA suena a robot") y desmóntalo con realidad. Tono que invita a debate.',
  },
  {
    id: 'caso_sector',
    label: 'Caso por sector',
    descripcion: 'Ejemplo concreto de clínica/restaurante/etc.',
    enfoque:
      'Cuenta un caso de uso específico de un sector (clínica dental, restaurante, taller). Situación real, problema y cómo el agente lo resuelve.',
  },
  {
    id: 'recepcionista_24_7',
    label: 'Recepcionista 24/7',
    descripcion: 'El empleado que no duerme',
    enfoque:
      'Presenta el agente como un recepcionista que trabaja 24/7, no se pone malo y cuesta una fracción. Sin deshumanizar: complementa al equipo.',
  },
]

export const TONOS: Record<TonoContenido, { label: string; instruccion: string }> = {
  cercano: {
    label: 'Cercano',
    instruccion: 'Tono cercano y humano, de tú a tú, como hablándole a un amigo dueño de un negocio. Natural, sin corporativismo.',
  },
  profesional: {
    label: 'Profesional',
    instruccion: 'Tono profesional y con autoridad, pero claro. Aporta criterio y datos. Sin jerga vacía ni buzzwords.',
  },
  provocador: {
    label: 'Provocador',
    instruccion: 'Tono provocador que abre con una afirmación que reta al lector. Genera debate, sin faltar al respeto. Engancha desde la primera línea.',
  },
}

export const LONGITUDES: Record<LongitudId, { label: string; instruccion: string }> = {
  corto: { label: 'Corto', instruccion: 'Post corto: 4-6 líneas, una sola idea potente. Para máxima lectura en el feed.' },
  medio: { label: 'Medio', instruccion: 'Post medio: 8-14 líneas con gancho, desarrollo en 2-3 puntos y cierre con CTA.' },
}
