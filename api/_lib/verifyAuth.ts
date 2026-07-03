import type { VercelRequest, VercelResponse } from '@vercel/node'

/* Valida el access token de Supabase Auth que envía el frontend en Authorization.
   Devuelve true si la sesión es válida; si no, responde 401 y devuelve false.
   (El directorio api/_lib no se expone como función de Vercel.) */
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'No autorizado: falta el token de sesión' })
    return false
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ error: 'Missing Supabase config on server' })
    return false
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!userRes.ok) {
      res.status(401).json({ error: 'Sesión inválida o caducada' })
      return false
    }

    return true
  } catch {
    res.status(500).json({ error: 'Error validando la sesión' })
    return false
  }
}
