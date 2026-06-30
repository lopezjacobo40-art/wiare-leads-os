# WIARE Leads OS — Plan v7: funnel mínimo + email real + Gemini

**Objetivo:** simplificar el funnel al máximo, garantizar EMAIL REAL (nunca patrón adivinado) y mover el análisis a Gemini (gratis/barato) con prompt honesto.

## Decisiones tomadas (AskUserQuestion)
1. Email patrón: **probar más actores Apify reales**; si ninguno da email real → lead SIN email (jamás info@ adivinado).
2. Cascada de actores la **defino yo** (Apify no auto-selecciona actor).
3. Email real se busca **en extracción, automático** (background, como ahora pero sin patrón).
4. Motor análisis: **Gemini Flash** (gratis/barato). Resto del OS sigue en Claude.
5. Análisis honesto: **score bajo real + recomendación de descartar** si encaje débil. Prompt anti-optimismo.
6. Verde de fila: **solo cuando "Listo para enviar"**, no al analizar.

---

## FUNNEL NUEVO (6 fases, renombrado)
```
nuevo → negocio_analizado → listo_para_enviar → email_enviado → respondido → reunion_agendada
```
- **Cambio:** `brechas_detectadas` → **`listo_para_enviar`** (label "Listo para enviar"). Migración SQL de los leads que estén en brechas_detectadas.
- `negocio_analizado` se mantiene. El resto igual.

### Flujo de acciones (lo que pediste)
| Fase actual | Acción en fila (iconos) | Resultado |
|---|---|---|
| `nuevo` | **Analizar negocio** + **Eliminar** | analiza → auto a `negocio_analizado` |
| `negocio_analizado` | **Listo para enviar** + Ver + Eliminar | pasa a `listo_para_enviar` |
| `listo_para_enviar` | **Marcar enviado** (tick verde) + Ver | pasa a `email_enviado` |
| `email_enviado`+ | Ver | (cambias fase a mano: respondió / reunión) |

- **Bulk:** botón header "Analizar negocios (N)" sigue (analiza los `nuevo` sin analizar). Igual que hoy pero renombrado.
- **Verde de fila:** se pone verde cuando `fase === 'listo_para_enviar'` (listo, esperando envío), no cuando `analizado_at`.

---

## BLOQUE A — EMAIL REAL (lo más importante)

**`src/lib/apifyClient.ts` — `buscarEmailCascada` reescrita:**
Cascada de actores REALES, para al primer email real. **Elimina el paso de patrón.** Orden:
1. Email ya en Maps (`lead.email`) — real.
2. Email en descripción de Maps (regex) — real.
3. **`apify~website-content-crawler`** sobre la web (crawl 3 págs, busca en /contacto /contact).
4. **`vdrmota~contact-info-scraper`** sobre la web (extrae emails/teléfonos/redes).
5. **NUEVO actor de respaldo** `lukaskrivka~google-maps-with-contact-details` o `poidata~email-extractor` (extrae emails de webs) — segundo scraper independiente por si el dominio bloquea al primero.
6. Si NINGUNO da email real → `{ email: null, fuente: 'sin_email' }`. **Nunca info@dominio.**
- `patronDominio()` se ELIMINA (función + uso).
- Cada actor con try/catch; un actor caído no rompe la cascada (helper `correrActor` ya lo hace).
- Filtro de validez: descartar `noreply@ no-reply@ ejemplo@ sentry@ wordpress@ wix@`; priorizar `info@ contacto@ reservas@ citas@ hola@ administracion@`.

**Verificación de existencia (anti-rebote):** opción ligera sin SMTP — validar formato + dominio con MX (vía actor o regex de dominio). Si el actor de contacto ya devuelve solo emails que aparecen en la web, son reales por construcción (están publicados). El riesgo de rebote real queda en webs que publican un email muerto: aceptable, es raro.

**`src/pages/Extraccion.tsx`:** la cascada en background ya existe; solo cambia que cuando `fuente === 'sin_email'` el lead queda con email null y log "— sin email real (no se inventa)". Contador "X con email real / Y sin email".

**Marcado en UI:**
- Lead con email real → badge verde "Email real (fuente)".
- Lead sin email → badge gris "Sin email real" + botón "Reintentar búsqueda".
- Se ELIMINA el badge naranja "patrón adivinado" (ya no hay patrón).

**`VITE_APIFY_API_KEY`:** ya existe. Posible coste extra por el 3er actor (~céntimos/lead). Verifico que los actores existen en la cuenta; si alguno no, la cascada lo salta.

---

## BLOQUE B — ANÁLISIS CON GEMINI + HONESTO

**Nuevo `src/lib/geminiApi.ts`:**
- `callGemini(prompt): Promise<string>` → POST a `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=VITE_GEMINI_API_KEY`.
- Modelo `gemini-2.5-flash` (capa gratis generosa; si se agota, barato).
- Mismo patrón `guardedCall('score', ...)` para el contador de uso.

**`src/lib/claudeApi.ts` → `analizarBrechas` migra a Gemini:**
- La función `analizarBrechas(lead)` pasa a llamar `callGemini` en vez de Claude Haiku. Misma firma, mismo JSON de salida (`ResultadoBrechas`), mismo parseo.
- **Prompt reescrito anti-optimismo:**
  - "Eres analista CRÍTICO. La mayoría de negocios NO son clientes ideales de WIARE. Sé honesto: si el encaje es débil, dilo y puntúa bajo (2-4)."
  - Score honesto: reparte la escala completa. Reservar 8-10 solo para encaje evidente (pierde llamadas, sin web, horario corto, sector de cita previa).
  - Nuevo campo `recomendacion: 'contactar' | 'descartar' | 'dudoso'` + `encaje: string` (por qué encaja o no).
  - Si `recomendacion === 'descartar'` → la UI lo marca y sugiere no enviar.
- `ResultadoBrechas` += `recomendacion`, `encaje`. `analisis_brechas` jsonb += esos campos.
- Mantengo Claude para Simulador/Consultor (no se tocan).

**Coste:** Gemini Flash capa gratis ~1500 req/día → análisis gratis en la práctica. 0€.

**Variable nueva:** `VITE_GEMINI_API_KEY` (BLOQUEANTE: hay que crearla en Google AI Studio / Google Cloud y añadirla a .env.local + Vercel). La key de Places NO sirve directamente (hay que habilitar Generative Language API en ese proyecto, o sacar key nueva de aistudio.google.com — gratis).

---

## BLOQUE C — UI DEL FUNNEL Y ACCIONES

**`src/lib/supabaseClient.ts`:** `FASES` y `FASE_LABELS`: `brechas_detectadas` → `listo_para_enviar` ("Listo para enviar").
**`KanbanBoard.tsx` + `FaseSelector.tsx`:** `FASE_COLOR` renombra la clave; color violeta se mantiene.
**`api/export-sheets.ts`:** `FASE_LABELS` local renombra.

**`src/pages/Leads.tsx` — acciones de fila dinámicas por fase:**
- Reemplazo los iconos fijos (ojo/lupa/x) por acciones según fase:
  - `nuevo`: botón **Analizar** (MagnifyingGlassPlus) + **Eliminar** (X). Ver (ojo) se mantiene.
  - `negocio_analizado`: botón **Listo para enviar** (PaperPlaneTilt/ArrowRight) + Ver + Eliminar.
  - `listo_para_enviar`: botón **Marcar enviado** (CheckCircle verde) + Ver.
  - `email_enviado`+: Ver.
- Verde de fila: condición pasa de `analizado_at != null` a `fase === 'listo_para_enviar'`.
- Quick view (lupa) se mantiene como "Ver".

**`src/pages/LeadDetalle.tsx`:**
- Tab Informe: añadir badge de `recomendacion` (verde contactar / rojo descartar / ámbar dudoso) + `encaje`.
- Botón "Confirmar brechas" → renombrar **"Listo para enviar"** (pasa a `listo_para_enviar`).
- "Marcar como enviado" → sigue (pasa a `email_enviado`).
- Badge email: quitar el aviso de patrón (ya no existe); badge "Sin email real" + reintentar si null.

**Dashboard / Biblioteca:** verificar labels de fase (usan FASE_LABELS, salen solas). "Negocios analizados" en Biblioteca sigue (analizado_at).

---

## SUPABASE (migración una vez)
```sql
-- Renombrar fase
UPDATE leads_os SET fase='listo_para_enviar' WHERE fase='brechas_detectadas';
-- analisis_brechas jsonb ya existe; los campos nuevos (recomendacion, encaje) van dentro del jsonb, sin ALTER.
```
Sin ALTER de columnas (recomendacion/encaje viven dentro de `analisis_brechas` jsonb).

---

## ORDEN DE EJECUCIÓN (bloque a bloque, build verde + checkpoint)
1. **BLOQUE A — email real** (cascada sin patrón + más actores). Lo más crítico para ti.
2. **BLOQUE B — Gemini + análisis honesto** (requiere que añadas VITE_GEMINI_API_KEY antes).
3. **BLOQUE C — funnel/acciones/UI** (renombrar fase, acciones por fase, verde en listo_para_enviar).
4. Migración SQL + build verde + push a prod.

## BLOQUEANTE antes de empezar Bloque B
- Necesito **`VITE_GEMINI_API_KEY`**. Sácala gratis en https://aistudio.google.com/apikey (proyecto Google, 1 min). Dímela o añádela tú a .env.local y Vercel. Sin ella, Bloque B no corre (Bloques A y C sí).

## VERIFICACIÓN
- `npm run build` verde tras cada bloque (tsc -b detecta unused — no basta tsc --noEmit).
- Verificación funcional en Vercel prod (Apify/Gemini no corren en npm run dev igual que las otras APIs server-side… Gemini SÍ corre en browser como Claude).
- Checkpoint contigo tras cada bloque.

## RIESGOS
- Actores Apify de respaldo pueden no estar en tu cuenta → cascada los salta, no rompe. Verifico nombres reales antes.
- Gemini capa gratis tiene rate limit (~15 req/min) → el bulk de análisis necesita el throttle de processBatch (ya existe, 5 en paralelo + delay). Ajusto a la cuota de Gemini.
- Email real: ningún scraper es 100%. Habrá leads sin email; es correcto (mejor sin email que rebote).

---
**STOP — espero tu OK + la VITE_GEMINI_API_KEY para arrancar. Bloque A puede empezar ya sin la key.**
