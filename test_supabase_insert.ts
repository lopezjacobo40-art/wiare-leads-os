import { supabase } from './src/lib/supabaseClient'

async function run() {
  const sessionId = crypto.randomUUID()
  const runId = 'test_run_id'
  const sectorFinal = 'Clínica'
  const ciudad = 'Madrid'
  
  console.log('Inserting into extracciones_os...')
  const { data, error } = await supabase.from('extracciones_os').insert({
    sector: sectorFinal,
    ciudad: ciudad.trim(),
    total_leads: 0,
    estado: 'procesando',
    extraccion_id: sessionId,
    run_id: runId
  })
  
  if (error) {
    console.error('Error inserting extraccion:', error)
  } else {
    console.log('Inserted extraccion:', data)
  }

  console.log('Inserting into leads_os...')
  const { data: insData, error: insError } = await supabase
    .from('leads_os')
    .insert([{
      nombre: 'Clínica Test',
      sector: sectorFinal,
      telefono: '123456789',
      email: null,
      email_fuente: null,
      email_verificado: false,
      web: 'https://test.com',
      google_maps_url: 'https://maps.test',
      google_place_id: 'test_place_id_' + Date.now(),
      valoracion: 4.5,
      num_resenas: 10,
      direccion: 'Calle Test',
      ciudad: ciudad.trim(),
      horario: ['Lunes: 10:00-14:00'],
      descripcion: 'Test desc',
      fuente: 'extraccion',
      fase: 'nuevo',
      creado_por: 'test',
      extraccion_id: sessionId,
      extraccion_fecha: new Date().toISOString(),
    }])
  
  if (insError) {
    console.error('Error inserting lead:', insError)
  } else {
    console.log('Inserted lead!')
  }
}

run()
