import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { BrandKitContext, fetchBrandKit, type BrandKit } from '../lib/brandKit'

/* Carga el brand kit una sola vez y lo expone a todo el módulo de Content.
   Cualquier página de Content lee colores/fuentes/logo/tono vía useBrandKit(). */
export default function BrandKitProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandKit | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await fetchBrandKit()
    setBrand(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <BrandKitContext.Provider value={{ brand, loading, refresh }}>
      {children}
    </BrandKitContext.Provider>
  )
}
