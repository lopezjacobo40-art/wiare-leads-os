import { useEffect, useState } from 'react'
import { X, FloppyDisk, Trash } from '@phosphor-icons/react'
import { useToast } from '../Toast'
import {
  crearIdea, actualizarIdea, borrarIdea,
  FORMATO_LABELS, FORMATOS_ACTIVOS, IDEA_ESTADOS,
  type ContentIdea, type ContentPillar, type IdeaEstado, type IdeaFormato,
} from '../../lib/contentIdeas'

/* ─────────────────────────────────────────────
   Dialog de crear/editar publicación del Instagram Manager.
   Compartido por el manager y el calendario.
   Regla: estado "Programado" exige fecha de publicación.
   ───────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: '#fff',
  color: 'var(--color-text-primary)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
}

/* timestamptz ISO → valor de <input type="datetime-local"> (hora local) */
function isoALocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function IdeaEditDialog({
  idea, pillars, onClose, onSaved,
}: {
  idea: ContentIdea | null   // null = crear nueva
  pillars: ContentPillar[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState('')
  const [gancho, setGancho] = useState('')
  const [caption, setCaption] = useState('')
  const [formato, setFormato] = useState<IdeaFormato>('post')
  const [estado, setEstado] = useState<IdeaEstado>('idea')
  const [fecha, setFecha] = useState('')
  const [pilarId, setPilarId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  useEffect(() => {
    setTitulo(idea?.titulo ?? '')
    setGancho(idea?.gancho ?? '')
    setCaption(idea?.caption ?? '')
    setFormato(idea?.formato ?? 'post')
    setEstado(idea?.estado ?? 'idea')
    setFecha(isoALocal(idea?.fecha_publicacion))
    setPilarId(idea?.pilar_id ?? '')
    setConfirmandoBorrado(false)
  }, [idea])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  // Formatos: los activos + el legacy de la idea si lo tuviera (video/secuencia)
  const formatos: IdeaFormato[] = FORMATOS_ACTIVOS.includes(formato)
    ? FORMATOS_ACTIVOS
    : [...FORMATOS_ACTIVOS, formato]

  const guardar = async () => {
    if (!titulo.trim()) { toast('Ponle un título a la publicación', 'error'); return }
    if (estado === 'listo' && !fecha) {
      toast('Para programarla necesita fecha de publicación', 'error')
      return
    }
    setGuardando(true)
    const patch = {
      titulo: titulo.trim(),
      gancho: gancho.trim() || null,
      caption: caption.trim() || null,
      formato,
      estado,
      fecha_publicacion: fecha ? new Date(fecha).toISOString() : null,
      pilar_id: pilarId || null,
    }
    const { error } = idea
      ? await actualizarIdea(idea.id, patch)
      : await crearIdea(patch)
    setGuardando(false)
    if (error) { toast(error, 'error'); return }
    toast(idea ? 'Publicación actualizada' : 'Publicación creada', 'success')
    onSaved()
    onClose()
  }

  const borrar = async () => {
    if (!idea) return
    if (!confirmandoBorrado) { setConfirmandoBorrado(true); return }
    const { error } = await borrarIdea(idea.id)
    if (error) { toast(error, 'error'); return }
    toast('Publicación eliminada', 'success')
    onSaved()
    onClose()
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.4)', zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={idea ? 'Editar publicación' : 'Nueva publicación'}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 61,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            {idea ? 'Editar publicación' : 'Nueva publicación'}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Cerrar" style={{ padding: 6, minHeight: 32, minWidth: 32 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="idea-titulo">Título</label>
            <input id="idea-titulo" style={inputStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Tema del post" />
          </div>

          <div>
            <label style={labelStyle} htmlFor="idea-gancho">Gancho (primera frase)</label>
            <input id="idea-gancho" style={inputStyle} value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="La frase que para el scroll" />
          </div>

          <div>
            <label style={labelStyle} htmlFor="idea-caption">Caption</label>
            <textarea
              id="idea-caption"
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption completo para Instagram"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="idea-formato">Tipo</label>
              <select id="idea-formato" style={inputStyle} value={formato} onChange={(e) => setFormato(e.target.value as IdeaFormato)}>
                {formatos.map((f) => <option key={f} value={f}>{FORMATO_LABELS[f]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="idea-estado">Estado</label>
              <select id="idea-estado" style={inputStyle} value={estado} onChange={(e) => setEstado(e.target.value as IdeaEstado)}>
                {IDEA_ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="idea-fecha">Fecha de publicación</label>
              <input id="idea-fecha" type="datetime-local" style={inputStyle} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="idea-pilar">Pilar</label>
              <select id="idea-pilar" style={inputStyle} value={pilarId} onChange={(e) => setPilarId(e.target.value)}>
                <option value="">Sin pilar</option>
                {pillars.map((p) => <option key={p.id} value={p.id}>{p.nombre_pilar}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
          {idea ? (
            <button
              className="btn-ghost"
              onClick={borrar}
              style={{ color: 'var(--color-error)', fontSize: 13 }}
            >
              <Trash size={14} /> {confirmandoBorrado ? '¿Seguro? Click para confirmar' : 'Eliminar'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={guardar} disabled={guardando}>
              <FloppyDisk size={14} /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
