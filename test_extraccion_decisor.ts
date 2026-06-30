import { extraerLeadsConApify, buscarDecisorLinkedIn, generarPermutacionesEmail } from './src/lib/apifyClient.ts'
import { extraerDatosDecisor } from './src/lib/claudeApi.ts'

async function run() {
  console.log('Iniciando extracción de 10 clínicas en Madrid...')
  try {
    const leads = await extraerLeadsConApify('Clínica', 'Madrid', 10, (msg) => console.log('Progreso:', msg))
    console.log(`\nExtraídos ${leads.length} leads. Buscando decisores...`)
    
    for (const lead of leads) {
      console.log(`\n--- Analizando: ${lead.title} ---`)
      const res = await buscarDecisorLinkedIn(lead.title, lead.city || 'Madrid')
      
      if (!res) {
        console.log('❌ No se encontró LinkedIn para:', lead.title)
        continue
      }
      
      console.log('✅ LinkedIn encontrado. Pasando a Claude...')
      const datos = await extraerDatosDecisor(res.textSnippet, lead.title)
      
      if (!datos) {
        console.log('❌ Claude no encontró un decisor claro en el snippet:', res.textSnippet)
        continue
      }
      
      console.log(`🎯 Decisor: ${datos.nombre} (${datos.cargo})`)
      
      let dominio = lead.website
      if (!dominio && lead.email) {
        dominio = lead.email.split('@')[1]
      }
      
      if (dominio) {
        const perms = generarPermutacionesEmail(datos.nombre, dominio)
        console.log(`📧 Permutaciones generadas:`, perms.slice(0, 3), '...')
      } else {
        console.log(`⚠️ Sin dominio web para generar emails.`)
      }
    }
  } catch (err) {
    console.error('Error general:', err)
  }
}

run()
