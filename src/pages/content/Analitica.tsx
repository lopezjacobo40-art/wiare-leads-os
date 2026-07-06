import { ChartLineUp } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import EmptyState from '../../components/EmptyState'

/* Analítica de contenidos — placeholder estructurado.
   Cuando Instagram permita conectar métricas (o se registren a mano),
   aquí van: alcance por publicación, crecimiento propio, mejores horas
   y comparativa contra los competidores en seguimiento. */
export default function Analitica() {
  return (
    <PageTransition>
      <PageHeader
        titulo="Analítica"
        subtitulo="Rendimiento de tu contenido: alcance, crecimiento y comparativa con competidores"
      />
      <div className="card" style={{ padding: 0 }}>
        <EmptyState
          icon={ChartLineUp}
          titulo="Analítica en construcción"
          descripcion="Aquí verás el rendimiento de tus publicaciones, tu crecimiento de followers y la comparativa con los competidores en seguimiento. Primero publica contenido desde el Instagram Manager."
        />
      </div>
    </PageTransition>
  )
}
