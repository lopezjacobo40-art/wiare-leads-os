import { useEffect, useState } from 'react'
import { FloppyDisk, Palette, TextAa, Image as ImageIcon, Megaphone } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import { useToast } from '../../components/Toast'
import { useBrandKit, updateBrandKit, type BrandColores, type BrandFuentes } from '../../lib/brandKit'

/* Panel de Brand Kit: ver y editar los valores de marca (logo, colores, fuentes,
   tono de voz) sin tocar código. Es la fuente que consume todo el módulo de Content. */

const COLOR_LABELS: Record<keyof BrandColores, string> = {
  fondo: 'Fondo',
  indigo: 'Indigo (primario)',
  cyan: 'Cyan (secundario)',
}
const FUENTE_LABELS: Record<keyof BrandFuentes, string> = {
  headings: 'Títulos',
  body: 'Cuerpo',
}

function Seccion({ icon: Icon, titulo, children }: { icon: typeof Palette; titulo: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <Icon size={18} weight="fill" style={{ color: 'var(--color-primary)' }} /> {titulo}
      </h2>
      {children}
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  height: 40,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: '0 12px',
  fontSize: 14,
  width: '100%',
}

export default function BrandKit() {
  const toast = useToast()
  const { brand, loading, refresh } = useBrandKit()

  const [logoUrl, setLogoUrl] = useState('')
  const [colores, setColores] = useState<BrandColores>({ fondo: '', indigo: '', cyan: '' })
  const [fuentes, setFuentes] = useState<BrandFuentes>({ headings: '', body: '' })
  const [tono, setTono] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Rellena el formulario cuando llega el brand kit
  useEffect(() => {
    if (!brand) return
    setLogoUrl(brand.logo_url ?? '')
    setColores(brand.colores)
    setFuentes(brand.fuentes)
    setTono(brand.tono_voz ?? '')
  }, [brand])

  const guardar = async () => {
    if (!brand) return
    setGuardando(true)
    const { error } = await updateBrandKit(brand.id, {
      logo_url: logoUrl.trim() || null,
      colores,
      fuentes,
      tono_voz: tono.trim() || null,
    })
    setGuardando(false)
    if (error) {
      toast(`Error al guardar: ${error}`, 'error')
    } else {
      await refresh()
      toast('Brand kit actualizado', 'success')
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <PageHeader titulo="Brand Kit" subtitulo="Identidad de marca del módulo de contenido" />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      </PageTransition>
    )
  }

  if (!brand) {
    return (
      <PageTransition>
        <PageHeader titulo="Brand Kit" subtitulo="Identidad de marca del módulo de contenido" />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No se encontró el brand kit en la base de datos.
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <PageHeader
        titulo="Brand Kit"
        subtitulo="Estos valores alimentan todo el contenido generado. Edítalos sin tocar código."
        acciones={
          <button className="btn-primary" onClick={guardar} disabled={guardando} style={{ gap: 6 }}>
            {guardando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <FloppyDisk size={15} weight="fill" />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        }
      />

      <div style={{ maxWidth: 760 }}>
        {/* ── Logo ── */}
        <Seccion icon={ImageIcon} titulo="Logo">
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 120,
                height: 80,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: colores.fondo || '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ maxWidth: '80%', maxHeight: '70%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Sin logo</span>
              )}
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                URL del logo
              </label>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/logo-wiare.png" style={inputStyle} />
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                Ruta pública (empieza por /) o URL completa. Recomendado SVG o PNG grande para los carruseles.
              </p>
            </div>
          </div>
        </Seccion>

        {/* ── Colores ── */}
        <Seccion icon={Palette} titulo="Colores">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {(Object.keys(COLOR_LABELS) as (keyof BrandColores)[]).map((clave) => (
              <div key={clave}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  {COLOR_LABELS[clave]}
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={colores[clave] || '#000000'}
                    onChange={(e) => setColores((c) => ({ ...c, [clave]: e.target.value.toUpperCase() }))}
                    aria-label={`Selector de color ${COLOR_LABELS[clave]}`}
                    style={{ width: 44, height: 40, padding: 2, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    value={colores[clave]}
                    onChange={(e) => setColores((c) => ({ ...c, [clave]: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        {/* ── Fuentes ── */}
        <Seccion icon={TextAa} titulo="Fuentes">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {(Object.keys(FUENTE_LABELS) as (keyof BrandFuentes)[]).map((clave) => (
              <div key={clave}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
                  {FUENTE_LABELS[clave]}
                </label>
                <input
                  value={fuentes[clave]}
                  onChange={(e) => setFuentes((f) => ({ ...f, [clave]: e.target.value }))}
                  style={inputStyle}
                />
                {/* Vista previa con la fuente indicada (si está cargada en el navegador) */}
                <p style={{ fontFamily: `'${fuentes[clave]}', sans-serif`, fontSize: 22, marginTop: 10, color: 'var(--color-text-primary)' }}>
                  {fuentes[clave] || 'Nombre de la fuente'}
                </p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* ── Tono de voz ── */}
        <Seccion icon={Megaphone} titulo="Tono de voz">
          <textarea
            value={tono}
            onChange={(e) => setTono(e.target.value)}
            rows={5}
            placeholder="Describe cómo suena la marca: estilo, referencias, qué evitar…"
            style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}
          />
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
            Se usa como guía de estilo cuando la IA genera ideas y copy.
          </p>
        </Seccion>

        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
          Última actualización: {new Date(brand.actualizado_en).toLocaleString('es-ES')}
        </p>
      </div>
    </PageTransition>
  )
}
