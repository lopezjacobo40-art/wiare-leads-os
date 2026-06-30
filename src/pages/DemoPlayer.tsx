import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Headphones, LockKey } from '@phosphor-icons/react'

export default function DemoPlayer() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<{ nombre: string; demo_audio_url: string | null } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return

    async function loadAndTrack() {
      try {
        // 1. Cargar datos del lead (solo lo necesario)
        const { data: leadData, error: leadError } = await supabase
          .from('leads_os')
          .select('nombre, demo_audio_url')
          .eq('id', id)
          .single()

        if (leadError || !leadData || !leadData.demo_audio_url) {
          setError(true)
          setLoading(false)
          return
        }

        setLead(leadData)
        setLoading(false)

        // 2. Registrar evento de telemetría (Radar)
        // Ignorar si falla, para no romper la experiencia
        await supabase.from('telemetria_os').insert({
          lead_id: id,
          evento: 'demo_escuchada'
        })
      } catch (err) {
        setError(true)
        setLoading(false)
      }
    }

    loadAndTrack()
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D12' }}>
        <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0D0D12', color: '#fff', padding: 24, textAlign: 'center' }}>
        <LockKey size={48} color="rgba(255,255,255,0.2)" weight="duotone" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Demo no disponible</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Este enlace ha caducado o no es válido.</p>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0D0D12', // Preset Midnight Luxe
      color: '#FAF8F5',
      padding: 24,
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        background: '#1A1A24',
        borderRadius: 24,
        padding: 32,
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #A18231)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
          boxShadow: '0 8px 16px rgba(201, 168, 76, 0.2)'
        }}>
          <Headphones size={32} weight="fill" color="#0D0D12" />
        </div>
        
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Agente IA para {lead.nombre}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32, lineHeight: 1.5 }}>
          Escucha cómo sonaría tu propia recepcionista IA contestando llamadas 24/7.
        </p>

        <div style={{ background: '#0D0D12', padding: '16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
          <audio 
            src={lead.demo_audio_url || undefined} 
            controls 
            autoPlay 
            style={{ width: '100%', outline: 'none' }} 
            controlsList="nodownload noplaybackrate"
          />
        </div>
        
        <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Propuesta privada
        </div>
      </div>
    </div>
  )
}
