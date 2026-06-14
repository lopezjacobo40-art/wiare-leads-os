/* ─────────────────────────────────────────────
   Datos del Simulador de Ventas.
   Sectores objetivo de WIARE + niveles de resistencia
   del cliente simulado. Alimentan el system prompt del roleplay.
   ───────────────────────────────────────────── */

export type Resistencia = 'tibio' | 'normal' | 'hueso_duro'

export interface SectorSim {
  id: string
  label: string
  /* Contexto del negocio para que la IA encarne un cliente realista. */
  perfil: string
  /* Objeciones típicas de ese sector, para que la IA las use. */
  objeciones: string[]
}

export const SECTORES: SectorSim[] = [
  {
    id: 'restaurante',
    label: 'Restaurante',
    perfil: 'Dueño de un restaurante con mucho volumen de reservas por teléfono, sobre todo en hora punta cuando no puede atender.',
    objeciones: ['Ya tengo a alguien cogiendo el teléfono', 'Mis clientes quieren hablar con una persona', 'No sé si entenderá los platos y alergias'],
  },
  {
    id: 'clinica',
    label: 'Clínica',
    perfil: 'Responsable de una clínica dental/médica privada que pierde llamadas fuera de horario y en huecos sin recepcionista.',
    objeciones: ['Los pacientes no se fían de una máquina', 'Tengo protección de datos muy estricta', 'Ya tengo centralita'],
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    perfil: 'Agente inmobiliario que recibe muchas llamadas de interesados en pisos pero está siempre en visitas.',
    objeciones: ['Cada cliente es distinto, no se puede automatizar', 'Yo cierro mejor por teléfono', 'No quiero parecer poco serio'],
  },
  {
    id: 'peluqueria',
    label: 'Peluquería',
    perfil: 'Dueña de peluquería/estética que no puede coger el teléfono mientras atiende a clientas en el sillón.',
    objeciones: ['Es un gasto que ahora no me puedo permitir', 'Mis clientas son de toda la vida', 'No tengo tiempo de aprender nada nuevo'],
  },
  {
    id: 'taller',
    label: 'Taller',
    perfil: 'Dueño de taller mecánico que está bajo el coche y se pierde llamadas de presupuestos y citas.',
    objeciones: ['Necesito saber el coche para dar precio', 'Mis clientes son mayores y no les gusta eso', 'Eso será carísimo'],
  },
  {
    id: 'gimnasio',
    label: 'Gimnasio',
    perfil: 'Gerente de un gimnasio que recibe llamadas pidiendo precios y clases de prueba a todas horas.',
    objeciones: ['Tengo la info en la web, que la miren', 'No quiero spam a mis socios', 'Eso lo hace mi recepción'],
  },
  {
    id: 'hotel',
    label: 'Hotel',
    perfil: 'Director de un hotel pequeño/rural que pierde reservas por no atender el teléfono en recepción 24h.',
    objeciones: ['Trabajo solo con plataformas de reserva', 'El trato humano es nuestro valor', 'En temporada baja no compensa'],
  },
  {
    id: 'academia',
    label: 'Academia',
    perfil: 'Director de una academia de idiomas/refuerzo que recibe llamadas de padres pidiendo información de cursos.',
    objeciones: ['Cada familia pregunta cosas distintas', 'Prefiero que vengan en persona', 'No sé si sabré medir si funciona'],
  },
]

export const RESISTENCIAS: Record<Resistencia, { label: string; instruccion: string }> = {
  tibio: {
    label: 'Tibio',
    instruccion:
      'Eres un cliente CURIOSO pero con dudas. Pones 1-2 objeciones suaves y, si el vendedor responde bien, te abres y avanzas hacia agendar una demo. No lo pongas demasiado fácil, pero eres receptivo.',
  },
  normal: {
    label: 'Normal',
    instruccion:
      'Eres un cliente REALISTA y ocupado. Pones objeciones genuinas y necesitas que te demuestren el valor con números concretos. Solo te convences si el vendedor maneja bien tus dudas. Ni regalas el cierre ni eres imposible.',
  },
  hueso_duro: {
    label: 'Hueso duro',
    instruccion:
      'Eres un cliente ESCÉPTICO y cortante. Tienes prisa, has oído mil promesas y dudas de todo. Pones objeciones duras seguidas, interrumpes y solo cedes si el vendedor es excelente manejando objeciones y aporta pruebas claras. No te convences fácil.',
  },
}
