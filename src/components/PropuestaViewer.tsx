import ReactMarkdown from 'react-markdown'

interface Props {
  markdown: string
  nombreNegocio: string
  onMarcarEnviada?: () => void
}

// Divide el markdown en secciones por h2 para poder tratar "Inversión" como card especial
function splitSecciones(md: string): { titulo: string | null; contenido: string }[] {
  const lineas = md.split('\n').filter((l) => !l.startsWith('# ')) // h1 oculto: va en el header
  const secciones: { titulo: string | null; contenido: string }[] = []
  let actual: { titulo: string | null; contenido: string } = { titulo: null, contenido: '' }
  for (const linea of lineas) {
    if (linea.startsWith('## ')) {
      if (actual.titulo !== null || actual.contenido.trim()) secciones.push(actual)
      actual = { titulo: linea.slice(3).trim(), contenido: '' }
    } else {
      actual.contenido += linea + '\n'
    }
  }
  if (actual.titulo !== null || actual.contenido.trim()) secciones.push(actual)
  return secciones
}

const ESTILOS = `
.propuesta-doc { max-width: 800px; margin: 0 auto; box-shadow: 0 20px 60px rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden; background: #fff; }
.propuesta-header { background: linear-gradient(135deg, #6366F1 0%, #22D3EE 100%); padding: 40px; }
.propuesta-header-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.propuesta-header img { height: 40px; object-fit: contain; }
.propuesta-header-meta { color: rgba(255,255,255,0.85); font: 400 13px Inter, sans-serif; text-align: right; line-height: 1.6; }
.propuesta-negocio { color: #fff; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 28px; margin-top: 24px; }
.propuesta-body { background: #fff; padding: 40px; }
.propuesta-body h2 { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 20px; color: #09090B; border-left: 4px solid #6366F1; padding-left: 16px; margin: 40px 0 16px; }
.propuesta-body section:first-child h2 { margin-top: 0; }
.propuesta-body h3 { font: 600 16px Inter, sans-serif; color: #6366F1; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px; }
.propuesta-body p { font: 400 16px/1.8 Inter, sans-serif; color: #09090B; margin: 12px 0; }
.propuesta-body strong { color: #6366F1; font-weight: 700; }
.propuesta-body table { width: 100%; border-collapse: collapse; margin: 24px 0; }
.propuesta-body th { background: #6366F1; color: #fff; padding: 12px 16px; font: 600 14px Inter, sans-serif; text-align: left; }
.propuesta-body td { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.06); font: 400 14px Inter, sans-serif; }
.propuesta-body tr:nth-child(even) td { background: #F4F4F5; }
.propuesta-body ul { list-style: none; padding: 0; margin: 12px 0; }
.propuesta-body li { padding: 6px 0 6px 24px; position: relative; color: #09090B; font: 400 16px/1.7 Inter, sans-serif; }
.propuesta-body li::before { content: '●'; color: #6366F1; position: absolute; left: 4px; font-size: 10px; top: 12px; }
.propuesta-inversion { background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(34,211,238,0.05)); border: 2px solid rgba(99,102,241,0.2); border-radius: 16px; padding: 32px; margin: 32px 0; }
.propuesta-inversion .precio-setup { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 48px; color: #09090B; line-height: 1.1; }
.propuesta-inversion .precio-mes { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 32px; color: #6366F1; }
.propuesta-inversion .precio-label { font: 500 13px Inter, sans-serif; color: #71717A; text-transform: uppercase; letter-spacing: 0.05em; }
.badge-sin-permanencia { display: inline-block; background: rgba(34,197,94,0.12); color: #16A34A; font: 600 13px Inter, sans-serif; padding: 6px 14px; border-radius: 999px; margin-top: 16px; }
.propuesta-footer { padding: 24px 40px 32px; text-align: center; }
.propuesta-footer-sep { height: 3px; background: linear-gradient(90deg, #6366F1, #22D3EE); border-radius: 999px; margin-bottom: 20px; }
.propuesta-footer p { font: 400 12px Inter, sans-serif; color: #71717A; }
@media print {
  .no-print { display: none !important; }
  .propuesta-doc { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { page-break-before: auto; }
}
`

export default function PropuestaViewer({ markdown, nombreNegocio, onMarcarEnviada }: Props) {
  const secciones = splitSecciones(markdown)
  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <style>{ESTILOS}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={() => window.print()}>🖨️ Descargar PDF</button>
        {onMarcarEnviada && (
          <button className="btn-gradient" onClick={onMarcarEnviada}>✅ Marcar como enviada</button>
        )}
      </div>

      <div className="propuesta-doc">
        <header className="propuesta-header">
          <div className="propuesta-header-top">
            <img src="/logo-wiare.png" alt="WIARE" />
            <div className="propuesta-header-meta">
              {fecha}<br />Propuesta confidencial
            </div>
          </div>
          <div className="propuesta-negocio">{nombreNegocio}</div>
        </header>

        <div className="propuesta-body">
          {secciones.map((sec, i) => {
            const esInversion = sec.titulo?.toLowerCase().includes('inversión')
            if (esInversion) {
              const setup = sec.contenido.match(/(\d[\d.]*)\s*€(?!\s*\/)/)?.[1] ?? '790'
              const mes = sec.contenido.match(/(\d[\d.]*)\s*€\s*\/\s*mes/)?.[1]
              return (
                <section key={i}>
                  <h2>{sec.titulo}</h2>
                  <div className="propuesta-inversion">
                    <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <div className="precio-label">Setup inicial</div>
                        <div className="precio-setup">{setup}€</div>
                      </div>
                      {mes && (
                        <div>
                          <div className="precio-label">Mantenimiento</div>
                          <div className="precio-mes">{mes}€/mes</div>
                        </div>
                      )}
                    </div>
                    <span className="badge-sin-permanencia">✓ Sin permanencia</span>
                  </div>
                </section>
              )
            }
            return (
              <section key={i}>
                {sec.titulo && <h2>{sec.titulo}</h2>}
                <ReactMarkdown>{sec.contenido}</ReactMarkdown>
              </section>
            )
          })}
        </div>

        <footer className="propuesta-footer">
          <div className="propuesta-footer-sep" />
          <p>WIARE · holawiare@gmail.com · wiare.vercel.app</p>
        </footer>
      </div>
    </div>
  )
}
