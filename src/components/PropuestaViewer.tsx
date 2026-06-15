import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { DownloadSimple, CheckSquare, CheckCircle } from '@phosphor-icons/react'

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
.propuesta-doc {
  max-width: 794px; margin: 0 auto; background: #fff;
  box-shadow: var(--shadow-lg); border-radius: var(--radius-xl); overflow: hidden;
}

/* ── Cabecera ── */
.propuesta-header { background: var(--gradient-brand); padding: 40px 48px 32px; }
.propuesta-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.propuesta-header img { height: 32px; object-fit: contain; }
.propuesta-header-meta { color: rgba(255,255,255,0.7); font: 400 13px Inter, sans-serif; text-align: right; }
.propuesta-confidencial {
  display: inline-block; margin-top: 6px;
  background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3);
  font: 600 10px Inter, sans-serif; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 3px 10px; border-radius: 999px;
}
.propuesta-para { color: rgba(255,255,255,0.8); font: 400 14px Inter, sans-serif; margin-top: 24px; }
.propuesta-negocio { color: #fff; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 32px; line-height: 1.1; margin-top: 4px; }

/* ── Cuerpo ── */
.propuesta-body { padding: 48px; }
.propuesta-body h2 {
  font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 18px; color: var(--color-text-primary);
  display: flex; align-items: center; gap: 12px;
  padding-bottom: 12px; border-bottom: 1px solid var(--color-border);
  margin: 40px 0 20px;
}
.propuesta-body h2::before { content: ''; width: 12px; height: 12px; border-radius: 3px; background: var(--color-primary); flex-shrink: 0; }
.propuesta-body section:first-child h2 { margin-top: 0; }
.propuesta-body h3 { font: 600 15px Inter, sans-serif; color: var(--color-primary); margin: 24px 0 10px; }
.propuesta-body p { font: 400 15px/1.8 Inter, sans-serif; color: var(--color-text-primary); margin: 12px 0; }
.propuesta-body strong { color: var(--color-primary); font-weight: 600; }

.propuesta-body table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin: 24px 0;
}
.propuesta-body th { background: var(--color-primary); color: #fff; padding: 10px 16px; font: 600 13px Inter, sans-serif; text-align: left; }
.propuesta-body td { padding: 10px 16px; border-bottom: 1px solid var(--color-border); font: 400 13px Inter, sans-serif; color: var(--color-text-primary); }
.propuesta-body tr:last-child td { border-bottom: none; }
.propuesta-body tr:nth-child(even) td { background: var(--color-surface); }

.propuesta-body ul { list-style: none; padding: 0; margin: 12px 0; }
.propuesta-body li { padding: 4px 0 4px 20px; position: relative; color: var(--color-text-primary); font: 400 15px/1.7 Inter, sans-serif; }
.propuesta-body li::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); position: absolute; left: 0; top: 11px; }

/* ── Card Inversión ── */
.propuesta-inversion {
  background: var(--color-surface); border: 1px solid rgba(99,102,241,0.15);
  border-radius: var(--radius-lg); padding: 32px; margin: 24px 0;
}
.propuesta-inversion .precios { display: flex; gap: 48px; flex-wrap: wrap; align-items: flex-end; }
.propuesta-inversion .precio-label { font: 500 12px Inter, sans-serif; color: var(--color-text-secondary); margin-bottom: 4px; }
.propuesta-inversion .precio-setup { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 36px; color: var(--color-text-primary); line-height: 1; }
.propuesta-inversion .precio-mes { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 28px; color: var(--color-primary); line-height: 1; }
.badge-sin-permanencia {
  display: inline-block; margin-top: 20px;
  background: rgba(34,197,94,0.08); color: var(--color-success); border: 1px solid rgba(34,197,94,0.2);
  font: 600 12px Inter, sans-serif; padding: 5px 12px; border-radius: 999px;
}

/* ── Pie ── */
.propuesta-footer { padding: 24px 48px; border-top: 1px solid var(--color-border); background: var(--color-surface); text-align: center; }
.propuesta-footer p { font: 400 12px Inter, sans-serif; color: var(--color-text-tertiary); }

@media print {
  .no-print { display: none !important; }
  .propuesta-doc { box-shadow: none; margin: 0; max-width: 100%; border-radius: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 0; size: A4; }
}
`

type EstadoPDF = 'idle' | 'downloading' | 'done' | 'error'

export default function PropuestaViewer({ markdown, nombreNegocio, onMarcarEnviada }: Props) {
  const secciones = splitSecciones(markdown)
  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const [pdfEstado, setPdfEstado] = useState<EstadoPDF>('idle')

  const handleDownloadPDF = async () => {
    const element = document.getElementById('propuesta-contenido')
    if (!element) return
    setPdfEstado('downloading')

    try {
      const { default: html2pdf } = await import('html2pdf.js')

      // Forzar colores claros temporalmente para que html2pdf no pinte fondo negro
      const originalBackground = element.style.background
      const originalColor = element.style.color
      element.style.background = '#ffffff'

      const allElements = element.querySelectorAll('*')
      const originalStyles: Array<{ el: Element; bg: string; color: string }> = []
      allElements.forEach(el => {
        const htmlEl = el as HTMLElement
        const computed = window.getComputedStyle(htmlEl)
        originalStyles.push({ el, bg: htmlEl.style.background, color: htmlEl.style.color })
        const textColor = computed.color
        if (textColor.includes('255, 255, 255') || textColor.includes('241, 245, 249')) {
          htmlEl.style.color = '#09090B'
        }
        const bgColor = computed.backgroundColor
        if (bgColor.includes('5, 5') || bgColor.includes('13, 13')) {
          htmlEl.style.background = '#ffffff'
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (html2pdf() as any).set({
        margin: [10, 10, 10, 10],
        filename: `Propuesta-WIARE-${nombreNegocio.replace(/\s+/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      }).from(element).save()

      // Restaurar estilos originales
      element.style.background = originalBackground
      element.style.color = originalColor
      originalStyles.forEach(({ el, bg, color }) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.background = bg
        htmlEl.style.color = color
      })

      setPdfEstado('done')
      setTimeout(() => setPdfEstado('idle'), 3000)
    } catch (error) {
      console.error('PDF error:', error)
      setPdfEstado('error')
      setTimeout(() => setPdfEstado('idle'), 3000)
    }
  }

  return (
    <div>
      <style>{ESTILOS}</style>

      {/* ── ZONA A: Controles ── */}
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={handleDownloadPDF} disabled={pdfEstado === 'downloading'}>
          {pdfEstado === 'downloading' ? (
            <>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generando PDF…
            </>
          ) : pdfEstado === 'done' ? (
            <>
              <CheckCircle size={16} weight="fill" style={{ color: 'var(--color-success)' }} /> PDF descargado
            </>
          ) : pdfEstado === 'error' ? (
            <>
              <DownloadSimple size={16} style={{ color: 'var(--color-error)' }} /> Error — reintentar
            </>
          ) : (
            <>
              <DownloadSimple size={16} /> Descargar PDF
            </>
          )}
        </button>
        {onMarcarEnviada && (
          <button className="btn-secondary" onClick={onMarcarEnviada}>
            <CheckSquare size={16} /> Marcar como enviada
          </button>
        )}
      </div>

      {/* ── ZONA B: Documento ── */}
      <div className="propuesta-doc" id="propuesta-contenido">
        <header className="propuesta-header">
          <div className="propuesta-header-top">
            <img
              src="/logo-wiare.png"
              alt="WIARE"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div className="propuesta-header-meta">
              {fecha}
              <br />
              <span className="propuesta-confidencial">Confidencial</span>
            </div>
          </div>
          <p className="propuesta-para">Propuesta para</p>
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
                    <div className="precios">
                      <div>
                        <div className="precio-label">Setup único</div>
                        <div className="precio-setup">{setup}€</div>
                      </div>
                      {mes && (
                        <div>
                          <div className="precio-label">Mantenimiento</div>
                          <div className="precio-mes">{mes}€/mes</div>
                        </div>
                      )}
                    </div>
                    <span className="badge-sin-permanencia">Sin permanencia</span>
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
          <p>WIARE · holawiare@gmail.com · wiaresolution.com</p>
        </footer>
      </div>
    </div>
  )
}
