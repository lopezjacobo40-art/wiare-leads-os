import { Newspaper } from '@phosphor-icons/react'
import PageHeader from '../../components/PageHeader'
import PageTransition from '../../components/PageTransition'
import EmptyState from '../../components/EmptyState'

/* Consolidador de noticias — placeholder estructurado.
   Idea: fuentes RSS/News del sector (IA, voz, clínicas, hostelería)
   consolidadas y filtradas, con "convertir en idea de post" directo. */
export default function Noticias() {
  return (
    <PageTransition>
      <PageHeader
        titulo="Noticias"
        subtitulo="Consolidador de noticias del sector para convertir actualidad en contenido"
      />
      <div className="card" style={{ padding: 0 }}>
        <EmptyState
          icon={Newspaper}
          titulo="Consolidador en construcción"
          descripcion="Aquí llegarán noticias de tus fuentes del sector (IA de voz, clínicas, hostelería) listas para convertirse en ideas de post con un click."
        />
      </div>
    </PageTransition>
  )
}
