# WIARE Leads OS — Plan v5

**Objetivo final:** pipeline de 10 emails/día cualificados con propuesta visual premium por nicho.

**Decisiones tomadas (AskUserQuestion):**
1. Slides → **seguir el spec tal cual** (gradient text, números 01/02/03, pérdida gigante). Es un pitch-deck, no la UI del OS; las prohibiciones de `impeccable` se aceptan conscientemente aquí.
2. Email → **generar + copiar/mailto, sin SMTP**. Cero backend nuevo, cero dependencias. El registro en `outreach_os` y el cambio de fase sí se ejecutan.
3. Ejecución → **bloque a bloque con checkpoint** + build verde antes de avisar.

**Reglas de diseño aplicadas en todo (de las skills leídas):** cero emojis (solo Phosphor), animaciones ≤300ms transform/opacity, touch targets ≥44px, tokens CSS (los slides tienen su propio set de tokens dark), skeleton loaders en cargas >300ms, un CTA primario por pantalla, sin librerías nuevas.

**Estado de verificación previa (hecho en research, no asumido):**
- `leads_os.fase` = `text` SIN check constraint → añadir `propuesta_creada` es cero-SQL (solo código).
- `token_usage_os.accion` = `text` SIN constraint → `email_enviado` se registra sin migración.
- `outreach_os` NO existe → se crea.
- `leads_os` ya tiene `email`; faltan `email_fuente`, `email_verificado`, `updated_at`, `propuesta_tipo`, `propuesta_slides`.
- `/public/logo-wiare-blanco.png` NO existe (solo `logo-wiare.png`) → fallback `onError`.
- `search.py` de ui-ux-pro-max NO es ejecutable (symlinks rotos a `src/ui-ux-pro-max/` inexistente). Skills aplicadas leyendo los SKILL.md.
- Stack: Vite SPA puro + Vercel Functions en `/api/*`. `npm run dev` NO sirve `/api/*` (solo prod). Verificación siempre en Vercel prod.

---

## BLOQUE 1 — Google Sheets acumulativo (upsert)

**Problema:** `api/export-sheets.ts` hoy hace `values.clear('A:X')` + reescribe todo → sobrescribe. Lo convertimos en base de datos externa acumulativa.

**Archivos a modificar:**
- `api/export-sheets.ts` — reescribir la lógica de escritura:
  1. Leer columna A completa del sheet con `sheets.spreadsheets.values.get({ range: 'A2:A' })` → mapa `{ id → rowNumber }`.
  2. Para cada lead: si su ID está en el mapa → preparar UPDATE de esa fila concreta; si no → acumular para INSERT al final (append).
  3. UPDATES en un solo `values.batchUpdate` (array de `{ range: 'A{row}:Z{row}', values: [row] }`) — una llamada para todas las filas existentes.
  4. INSERTS en un solo `values.append({ range: 'A1', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' })`.
  5. **Nunca** `clear`. **Nunca** borrar filas.
  6. Header pasa de 24 (A–X) a **26 columnas (A–Z)**. Si el sheet existente tiene el header viejo, se reescribe solo la fila 1 (A1:Z1) — no toca datos.
  7. Columna Z "Última actualización" = `new Date().toLocaleString('es-ES')` en cada fila tocada (insert o update).
  8. Formato (header indigo, score color, congelar fila): se aplica solo al header y a las filas nuevas insertadas, no a todo el rango (evita pisar formato existente). Filas alternas se omiten en modo acumulativo (rompería con append incremental) — se documenta la simplificación.

**Columnas nuevas del sheet (orden A–Z exacto del prompt):**
`A:ID · B:Fecha extracción · C:Nombre · D:Sector · E:Ciudad · F:Dirección · G:Teléfono · H:Email · I:Email verificado · J:Web · K:Google Maps · L:Valoración · M:Reseñas · N:Score · O:Nivel · P:Motivo score · Q:Volumen llamadas · R:Fase · S:MRR estimado · T:Setup (790€) · U:Agent ID Retell · V:Demo creada · W:Propuesta creada · X:Email enviado · Y:Fuente · Z:Última actualización`

**`LeadDTO`** se amplía con: `email`, `email_verificado`, `fuente`, y se calcula `propuesta_creada`/`email_enviado` (de fase y outreach). El cliente `src/lib/googleSheets.ts` ya manda el lead completo — solo verifico que pase los campos nuevos.

**Sheets API — detalles técnicos:**
- Leer columna A: `values.get({ spreadsheetId, range: 'A2:A' })`. Devuelve `string[][]`; índice + 2 = nº de fila real.
- Batch update eficiente: `values.batchUpdate({ data: [{range, values}, ...], valueInputOption })` — **1 request** para N updates (no fila a fila).
- Rate limits (Sheets API: 60 req/min/usuario): con 2 llamadas por export (1 batchUpdate + 1 append) estamos muy por debajo. No hay riesgo con volúmenes de decenas/cientos de leads.

**Supabase:** ninguno.
**Variables .env nuevas:** ninguna (reusa GOOGLE_* existentes).
**Dependencias nuevas:** ninguna (`googleapis` ya está).
**Coste API por operación:** 0€ (Google Sheets API gratis en cuota).
**Tiempo estimado:** 35 min.
**Riesgo técnico:** medio — el sheet maestro actual (id `1xvH1-...`) tiene header de 24 col; el primer export v5 reescribe A1:Z1 y empieza a acumular. Mitigación: no se borra ningún dato, solo se amplía el header.
**Bloqueantes:** ninguno.

---

## BLOQUE 2 — Nueva fase: propuesta_creada

**Funnel nuevo (6 fases):** `nuevo → cualificado → demo_creada → propuesta_creada → propuesta_enviada → cerrado`

**Supabase:** ninguno (verificado: `fase` es text sin check).

**Archivos a modificar:**
- `src/lib/supabaseClient.ts` — `FASES` añade `'propuesta_creada'` entre `demo_creada` y `propuesta_enviada`; `FASE_LABELS['propuesta_creada'] = 'Propuesta creada'`.
- `src/components/KanbanBoard.tsx` — `FASE_COLOR['propuesta_creada'] = '#8B5CF6'` (purple). Nota: `propuesta_enviada` hoy usa `#8B5CF6`; lo cambio a un violeta distinto (`#A855F7`) para que las dos fases sean distinguibles. El fondo translúcido lo deriva `rgbaFromHex` automáticamente.
- `src/components/FaseSelector.tsx` — `FASE_COLOR` mismo cambio (las dos constantes deben coincidir).
- `src/pages/Leads.tsx` — los tabs ya hacen `['todas', ...FASES].map(...)` → la fase nueva aparece sola con su contador. Cero cambios manuales.
- `src/pages/Dashboard.tsx` — verificar que el Kanban y contadores no asuman 5 fases hardcodeadas (usan `FASES`, así que suma sola). Reviso el cálculo de métricas.
- `api/export-sheets.ts` — `FASE_LABELS` local añade `propuesta_creada`.

**Trigger automático:** al generar propuesta con éxito (`generarProp` en LeadDetalle, y la generación de slides del Bloque 4) → `actualizar({ fase: 'propuesta_creada' })` solo si la fase actual es anterior (`nuevo/cualificado/demo_creada`), + `toast('Fase actualizada: Propuesta creada')`. No retrocede fases avanzadas.

**Variables .env / deps / coste:** ninguno.
**Tiempo estimado:** 20 min.
**Riesgo técnico:** bajo.
**Bloqueantes:** ninguno.

---

## BLOQUE 3 — Búsqueda automática de email

**Compatibilidad con el stack:** el scraping desde browser falla por CORS → se necesita server-side. El stack ya usa Vercel Functions (`api/export-sheets.ts`), así que `api/find-email.ts` es compatible y consistente. **Funciona en prod**; en `npm run dev` no (igual que el export — ya documentado, no es bloqueante porque verificamos en prod).

**Archivos a crear:**
- `api/find-email.ts` (Vercel Function). Recibe `{ web, nombre, descripcion }`, devuelve `{ email: string|null, fuente, verificado }`. Cascada (para al primer éxito):
  - **Intento 1 — scraping** `fetch(web)` server-side (sin CORS), regex de email sobre el HTML, filtro válidos (`info@ hola@ contacto@ reservas@ administracion@ gerencia@`) / descartados (`noreply@ privacy@ legal@ wordpress@ woocommerce@ sentry@ example@`). → `fuente:'web_scraping', verificado:true`.
  - **Intento 2 — patrón de dominio:** extrae dominio de `web`, genera `info@dominio` (1 candidato principal). → `fuente:'patron_dominio', verificado:false`.
  - **Intento 3 — descripción Maps:** regex sobre `descripcion`. → `fuente:'descripcion_maps', verificado:true`.
  - Timeout de fetch 6s + try/catch por intento (una web caída no rompe la cascada).
- `src/lib/emailFinder.ts` — cliente: `buscarEmail(lead): Promise<{email,fuente,verificado}>` que hace POST a `/api/find-email`.

**Archivos a modificar:**
- `src/lib/supabaseClient.ts` — interface `Lead` += `email_fuente: string | null`, `email_verificado: boolean | null`.
- `src/pages/Extraccion.tsx` — tras insertar leads, lanzar `buscarEmail` en background por cada lead nuevo con web (no bloquea; `processBatch` de a 5). Log en vivo: `✓ {nombre} — email: {x} ✓` / `— sin email` / `— candidato {x} (sin verificar)`. (El "✓" del log es texto monospace en consola interna, no emoji de UI — se mantiene el estilo actual del log que ya usa `★`.)
- `src/pages/LeadDetalle.tsx` — en la columna de datos: si `lead.email` null → botón "Buscar email" (`MagnifyingGlass`). Estados idle→buscando(skeleton)→encontrado/candidato/no_encontrado. Badges semánticos: `CheckCircle` verde "Email confirmado" / `Warning` naranja "Email candidato · verificar" / `X` rojo "Sin email · añadir manualmente". Campo `<input>` editable siempre visible para email manual (guarda en `actualizar({ email })`).

**Supabase (ALTER):**
```sql
ALTER TABLE leads_os
  ADD COLUMN IF NOT EXISTS email_fuente text,
  ADD COLUMN IF NOT EXISTS email_verificado boolean DEFAULT false;
```

**Variables .env nuevas:** ninguna.
**Dependencias nuevas:** ninguna (regex nativo, fetch nativo en Node 20+ de Vercel).
**Coste API por operación:** 0€ (no usa Claude; scraping puro).
**Tasa de éxito estimada por tipo:**
- Restaurante/Peluquería/Taller (web propia simple): 50–70% verificado por scraping.
- Clínica/Dental/Inmobiliaria (webs más pro, a veces formulario sin email visible): 30–50% verificado + ~40% candidato por patrón.
- Negocios sin web: 0% scraping; solo descripción Maps si la hay (~10%).
**Tiempo estimado:** 50 min.
**Riesgo técnico:** medio — algunas webs bloquean fetch sin User-Agent (se añade header UA de navegador) o usan JS para render (el email no está en el HTML inicial → no se encuentra, cae a candidato). Aceptable.
**Bloqueantes:** ALTER aplicado antes de integrar en UI.

---

## BLOQUE 4 — Propuesta visual tipo slides

**Archivos a crear:**
- `src/lib/nichoConfig.ts` — `NICHO_CONFIG` con los 8 nichos del prompt (restaurante, clinica, dental, inmobiliaria, academia, taller, estetica, veterinaria) + tipos TS. Función `getNicho(sector: string)` que mapea el `sector` libre del lead (Restaurante/Clínica/Dental/…) al nicho correcto, con fallback a `restaurante`.
- `src/components/PropuestaSlides.tsx` — renderiza el JSON generado como 7 slides. Navegación flechas izq/der + dots. Thumbnail strip (miniaturas). Botón "Descargar PDF" (html2pdf, landscape A4 16:9, scale 2, jpeg 0.98, slide por slide). Botón "Ver en pantalla completa" (modo presentación). **Tokens dark propios** definidos como CSS vars locales en un wrapper `.wiare-slides` (no contaminan el resto de la app, que es light):
  ```
  --slide-bg:#05050F --slide-surface:#0D0D1F --slide-card:rgba(255,255,255,0.04)
  --slide-border:rgba(255,255,255,0.08) --slide-text:#F1F5F9
  --slide-text-secondary:rgba(241,245,249,0.6) --slide-accent:#6366F1
  --slide-cyan:#22D3EE --slide-gradient:linear-gradient(135deg,#6366F1,#22D3EE)
  --slide-number:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(34,211,238,0.15))
  ```
  Las 7 slides exactamente como el spec (portada / problema / coste real / solución / cómo funciona / pausa-reflexión / CTA). Cada slide es div 1280×720. Logo `/logo-wiare-blanco.png` con `onError`→`/logo-wiare.png`. **Sin precios en ningún slide.**
- Clases CSS para `.wiare-slides` en `globals.css` (gradient clip-text, números decorativos, layout de slide) — encapsuladas bajo el wrapper.

**Archivos a modificar:**
- `src/lib/claudeApi.ts` — `generarContenidoSlides(lead): Promise<SlidesContent>`:
  ```ts
  export interface SlidesContent {
    slide1: { tagline: string }
    slide2: { estadistica: string; pain_points: { titulo: string; descripcion: string }[] }
    slide3: { perdida_mensual: number; perdida_anual: number; sin_sistema: string[]; con_sistema: string[] }
    slide4: { titulo: string; beneficios: { icono: string; titulo: string; descripcion: string }[] }
    slide5: { pasos: string[] }
    slide6: { pregunta: string }
    slide7: { cta: string; tiene_demo: boolean }
  }
  export async function generarContenidoSlides(lead: Lead): Promise<SlidesContent>
  ```
  Model `claude-sonnet-4-6`, max_tokens 1500, `guardedCall('content', …)`. Prompt = el del spec (NICHO_CONFIG del sector + datos reales del lead; reglas absolutas: nunca IA/bot/agente/automatización, nunca precios, beneficios, pérdida real del lead). Devuelve JSON parseado.
- `src/pages/LeadDetalle.tsx` — el tab "Propuesta" pasa a tener **2 modos**: "Texto" (el actual `generarPropuesta`/`PropuestaViewer`) y "Slides" (nuevo). Selector de tipo arriba del tab. Al generar slides con éxito → guarda en `leads_os.propuesta_slides` (jsonb) + `propuesta_tipo='slides'` + trigger fase `propuesta_creada` (Bloque 2).

**Supabase (ALTER):**
```sql
ALTER TABLE leads_os
  ADD COLUMN IF NOT EXISTS propuesta_slides jsonb,
  ADD COLUMN IF NOT EXISTS propuesta_tipo text;
```
(interface `Lead` += `propuesta_slides: SlidesContent | null`, `propuesta_tipo: string | null`).

**Variables .env nuevas:** ninguna.
**Dependencias nuevas:** ninguna (`html2pdf.js` ya está, se importa dinámico como en PropuestaViewer).
**Coste API por operación:** ~0.005–0.006€/propuesta (Sonnet, ~1500 tok out). Cuenta contra el límite `content` diario (20/día).
**Tiempo estimado:** 90 min (el bloque más grande).
**Riesgo técnico:** medio — el PDF landscape slide-por-slide con html2pdf puede requerir ajuste de escala/saltos de página; el `.d.ts` de html2pdf no tipa todo (se tipa laxo, ya hay precedente). Los tokens dark encapsulados evitan romper la app light.
**Bloqueantes:** Bloque 2 (trigger de fase) recomendado antes.

---

## BLOQUE 5 — Agente outreach + email (sin SMTP)

**Concepto:** 2 llamadas Claude separadas (estrategia con Sonnet → email con Haiku).

**Archivos a modificar:**
- `src/lib/claudeApi.ts`:
  ```ts
  export interface EstrategiaOutreach {
    angulo: string; dolor_elegido: string; dato_especifico: string
    opciones_asunto: string[]; tono: 'cercano'|'profesional'|'directo'; urgencia: string
  }
  export async function generarEstrategiaOutreach(lead: Lead): Promise<EstrategiaOutreach>
  // claude-sonnet-4-6, 600 tok, guardedCall('content')

  export async function generarEmailOutreach(
    lead: Lead, estrategia: EstrategiaOutreach, vendedor: string
  ): Promise<{ asunto: string; cuerpo: string }>
  // claude-haiku-4-5, 350 tok, guardedCall('content')
  ```
  Reglas del email en el prompt: máx 100 palabras; NUNCA IA/bot/agente/automatización/inteligencia artificial; SÍ "sistema de atención"/"recepcionista virtual"/"solución"; asunto máx 7 palabras; 1 CTA (ver demo personalizada); firma `{vendedor} · WIARE · info@wiaresolution.com`; menciona 1 dato real del lead; hype; tono persona real.

**Archivos a crear:**
- (ninguno nuevo de lib — el envío es copiar/mailto, sin `send-email.ts`).

**Tab nuevo "Email Outreach" en `LeadDetalle.tsx`:**
- **Paso 1 — Estrategia:** botón "Analizar y crear estrategia" (`Brain`). Loading skeleton 3 líneas. Resultado en cards: ángulo, dato específico, 3 pills de asunto (seleccionable 1), badge de tono, urgencia. Todo editable.
- **Paso 2 — Email:** asunto seleccionado (editable). Preview en card oscura tipo bandeja (De: info@wiaresolution.com · Para: `lead.email` · Asunto · cuerpo · firma). Textarea editable. Selector firmante Jacobo/Luis (de sesión). Botones:
  - Primary "Copiar email completo" (`Copy`) → copia asunto+cuerpo al portapapeles.
  - Secondary "Abrir en mi correo" (`PaperPlane`) → `mailto:` con asunto y cuerpo prerellenados.
  - Ghost "Guardar borrador" (`FloppyDisk`) → guarda en `outreach_os` estado `borrador`.
- **Al copiar/abrir** (= marcar como enviado, manual): registra en `outreach_os` estado `enviado` + timestamp; `registrarUso` con `accion:'email_enviado'`; si `lead.propuesta_md`||`propuesta_slides` → `fase:'propuesta_enviada'`, si no, no cambia fase; toast "Email listo para {email} — registrado como enviado".

**Supabase (crear tabla):**
```sql
CREATE TABLE IF NOT EXISTS outreach_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  lead_id uuid REFERENCES leads_os(id) ON DELETE CASCADE,
  usuario text,
  asunto text,
  cuerpo text,
  estrategia jsonb,
  estado text DEFAULT 'borrador',   -- borrador | enviado
  enviado_at timestamptz
);
ALTER TABLE outreach_os DISABLE ROW LEVEL SECURITY;
```

**Variables .env nuevas:** `VITE_DAILY_EMAIL_LIMIT=10` (límite blando: contador visible, advertencia al llegar a 10; no bloquea porque el envío es manual). Se añade a `.env.local` y a Vercel.
**Dependencias nuevas:** ninguna (sin nodemailer).
**Coste API por operación:** estrategia ~0.005€ (Sonnet 600 tok) + email ~0.0004€ (Haiku 350 tok) ≈ **0.0054€/email**.
**Tiempo estimado:** 70 min.
**Riesgo técnico:** bajo (sin backend de envío).
**Bloqueantes:** tabla `outreach_os` creada; Bloque 4 (para la lógica de fase con slides).

---

## BLOQUE 6 — Mejoras UX y limpieza

**6A — Eliminar sección Contenido:**
- `src/pages/Contenido.tsx` → DELETE. `src/lib/contenidoData.ts` → DELETE. `generarPostLinkedIn` + imports en `claudeApi.ts` → REMOVE. Ruta `/contenido` en `App.tsx` → REMOVE. Link en `Sidebar.tsx` (`MI_AGENCIA`) → REMOVE. Verifico que no quede ningún import colgando (build).

**6B — Eliminar en bundle (barra de selección múltiple en `Leads.tsx`):**
- Botón "Eliminar X leads" (`Trash` rojo: `bg:rgba(239,68,68,0.15) color:#EF4444`, hover más intenso) en la barra flotante.
- Modal de confirmación propio (no `confirm()`): título "Eliminar {n} leads", lista scrollable de nombres (máx 5 visibles + "y X más"), texto "Esta acción es permanente y no se puede deshacer", botones Cancelar / Eliminar (`btn-danger` + Trash).
- Al confirmar: `supabase.from('leads_os').delete().in('id', ids)` → toast "{n} leads eliminados" → `limpiarSeleccion()` + `cargar()`.

**6C — Biblioteca de demos y propuestas:**
- Crear `src/pages/Biblioteca.tsx`, ruta `/biblioteca`, link en sidebar (`Books`, en grupo MENÚ o MI AGENCIA).
- Tab "Demos activas": tabla Negocio|Sector|Ciudad|Agent ID|Fecha|Acciones. Acciones: `ArrowSquareOut`→`app.retellai.com/agents/{id}`; `Trash`→borra agente (Retell API si existe `eliminarAgent` en retellApi, si no, solo limpia `agent_id_retell` en leads_os + nota); `ArrowClockwise`→navega a `/leads/{id}` tab Demo.
- Tab "Propuestas": tabla Negocio|Sector|Tipo|Fecha|Acciones. Tipo badge "Slides" indigo / "Texto" gris. Acciones: `Eye`→modal con `PropuestaSlides`/`PropuestaViewer`; `DownloadSimple`→PDF; `PaperPlane`→`/leads/{id}?tab=email`; `Trash`→`propuesta_md=null`/`propuesta_slides=null` + fase retrocede a `demo_creada`.
- Lee de `leads_os` (filtra los que tienen `agent_id_retell` para demos; los que tienen `propuesta_md`||`propuesta_slides` para propuestas).

**6D — Filtros extracción mejorados (`Extraccion.tsx` + `googlePlaces.ts`):**
- **Positivos:** reseñas mín (existe), valoración mín (existe), nuevo toggle "Quejas de atención en reseñas" (busca en texto de reseñas si disponible: "no cogen","no responden","tardan","imposible contactar"; tooltip "Estos son tus mejores leads"), nuevo campo "Código postal / Zona" (input text, se añade al query de Maps).
- **Negativos (toggle OFF por defecto):** "Excluir cadenas y franquicias" (lista McDonald's/Telepizza/Mercadona/Zara/NH/Ibis/Burger King/KFC/Subway… + nombre idéntico en >3 ciudades), "Excluir valoración <2.5", "Solo negocios sin web" (mover el actual "sin web" aquí), "Excluir ya en pipeline" (existe).
- **Pills de filtros activos** encima de la tabla durante extracción: `[CP: 28001] [x] · [Sin web] [x] · [+2 más]`; click en X desactiva.
- Reviso `googlePlaces.ts` para ver qué filtros aplica hoy y cuáles son client-side vs en el query (la disponibilidad de "texto de reseñas" depende de si Places New lo devuelve; si no, el toggle se marca "según disponibilidad").

**Supabase:** ninguno.
**Variables .env nuevas:** ninguna.
**Dependencias nuevas:** ninguna.
**Coste API:** 0€ (6B/6C/6D no usan Claude).
**Tiempo estimado:** 100 min (6C y 6D son los pesados).
**Riesgo técnico:** bajo-medio (6D depende de qué expone `googlePlaces.ts`; se adapta tras leerlo).
**Bloqueantes:** 6C necesita `PropuestaSlides` (Bloque 4).

---

## PLAN GLOBAL

### Orden de implementación (con motivo)
1. **Bloque 2 (fase propuesta_creada)** — base barata y transversal; el funnel correcto lo necesitan los Bloques 4 y 5 para sus triggers. Cero SQL.
2. **Bloque 3 (email finder)** — independiente; alimenta de emails al pipeline antes de poder hacer outreach. ALTER simple.
3. **Bloque 1 (Sheets upsert)** — independiente; ya que tocamos columnas de email/propuesta/fase, el sheet refleja el estado nuevo.
4. **Bloque 4 (propuesta slides)** — el más grande; produce el artefacto premium. Necesita Bloque 2.
5. **Bloque 5 (outreach + email)** — cierra el funnel; necesita emails (B3) y propuestas (B4) para su lógica de fase.
6. **Bloque 6 (UX + limpieza)** — al final: 6C consume las slides (B4), y limpiar Contenido (6A) no debe romper builds intermedios.

### El funnel de 10 emails/día (paso a paso en el OS)
1. **Extraer (una vez, ~5 min):** Extracción → sector + ciudad/CP + filtros (excluir cadenas, score alto) → 30 leads. El email finder corre solo en background.
2. **Cualificar (~2 min):** Leads → seleccionar todos → "Cualificar con IA" (batch). Ordena por prioridad.
3. **Elegir los 10 (~3 min):** filtrar fase `nuevo` + score ≥7 + que tengan email (verificado o candidato). Son tus 10 de hoy.
4. **Por cada lead (~3 min × 10 = 30 min):**
   a. Abrir lead → tab Demo → generar+desplegar demo Retell (opcional, da hype real).
   b. Tab Propuesta → modo Slides → "Generar slides" (fase → propuesta_creada).
   c. Tab Email Outreach → "Analizar estrategia" → elegir asunto → generar email → "Copiar" o "Abrir en mi correo" → enviar desde tu Gmail/cliente → queda registrado como enviado (fase → propuesta_enviada).
5. **Cierre del día (~2 min):** Leads → exportar a Sheets (acumula, no pisa). Sidebar muestra "X/10 emails hoy".
**Total: ~45 min/día para 10 emails cualificados con propuesta visual.**

### Variables .env completas a añadir (Vercel + .env.local)
- `VITE_DAILY_EMAIL_LIMIT=10` — límite blando de emails outreach/día (contador + aviso).
- (Recordatorio pendiente de sesiones previas, no nuevo: `VITE_DAILY_SCORE_LIMIT=100`, `VITE_DAILY_CONTENT_LIMIT=20` — opcionales, hay defaults.)
- No se añaden SMTP_* (decisión: sin envío server-side).

### Coste API mensual (10 emails/día × 22 días = 220 emails/mes)
- Estrategias outreach (Sonnet 600 tok): ~0.005€ × 220 = **1.10€/mes**
- Emails generados (Haiku 350 tok): ~0.0004€ × 220 = **0.09€/mes**
- Propuestas slides (Sonnet 1500 tok): ~0.0055€ × 220 = **1.21€/mes**
- Email finder: **0€** (scraping, sin Claude)
- Scoring (Haiku, ~30 leads/día): ~0.0003€ × 660 = **0.20€/mes**
- **Total estimado: ~2.6€/mes** (muy por debajo del límite content 20/día; ojo: slides + outreach + propuestas comparten el contador `content` → 10 emails/día = ~20 llamadas content/día = justo en el límite. **Recomendación: subir `VITE_DAILY_CONTENT_LIMIT` a 50** para no chocar con el funnel de 10/día. Lo dejo señalado, no lo cambio sin tu OK.)

### Cambios en Sidebar.tsx
- **Eliminar:** "Contenido" del array `MI_AGENCIA` (Bloque 6A).
- **Añadir:** "Biblioteca" (`Books`) — propongo en grupo MENÚ tras "Todos los leads", o en MI AGENCIA. (Recomiendo MENÚ por ser operativo.)
- Orden final MENÚ: Dashboard · Extraer leads · Todos los leads · Biblioteca. MI AGENCIA: Roadmap · Simulador · Consultor IA. SISTEMA (solo jacobo): Configuración.

### Advertencias técnicas
1. **Sheet maestro existente** tiene header de 24 col; el primer export v5 amplía a 26 (A–Z) reescribiendo solo A1:Z1. No se pierde data, pero las filas viejas no tendrán valores en Y/Z hasta su próximo update.
2. **`/api/*` no corre en `npm run dev`** (Vite puro) — email finder y export solo funcionan en Vercel prod. Verificación siempre en prod (feedback registrado).
3. **Email finder y webs JS-rendered:** muchas webs modernas cargan el email por JS → no aparece en el HTML inicial → cae a candidato por patrón. Esperado.
4. **Límite `content` compartido:** slides + outreach + propuestas consumen el mismo contador. Con el funnel de 10/día conviene subir el límite (ver coste arriba).
5. **`propuesta_enviada` cambia de color** (#8B5CF6 → #A855F7) para no colisionar con `propuesta_creada` (#8B5CF6). Cambio cosmético, sin impacto funcional.
6. **`logo-wiare-blanco.png` sigue sin existir** → slides usan fallback al logo actual. Para óptimo resultado en el header gradient, subir la versión blanca (no bloqueante).

### Modelo por fase
- Plan: Opus (hecho).
- Ejecución bloque a bloque: Sonnet 4.6.
- Scoring / emails cortos: Haiku 4.5.

---

**STOP — esperando tu OK para ejecutar Bloque 2 (primero del orden).** Tras cada bloque: build verde + checkpoint + espero OK.
