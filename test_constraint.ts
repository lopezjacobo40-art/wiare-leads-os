import { supabase } from './src/lib/supabaseClient'

async function checkConstraint() {
  const { data: lead, error: fetchErr } = await supabase
    .from('leads_os')
    .select('id, fase')
    .limit(1)
    .single()
  
  if (fetchErr) {
    console.error('Fetch error:', fetchErr)
    return
  }
  
  console.log('Original lead phase:', lead.fase)
  
  console.log('Testing update to phase = descartado...')
  const { error: updateErr } = await supabase
    .from('leads_os')
    .update({ fase: 'descartado' })
    .eq('id', lead.id)
  
  if (updateErr) {
    console.error('Update error (constraint check failed?):', updateErr)
  } else {
    console.log('Update success! No check constraint on phase.')
    // Restore
    await supabase.from('leads_os').update({ fase: lead.fase }).eq('id', lead.id)
  }
}

checkConstraint()
