// Conocimiento por nicho para el análisis de brechas.
// Claude usa estos campos como guía (no los copia literal) al detectar
// las brechas del negocio respecto a lo que WIARE resuelve:
// atención al cliente 24/7 que ahorra dinero y tiempo.

export interface NichoBrechas {
  id: string
  label: string
  problema_core: string   // el dolor central del sector
  palancas: string[]      // qué resuelve WIARE en ese nicho (3-4 palancas)
}

const NICHOS: NichoBrechas[] = [
  {
    id: 'restaurante',
    label: 'Restaurante',
    problema_core: 'pierde reservas y consultas que entran fuera de horario o en plena hora punta, cuando nadie puede coger el teléfono',
    palancas: [
      'reservas tomadas 24/7 sin interrumpir el servicio',
      'confirmación y recordatorio automático que reduce los no-shows',
      'cero llamadas perdidas en los picos de la noche o el fin de semana',
    ],
  },
  {
    id: 'clinica',
    label: 'Clínica médica',
    problema_core: 'pacientes que llaman para pedir cita y, si no les cogen, se van a otra clínica y no vuelven',
    palancas: [
      'citas tomadas a cualquier hora, incluso con la recepción cerrada',
      'recepción liberada para atender a los pacientes en sala',
      'huecos de agenda de última hora cubiertos automáticamente',
    ],
  },
  {
    id: 'dental',
    label: 'Clínica dental',
    problema_core: 'pacientes nuevos que buscan dentista online y se quedan con la primera clínica que responde a su llamada',
    palancas: [
      'la primera llamada de un paciente nuevo siempre atendida',
      'captación automática de presupuestos de alto valor (ortodoncia, implantes)',
      'auxiliar enfocada en tratamientos en vez de en el teléfono',
    ],
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    problema_core: 'compradores y propietarios que contactan fuera de horario o el fin de semana y, sin respuesta, llaman a otra agencia',
    palancas: [
      'cada llamada de comprador o propietario atendida los 7 días',
      'visitas agendadas aunque el agente esté en otra visita',
      'captación de propietarios que deciden vender fuera de oficina',
    ],
  },
  {
    id: 'academia',
    label: 'Academia / Formación',
    problema_core: 'consultas de matrícula que llegan durante las clases o fuera del horario lectivo y se pierden',
    palancas: [
      'consultas de matrícula respondidas al momento, con info del curso',
      'profesores que dan clase sin que el teléfono interrumpa',
      'proceso de matrícula ágil que no da tiempo a la competencia',
    ],
  },
  {
    id: 'taller',
    label: 'Taller mecánico',
    problema_core: 'clientes que llaman para presupuesto o urgencia mientras el mecánico tiene las manos en el motor',
    palancas: [
      'llamadas de presupuesto registradas aunque el taller esté a tope',
      'urgencias captadas 24/7 en vez de irse a otro taller',
      'agenda de citas ordenada sin papeles ni solapamientos',
    ],
  },
  {
    id: 'estetica',
    label: 'Centro de estética',
    problema_core: 'clientas que quieren reservar fuera de horario y, sin respuesta inmediata, reservan en otro centro',
    palancas: [
      'reservas tomadas 24/7 incluso en pleno tratamiento',
      'huecos de última hora cubiertos automáticamente',
      'recordatorios que reducen los no-shows',
    ],
  },
  {
    id: 'veterinaria',
    label: 'Clínica veterinaria',
    problema_core: 'urgencias de mascotas fuera de horario que, sin respuesta, acaban en otra clínica',
    palancas: [
      'urgencias atendidas las 24 horas con protocolo claro',
      'propietarios fidelizados por una respuesta inmediata en el momento crítico',
      'recordatorios de revisión y vacunación que generan recurrencia',
    ],
  },
]

const NICHO_DEFAULT: NichoBrechas = {
  id: 'generico',
  label: 'Negocio local',
  problema_core: 'pierde contactos de clientes que llaman fuera de horario o cuando el equipo está ocupado atendiendo',
  palancas: [
    'cada cliente recibe respuesta inmediata sin que nadie esté pendiente del teléfono',
    'el equipo se concentra en los clientes presentes',
    'citas y consultas gestionadas automáticamente las 24 horas',
  ],
}

// Resuelve el nicho desde el sector libre del lead (case-insensitive, con sinónimos).
export function getNichoBrechas(sector: string | null): NichoBrechas {
  const key = (sector ?? '').toLowerCase().trim()
  const exact = NICHOS.find((n) => n.id === key || n.label.toLowerCase() === key)
  if (exact) return exact
  if (key.includes('dental') || key.includes('dentist')) return NICHOS.find((n) => n.id === 'dental')!
  if (key.includes('clinic') || key.includes('médic') || key.includes('medic') || key.includes('fisio')) return NICHOS.find((n) => n.id === 'clinica')!
  if (key.includes('restaur') || key.includes('bar') || key.includes('cafe') || key.includes('café')) return NICHOS.find((n) => n.id === 'restaurante')!
  if (key.includes('inmobil')) return NICHOS.find((n) => n.id === 'inmobiliaria')!
  if (key.includes('academ') || key.includes('escuela') || key.includes('formaci')) return NICHOS.find((n) => n.id === 'academia')!
  if (key.includes('taller') || key.includes('mecánic') || key.includes('mecanic')) return NICHOS.find((n) => n.id === 'taller')!
  if (key.includes('estétic') || key.includes('estetic') || key.includes('belleza') || key.includes('peluquer')) return NICHOS.find((n) => n.id === 'estetica')!
  if (key.includes('veterin') || key.includes('mascot')) return NICHOS.find((n) => n.id === 'veterinaria')!
  return NICHO_DEFAULT
}
