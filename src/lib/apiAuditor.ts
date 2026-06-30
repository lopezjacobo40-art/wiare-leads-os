import { supabase } from './supabaseClient'

type AuditorService = 'Claude' | 'Gemini' | 'ElevenLabs' | 'Apify' | 'GooglePlaces' | 'Hunter' | 'Retell' | 'Generic'

interface AuditorOptions extends RequestInit {
  retries?: number
  baseDelay?: number
  service?: AuditorService
  fallback?: () => Promise<Response>
  timeoutMs?: number
}

// Memoria del Circuit Breaker (reinicia si recargas, ideal para SPA)
// Tracks: fallos consecutivos por servicio
const circuitBreaker: Record<string, { failures: number; lastFailure: number }> = {}
const CB_THRESHOLD = 5 // fallos seguidos
const CB_COOLDOWN = 60000 // 1 minuto de bloqueo

async function logApiError(
  servicio: AuditorService,
  endpoint: string,
  method: string,
  errorMsg: string,
  statusCode?: number
) {
  const { error } = await supabase
    .from('api_audit_logs')
    .insert({
      servicio,
      endpoint,
      metodo: method,
      error_msg: errorMsg,
      status_code: statusCode,
    })
  
  if (error) {
    console.error('Error guardando telemetría del Auditor:', error)
  }
}

export async function fetchWithAudit(
  url: string | URL | globalThis.Request,
  options: AuditorOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    baseDelay = 1000,
    service = 'Generic',
    fallback,
    timeoutMs = 15000,
    ...fetchOptions
  } = options

  const urlStr = url.toString()
  const method = fetchOptions.method || 'GET'

  // --- 1. Circuit Breaker Check ---
  const cbState = circuitBreaker[service] || { failures: 0, lastFailure: 0 }
  if (cbState.failures >= CB_THRESHOLD) {
    const timeSinceLast = Date.now() - cbState.lastFailure
    if (timeSinceLast < CB_COOLDOWN) {
      console.warn(`[Auditor] Circuit abierto para ${service}. Bloqueando llamada.`)
      throw new Error(`[CircuitBreaker] Servicio ${service} temporalmente deshabilitado por múltiples fallos.`)
    } else {
      // Cooldown superado, "Half-Open", permitimos 1 intento
      cbState.failures = CB_THRESHOLD - 1
    }
  }

  let attempt = 0
  let lastError: any = null
  let lastStatus: number | undefined = undefined

  // --- 2. Bucle de Reintentos (Exponential Backoff) ---
  while (attempt <= retries) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        // Éxito: Reset Circuit Breaker
        if (circuitBreaker[service]) {
          circuitBreaker[service].failures = 0
        }
        return response
      }

      // Si no es OK, tratamos errores según HTTP Status
      lastStatus = response.status
      if (lastStatus === 429 || lastStatus >= 500) {
        throw new Error(`HTTP Error ${lastStatus}: ${response.statusText}`)
      } else {
        // Errores 4xx (Bad Request, Unauthorized), no tiene sentido reintentar
        logApiError(service, urlStr, method, `Client Error: ${response.statusText}`, lastStatus)
        return response
      }
    } catch (err: any) {
      lastError = err

      // Si fue abortado por timeout
      if (err.name === 'AbortError') {
        lastError = new Error('Timeout agotado tras ' + timeoutMs + 'ms')
      }

      attempt++
      if (attempt <= retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) // 1s, 2s, 4s...
        console.warn(`[Auditor] Fallo en ${service} (Intento ${attempt}/${retries}). Reintentando en ${delay}ms...`, err)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // --- 3. Si fallaron todos los reintentos ---
  // Actualizar Circuit Breaker
  cbState.failures += 1
  cbState.lastFailure = Date.now()
  circuitBreaker[service] = cbState

  // Registrar en Telemetría
  logApiError(service, urlStr, method, lastError?.message || 'Error desconocido', lastStatus)
  console.error(`[Auditor] Fallo crítico en ${service} tras ${retries} reintentos.`, lastError)

  // --- 4. Ejecutar Fallback (Plan B) si existe ---
  if (fallback) {
    console.log(`[Auditor] Activando Fallback para ${service}...`)
    try {
      return await fallback()
    } catch (fallbackErr: any) {
      logApiError(service, urlStr, method, `Fallback falló: ${fallbackErr?.message}`)
      throw fallbackErr
    }
  }

  throw lastError
}
