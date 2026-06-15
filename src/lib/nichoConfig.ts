export interface NichoConfig {
  id: string
  label: string
  // Slide 1
  tagline: string
  // Slide 2
  estadistica: string
  pain_points: { titulo: string; descripcion: string }[]
  // Slide 3 — cifras de pérdida de referencia para el sector
  perdida_mensual_ref: number
  sin_sistema: string[]
  con_sistema: string[]
  // Slide 4
  beneficios: { icono: string; titulo: string; descripcion: string }[]
  // Slide 5
  pasos: string[]
  // Slide 6
  pregunta: string
  // Slide 7
  cta: string
}

const NICHOS: NichoConfig[] = [
  {
    id: 'restaurante',
    label: 'Restaurante',
    tagline: 'Tu restaurante lleno cada noche, sin perder una sola reserva',
    estadistica: '68% de las reservas se intentan fuera del horario de servicio',
    pain_points: [
      { titulo: 'Llamadas perdidas en hora punta', descripcion: 'Cuando más trabajo tienes, menos puedes atender el teléfono. Cada llamada que no coges es una mesa vacía.' },
      { titulo: 'Sin recepcionista 24/7', descripcion: 'Fuera de horario no hay nadie para tomar reservas. Los clientes llaman, no encuentran respuesta y van a la competencia.' },
      { titulo: 'Gestión manual de reservas', descripcion: 'Anotar reservas a mano o en papel genera errores, duplicados y cancelaciones de última hora.' },
    ],
    perdida_mensual_ref: 1200,
    sin_sistema: ['Mesas vacías por reservas no tomadas', 'Clientes que no vuelven', 'No-shows sin confirmación previa'],
    con_sistema: ['Reservas tomadas a las 2am', 'Confirmación automática con recordatorio', 'Cero llamadas perdidas en servicio'],
    beneficios: [
      { icono: 'PhoneCall', titulo: 'Reservas 24/7', descripcion: 'Tu restaurante acepta reservas en cualquier momento, incluso mientras estás en pleno servicio.' },
      { icono: 'CalendarCheck', titulo: 'Confirmación automática', descripcion: 'Cada reserva se confirma y recuerda automáticamente. Reduce no-shows hasta un 40%.' },
      { icono: 'ChartLineUp', titulo: 'Más ocupación, menos estrés', descripcion: 'Sin llamadas interrumpiendo el servicio. Tu equipo se concentra en los clientes presentes.' },
    ],
    pasos: ['Reunión de 30 min para configurar la IA con el menú y horarios', 'Prueba piloto de 48h con llamadas reales', 'Activación y primeras reservas tomadas automáticamente'],
    pregunta: '¿Cuántas reservas perdiste la semana pasada por no poder atender el teléfono?',
    cta: 'Empieza esta semana y llena tu restaurante esta noche',
  },
  {
    id: 'clinica',
    label: 'Clínica médica',
    tagline: 'Cero llamadas perdidas. Tu clínica disponible las 24 horas',
    estadistica: '1 de cada 3 pacientes llama fuera del horario de consulta',
    pain_points: [
      { titulo: 'Pacientes sin atender', descripcion: 'Las llamadas fuera de horario quedan sin respuesta. El paciente busca otra clínica y no vuelve.' },
      { titulo: 'Recepción saturada', descripcion: 'Tu recepcionista no puede atender el teléfono y a los pacientes en sala al mismo tiempo. Siempre hay una espera.' },
      { titulo: 'Agenda sin optimizar', descripcion: 'Los huecos de última hora se quedan vacíos porque nadie llama justo cuando hay disponibilidad.' },
    ],
    perdida_mensual_ref: 1800,
    sin_sistema: ['Llamadas perdidas fuera de horario', 'Recepcionista desbordada', 'Huecos en la agenda no cubiertos'],
    con_sistema: ['Citas tomadas a las 11pm', 'Recepcionista libre para atender en sala', 'Agenda optimizada automáticamente'],
    beneficios: [
      { icono: 'FirstAid', titulo: 'Atención 24/7', descripcion: 'Los pacientes pueden pedir cita en cualquier momento, incluso cuando la clínica está cerrada.' },
      { icono: 'CalendarCheck', titulo: 'Agenda optimizada', descripcion: 'Rellena huecos automáticamente y reduce cancelaciones con recordatorios previos a la cita.' },
      { icono: 'UserCircle', titulo: 'Recepcionista enfocada', descripcion: 'Tu equipo deja de gestionar llamadas y se dedica a los pacientes que ya están en consulta.' },
    ],
    pasos: ['Configuración personalizada con tus especialidades y horarios', 'Integración con tu agenda actual en 48h', 'Activación y primeros pacientes atendidos'],
    pregunta: '¿Cuántos pacientes perdiste este mes por no poder atender fuera de horario?',
    cta: 'Activa tu recepcionista virtual esta semana',
  },
  {
    id: 'dental',
    label: 'Clínica dental',
    tagline: 'Tu clínica dental capta pacientes mientras tú trabajas con la boca cerrada',
    estadistica: '72% de los pacientes nuevos llaman una sola vez y no dejan mensaje',
    pain_points: [
      { titulo: 'Primera llamada sin respuesta', descripcion: 'Un paciente nuevo llama, nadie coge, y se va a la siguiente clínica de Google. No hay segunda oportunidad.' },
      { titulo: 'Miedo al dentista, facilidad de abandonar', descripcion: 'El paciente ya necesita convencerse. Si además no le cogen el teléfono, la excusa perfecta para no ir.' },
      { titulo: 'Horas de trabajo no facturables en teléfono', descripcion: 'Tu auxiliar pasa tiempo en llamadas que podría dedicar a preparar tratamientos y mejorar la experiencia del paciente.' },
    ],
    perdida_mensual_ref: 2200,
    sin_sistema: ['Nuevos pacientes captados por la competencia', 'Auxiliar saturada con el teléfono', 'Huecos sin cubrir en la agenda'],
    con_sistema: ['Primera llamada siempre atendida', 'Nuevos pacientes captados automáticamente', 'Auxiliar enfocada en tratamientos'],
    beneficios: [
      { icono: 'Tooth', titulo: 'Capta más pacientes', descripcion: 'Nunca más perdes un paciente nuevo por no coger la primera llamada. Tu agenda se llena sola.' },
      { icono: 'ClockCounterClockwise', titulo: 'Disponible 24/7', descripcion: 'Pacientes que deciden llamar a las 10pm tienen alguien que les atiende y agenda su primera visita.' },
      { icono: 'TrendUp', titulo: 'Más facturación', descripcion: 'Cada paciente nuevo que retienes tiene un valor de ciclo de vida de cientos o miles de euros.' },
    ],
    pasos: ['Configuración con tus tratamientos, precios orientativos y horarios', 'Prueba con llamadas reales de 48h', 'Activación completa y captación automática'],
    pregunta: '¿Cuántos presupuestos de ortodoncia o implantes perdiste este mes por no coger el teléfono?',
    cta: 'Empieza esta semana y capta tus primeros pacientes automáticamente',
  },
  {
    id: 'inmobiliaria',
    label: 'Inmobiliaria',
    tagline: 'Cada llamada puede ser una venta de 200.000€ — no te la puedes perder',
    estadistica: 'El 61% de los compradores llaman fuera del horario de oficina',
    pain_points: [
      { titulo: 'Clientes que compran el fin de semana', descripcion: 'Los compradores buscan pisos por la tarde y el fin de semana. Si no hay nadie para atenderles, se van con la competencia.' },
      { titulo: 'Agentes en visitas no pueden atender llamadas', descripcion: 'Cuando tu agente está mostrando un piso no puede atender el teléfono. Cada llamada perdida es una operación menos.' },
      { titulo: 'Captación de propietarios 24/7', descripcion: 'Los propietarios que quieren vender deciden llamar cuando deciden. Si no hay respuesta, llaman a otra agencia.' },
    ],
    perdida_mensual_ref: 3500,
    sin_sistema: ['Compradores que llaman el sábado y no encuentran a nadie', 'Captaciones perdidas a la competencia', 'Agentes en visita = teléfono sin atender'],
    con_sistema: ['Cada llamada atendida, 7 días a la semana', 'Captación de propietarios automatizada', 'Agentes enfocados en cerrar operaciones'],
    beneficios: [
      { icono: 'HouseLine', titulo: 'Sin operaciones perdidas', descripcion: 'Cada llamada de comprador o propietario es atendida y cualificada automáticamente.' },
      { icono: 'CalendarCheck', titulo: 'Visitas agendadas 24/7', descripcion: 'Los compradores que llaman el domingo tienen su visita agendada antes del lunes.' },
      { icono: 'UsersThree', titulo: 'Más captaciones', descripcion: 'Los propietarios que quieren vender siempre encuentran alguien disponible en tu agencia.' },
    ],
    pasos: ['Configuración con tus zonas, tipos de inmueble y precios', 'Integración con tu CRM actual en 48h', 'Activación y primeras visitas agendadas automáticamente'],
    pregunta: '¿Cuántas operaciones perdiste este mes por no estar disponible cuando el cliente llamó?',
    cta: 'Activa tu agente esta semana y no pierdas ninguna operación más',
  },
  {
    id: 'academia',
    label: 'Academia / Centro de formación',
    tagline: 'Tu academia capta alumnos mientras impartes clase',
    estadistica: '55% de las consultas de academias se realizan fuera del horario lectivo',
    pain_points: [
      { titulo: 'Llamadas durante las clases', descripcion: 'Cuando estás impartiendo clase no puedes atender consultas. El potencial alumno llama una vez y no vuelve a intentarlo.' },
      { titulo: 'Proceso de matrícula lento', descripcion: 'Entre la primera llamada y la matrícula pasan días. En ese tiempo el alumno puede apuntarse a otra academia.' },
      { titulo: 'Sin información 24/7', descripcion: 'Los padres y alumnos buscan información por la tarde o el fin de semana. Si no encuentran respuesta, buscan otra opción.' },
    ],
    perdida_mensual_ref: 900,
    sin_sistema: ['Alumnos que se apuntan a la competencia', 'Matrículas perdidas por proceso lento', 'Director interrumpido durante clases'],
    con_sistema: ['Consultas atendidas mientras das clase', 'Proceso de matrícula ágil y automático', 'Información disponible 24/7'],
    beneficios: [
      { icono: 'GraduationCap', titulo: 'Más matrículas', descripcion: 'Ningún alumno potencial queda sin atender, independientemente de tu horario lectivo.' },
      { icono: 'Chalkboard', titulo: 'Clases sin interrupciones', descripcion: 'Tus profesores dan clase sin que el teléfono interrumpa. Mejor experiencia para todos.' },
      { icono: 'ChartLineUp', titulo: 'Crecimiento sostenible', descripcion: 'Tu academia crece de forma automática sin necesidad de contratar personal administrativo.' },
    ],
    pasos: ['Configuración con cursos, precios y calendario de la academia', 'Prueba con consultas reales en 48h', 'Activación y primeras matrículas gestionadas automáticamente'],
    pregunta: '¿Cuántos alumnos nuevos perdiste este trimestre por no poder atender durante las clases?',
    cta: 'Empieza esta semana y llena tus cursos automáticamente',
  },
  {
    id: 'taller',
    label: 'Taller mecánico',
    tagline: 'Tu taller siempre disponible, incluso cuando tienes las manos en el motor',
    estadistica: 'El 45% de los conductores buscan taller de urgencia fuera del horario habitual',
    pain_points: [
      { titulo: 'Manos sucias, teléfono sonando', descripcion: 'Cuando estás debajo de un coche no puedes atender llamadas. Cada una que pierdes es un cliente que va a otro taller.' },
      { titulo: 'Urgencias que no puedes captar', descripcion: 'Las averías no avisan. Un cliente con una urgencia de madrugada o el fin de semana no puede esperar.' },
      { titulo: 'Citas sin sistema', descripcion: 'Gestionar citas entre el trabajo del taller es caótico. Se solapan, se olvidan, los clientes esperan demasiado.' },
    ],
    perdida_mensual_ref: 1100,
    sin_sistema: ['Llamadas perdidas en pleno trabajo', 'Urgencias que van a la competencia', 'Citas desorganizadas y retrasos'],
    con_sistema: ['Teléfono siempre atendido', 'Urgencias captadas las 24h', 'Agenda de citas ordenada automáticamente'],
    beneficios: [
      { icono: 'Wrench', titulo: 'Trabaja sin interrupciones', descripcion: 'Atiende a tu cliente en el taller mientras la IA atiende las llamadas. Doble productividad.' },
      { icono: 'ClockCounterClockwise', titulo: 'Urgencias 24/7', descripcion: 'Los conductores con avería siempre encuentran tu taller disponible, no al de la competencia.' },
      { icono: 'CalendarCheck', titulo: 'Agenda optimizada', descripcion: 'Las citas se gestionan solas. Sin papel, sin olvidos, sin solapamientos.' },
    ],
    pasos: ['Configuración con tus servicios, precios orientativos y horario', 'Prueba con llamadas reales en 48h', 'Activación y primeras citas gestionadas automáticamente'],
    pregunta: '¿Cuántos clientes llamaron esta semana mientras tenías las manos ocupadas y no pudiste atender?',
    cta: 'Activa tu taller 24/7 esta semana',
  },
  {
    id: 'estetica',
    label: 'Centro de estética',
    tagline: 'Tu centro de belleza siempre disponible para tus clientas',
    estadistica: '63% de las citas de estética se intentan reservar fuera del horario de atención',
    pain_points: [
      { titulo: 'Imposible atender y hacer tratamientos a la vez', descripcion: 'Cuando tienes las manos sobre una clienta no puedes atender el teléfono. Las llamadas se pierden.' },
      { titulo: 'Clientas que buscan hueco de última hora', descripcion: 'Una clienta quiere depilación mañana a primera hora y llama a las 10pm. Nadie coge y llama a otro centro.' },
      { titulo: 'Sin recordatorios = no-shows', descripcion: 'Sin un sistema de recordatorio, el 20% de las clientas no se presenta. Tiempo y dinero perdidos.' },
    ],
    perdida_mensual_ref: 800,
    sin_sistema: ['Llamadas perdidas en tratamiento', 'Huecos de última hora sin cubrir', 'No-shows sin recordatorio'],
    con_sistema: ['Citas tomadas mientras haces tratamientos', 'Huecos cubiertos automáticamente', 'Recordatorios que reducen no-shows'],
    beneficios: [
      { icono: 'Sparkle', titulo: 'Citas 24/7', descripcion: 'Tu clienta puede reservar a cualquier hora. Incluso mientras estás en pleno tratamiento.' },
      { icono: 'Bell', titulo: 'Cero no-shows', descripcion: 'Recordatorio automático 24h antes de cada cita. Reduce ausencias hasta el 40%.' },
      { icono: 'ChartLineUp', titulo: 'Agenda siempre llena', descripcion: 'Los huecos de última hora se cubren solos. Más facturación sin más esfuerzo.' },
    ],
    pasos: ['Configuración con tus servicios, precios y horario de apertura', 'Prueba con citas reales en 48h', 'Activación y primeras reservas gestionadas automáticamente'],
    pregunta: '¿Cuántas clientas nuevas perdiste este mes porque nadie pudo atender mientras hacías un tratamiento?',
    cta: 'Llena tu agenda esta semana con cero esfuerzo',
  },
  {
    id: 'veterinaria',
    label: 'Clínica veterinaria',
    tagline: 'Cuando la mascota no puede esperar, tú siempre estás ahí',
    estadistica: 'El 40% de las urgencias veterinarias ocurren fuera del horario habitual',
    pain_points: [
      { titulo: 'Urgencias que no pueden esperar', descripcion: 'Un perro enfermo a las 11pm no puede esperar al día siguiente. Si no encuentran tu clínica disponible, van a otra.' },
      { titulo: 'Propietarios angustiados que necesitan respuesta', descripcion: 'Un dueño con la mascota enferma está en modo urgencia. Si no atienden, la experiencia es terrible y no vuelven.' },
      { titulo: 'Citas de revisión mal gestionadas', descripcion: 'Sin un sistema de recordatorio, los propietarios olvidan las revisiones anuales. Menos ingresos recurrentes.' },
    ],
    perdida_mensual_ref: 1400,
    sin_sistema: ['Urgencias nocturnas sin atender', 'Propietarios que van a otra clínica', 'Revisiones olvidadas = menos recurrencia'],
    con_sistema: ['Urgencias atendidas las 24h', 'Propietarios tranquilos con respuesta inmediata', 'Recordatorios de revisión automáticos'],
    beneficios: [
      { icono: 'PawPrint', titulo: 'Urgencias 24/7', descripcion: 'Tu clínica siempre tiene alguien que atiende, incluso de madrugada. Los propietarios confían en ti.' },
      { icono: 'Heart', titulo: 'Fidelización', descripcion: 'Un dueño que fue atendido en la urgencia se convierte en cliente de por vida. Y recomienda tu clínica.' },
      { icono: 'Bell', titulo: 'Revisiones automáticas', descripcion: 'Recordatorios de vacunación y revisión anual. Más ingresos recurrentes sin esfuerzo.' },
    ],
    pasos: ['Configuración con tus servicios, urgencias y horario de guardia', 'Prueba con llamadas reales en 48h', 'Activación y primeras urgencias gestionadas'],
    pregunta: '¿Cuántos propietarios llamaron esta semana fuera de horario y fueron a otra clínica?',
    cta: 'Activa tu clínica 24/7 y no pierdas ninguna urgencia más',
  },
]

const NICHO_DEFAULT: NichoConfig = {
  id: 'generico',
  label: 'Negocio local',
  tagline: 'Tu negocio disponible las 24 horas, sin perder ni una sola llamada',
  estadistica: 'El 60% de las llamadas a negocios locales no reciben respuesta fuera de horario',
  pain_points: [
    { titulo: 'Llamadas perdidas fuera de horario', descripcion: 'Cuando el negocio está cerrado, los clientes llaman y no encuentran respuesta. Van a la competencia.' },
    { titulo: 'Personal saturado', descripcion: 'Tu equipo no puede atender el teléfono y trabajar con los clientes al mismo tiempo.' },
    { titulo: 'Sin sistema de citas', descripcion: 'Gestionar citas manualmente genera errores y pérdida de clientes.' },
  ],
  perdida_mensual_ref: 1000,
  sin_sistema: ['Llamadas perdidas fuera de horario', 'Clientes que van a la competencia', 'Agenda desorganizada'],
  con_sistema: ['Atención 24/7 automatizada', 'Cero clientes perdidos por falta de respuesta', 'Agenda gestionada automáticamente'],
  beneficios: [
    { icono: 'Phone', titulo: 'Disponibilidad 24/7', descripcion: 'Tu negocio siempre disponible, sin importar el horario.' },
    { icono: 'CalendarCheck', titulo: 'Citas automáticas', descripcion: 'Las citas se gestionan solas, sin intervención de tu equipo.' },
    { icono: 'ChartLineUp', titulo: 'Más ingresos', descripcion: 'Capta más clientes sin aumentar tu equipo ni tus costes.' },
  ],
  pasos: ['Reunión de configuración de 30 min', 'Prueba piloto de 48h', 'Activación completa'],
  pregunta: '¿Cuántos clientes perdiste esta semana por no poder atender el teléfono?',
  cta: 'Activa tu sistema esta semana',
}

export function getNicho(sector: string): NichoConfig {
  const s = sector.toLowerCase()
  return (
    NICHOS.find((n) =>
      s.includes(n.id) ||
      s.includes(n.label.toLowerCase().split(' ')[0])
    ) ?? NICHO_DEFAULT
  )
}
