# WIARE Leads OS — Plan v6: Simplificación radical

**Filosofía:** menos funciones, más rápido. Borrar lo que da problemas (demos Retell, propuestas, generación de email IA). Un funnel limpio: extraer → analizar brechas → revisar informe → enviar email (que redactas tú con plantilla por nicho).

---

## DECISIONES TOMADAS (AskUserQuestion)

1. **Informe de brechas:** lo genera **Claude** solo con datos ya extraídos de Apify (rápido/barato, sin scraping extra). Bulk disponible.
2. **Plantillas de email:** viven **fuera del OS** (las tienes tú en Gmail/Notion). El OS solo da los **3 puntos clave** del informe pa pegar en tu plantilla.
3. **Sheets:** se mantiene pero **simplificado** al nuevo funnel.
4. **Secciones:** quitar solo **Contenido** (lo demás MI AGENCIA + Configuración se quedan).
5. **Marcar enviado:** botón manual **"Marcar como enviado"** (separado de copiar puntos), un clic.
6. **Biblioteca:** reconvertir a **"Negocios analizados"**.

---

## NUEVO FUNNEL (4 fases)

```
nuevo  →  [Analizar brechas, bulk]  →  negocio_analizado  →  [confirmar + email]  →  brechas_detectadas  →  [marcar enviado]  →  email_enviado
```

| Fase (key)            | Label               | Color     |
|-----------------------|---------------------|-----------|
| `nuevo`               | Nuevo               | gris      |
| `negocio_analizado`   | Negocio analizado   | indigo    |
| `brechas_detectadas`  | Brechas detectadas  | violeta   |
| `email_enviado`       | Email enviado       | verde     |

**Se eliminan** las fases viejas: `cualificado`, `demo_creada`, `propuesta_creada`, `email_generado`, `propuesta_enviada`, `cerrado`. (Los leads existentes en esas fases se migran a la fase nueva equivalente con un UPDATE de Supabase — ver migración.)

---

## QUÉ SE ELIMINA (código)

### Páginas / componentes
- `src/pages/Contenido.tsx` → DELETE
- `src/lib/contenidoData.ts` → DELETE
- `src/components/PropuestaViewer.tsx` → DELETE
- `src/components/PropuestaSlides.tsx` → DELETE
- `src/lib/nichoConfig.ts` → DELETE (el de slides; el `NICHO_CONFIG` de brechas es nuevo y vive en su propio archivo)
- `api/find-email.ts` → se mantiene como fallback de la cascada (ver Bloque 1)

### Funciones de `claudeApi.ts` → REMOVE
- `generarSystemPrompt` (demo Retell)
- `generarPropuesta` (propuesta texto)
- `generarContenidoSlides` + `SlidesContent` (slides)
- `generarEstrategiaOutreach` + `EstrategiaOutreach`
- `generarEmailOutreach` + `NICHO_CONFIG`/`NICHO_FALLBACK`/`nichoDe` (email IA)
- `scoreLead` + `ScoreResult` → **se sustituye** por `analizarBrechas` (ver Bloque 2)
- **Se conservan:** `callClaudeChat`, `simularRespuestaCliente` (Simulador), `consultarIA` (Consultor)

### `retellApi.ts`
- `crearAgentDemo` deja de usarse. Archivo no se borra (puede quedar import muerto); se quitan los imports en LeadDetalle. El archivo en sí se conserva por si vuelve la demo (no molesta).

### LeadDetalle.tsx — tabs
- Tabs actuales: `demo`, `propuesta`, `costes`, `notas`, `email` (5).
- **Nuevos tabs:** `informe` (brechas + 3 puntos), `costes`, `notas` (3). Se eliminan `demo`, `propuesta`, `email`.

### Sidebar
- Quitar link "Contenido" de `MI_AGENCIA` (ya no existe en el array actual — verificado, no está; solo borrar la página y ruta).
- Ruta `/contenido` en App.tsx → REMOVE (verificar: no está en App.tsx actual tampoco — confirmar y limpiar si queda).

> Nota: el repo actual **ya no tiene** ruta `/contenido` en App.tsx ni link en Sidebar (se ve en el código leído). Solo quedan los archivos `Contenido.tsx` y `contenidoData.ts` huérfanos → DELETE limpio.

---

## BLOQUE 1 — Extracción con cascada de email obligatorio

**Objetivo:** todo lead extraído sale con teléfono + web + email. Si Apify no trae email, cascada de actores hasta encontrarlo.

**`src/lib/apifyClient.ts`:**
- `extraerLeadsConApify` se mantiene igual (ya trae phone/website/email cuando existe).
- **Nueva `buscarEmailCascada(lead): Promise<{ email, fuente }>`** — intenta en orden, para al primer éxito:
  1. Email ya presente del crawler de Maps (`item.email`) → `fuente: 'apify_maps'`.
  2. `apify~website-content-crawler` sobre la web (ya existe como `buscarEmailApify`) → `fuente: 'apify_web'`.
  3. **Nuevo actor de respaldo** `apify~contact-info-scraper` (extrae emails/teléfonos/redes de una URL) → `fuente: 'apify_contact'`.
  4. Patrón de dominio: `info@{dominio}` derivado de la web → `fuente: 'patron'`, `verificado: false`.
  - Timeout/polling igual que los actores actuales (5s, máx ~90s). try/catch por intento (un actor caído no rompe la cascada).

**`src/pages/Extraccion.tsx`:**
- Filtro nuevo **"Excluir empresas grandes (+50 trabajadores)"** — heurística sin dato directo de plantilla (Apify no da nº empleados fiable):
  - Excluir si `reviewsCount > 1500` (proxy de cadena/gran empresa) **O** nombre en `PALABRAS_CADENA` (ya existe) **O** `categoryName`/título sugiere franquicia.
  - Toggle ON por defecto (es tu regla dura). Se documenta como heurística, no plantilla exacta.
- Tras insertar los leads nuevos, lanzar `buscarEmailCascada` en **background** (`processBatch` de 5 en 5) sobre los que no tengan email. Log en vivo: `{nombre} — email: {x}` / `— sin email tras cascada`.
- El insert ya guarda `email_fuente`; se amplía a los valores nuevos de la cascada.

**Supabase:** ninguno (columnas `email`, `email_fuente`, `email_verificado` ya existen).
**Variables .env:** ninguna (reusa `VITE_APIFY_API_KEY`).
**Coste:** Apify por actor (ya en uso). Cero Claude.
**Riesgo:** medio — el actor de contacto puede no estar en tu cuenta Apify; si falla, la cascada cae al patrón de dominio. Verificar el actor existe antes de integrarlo (si no, se omite el paso 3 y queda 1→2→4).

---

## BLOQUE 2 — Analizar brechas (sustituye Cualificar)

**`src/lib/brechasConfig.ts` (NUEVO):** `NICHO_BRECHAS` por nicho (8 sectores + fallback). Cada uno:
```ts
{ id, label, problema_core, palancas: string[] /* qué resuelve WIARE en ese nicho */ }
```
Reutiliza el conocimiento del `NICHO_CONFIG` actual de claudeApi (problema/beneficio/prueba_social) condensado a brechas. `getNichoBrechas(sector)` con sinónimos (igual lógica que `nichoDe`).

**`src/lib/claudeApi.ts` → nueva `analizarBrechas(lead): Promise<AnalisisBrechas>`:**
```ts
export interface AnalisisBrechas {
  score: number              // 1-10, encaje con WIARE (mantiene el ScoreBadge existente)
  resumen: string            // informe profesional, 3-4 frases, ligado al problema que resolvemos
  brechas: string[]          // 3 brechas detectadas del negocio
  puntos_email: string[]     // 3 puntos clave listos para pegar en TU plantilla
  ahorro_estimado: string    // p.ej. "~1.200€/mes en reservas perdidas"
  volumen: 'bajo'|'medio'|'alto'|'muy_alto'
  mrr: number                // 90-390, alimenta Costes (se conserva)
}
export async function analizarBrechas(lead: Lead): Promise<AnalisisBrechas>
// claude-haiku-4-5, ~700 tok, guardedCall('score')
```
Prompt: "Eres consultor de WIARE (atención al cliente 24/7 que ahorra dinero/tiempo). Analiza las brechas de ESTE negocio respecto a lo que WIARE resuelve." Inyecta datos reales del lead + `NICHO_BRECHAS` del sector. Reglas: sin "IA/bot", lenguaje de negocio, los 3 `puntos_email` son frases concretas y específicas del lead (no genéricas), listas pa pegar.

**Persistencia:** se reutilizan columnas existentes — `score_cualificacion`, `motivo_score` (=`resumen`), `volumen_llamadas`, `mrr_estimado`. **Nuevas columnas** pa brechas/puntos:
```sql
ALTER TABLE leads_os
  ADD COLUMN IF NOT EXISTS analisis_brechas jsonb,   -- {brechas, puntos_email, ahorro_estimado}
  ADD COLUMN IF NOT EXISTS analizado_at timestamptz;
```

**`src/pages/Leads.tsx`:**
- Renombrar acción "Cualificar" → **"Analizar brechas"** en todos los sitios: botón fila (icono `Lightning`→`MagnifyingGlassPlus`), header "Analizar selección (N)", barra de lote "Analizar con IA".
- `cualificar`/`ejecutarBatch`/`cualificarSeleccionados`/`rescorarTodos` → renombrar a `analizar*` y llamar `analizarBrechas`. Al analizar: guarda score+resumen+brechas+puntos, `analizado_at`, y `fase: 'negocio_analizado'` si la fase es `nuevo`. **El lead se pone en verde** (fila con tint verde sutil cuando `analizado_at != null`).
- Quitar lógica muerta: `esDemoSinPropuesta`, `soloSinPropuesta`, pills "Demo sin propuesta"/"Demo activa", filtro `sin_propuesta`.
- Tabs de fase usan `FASES` (4 nuevas) → sale solo.

**Coste:** ~0.0004€/lead (Haiku). 30 leads ≈ 0.012€.
**Riesgo:** bajo.
**Bloqueante:** ALTER aplicado antes de UI.

---

## BLOQUE 3 — LeadDetalle: tab Informe + email manual

**Tabs nuevos:** `informe` (default), `costes`, `notas`.

**Tab "Informe" (`informe`):**
- Si `analisis_brechas == null` → estado vacío + botón **"Analizar brechas"** (llama `analizarBrechas`, guarda, pasa a `negocio_analizado`).
- Si analizado → **informe profesional**:
  - Header: ScoreBadge + ahorro estimado destacado (número grande, sin gradient-text).
  - **Resumen** (motivo_score / resumen): párrafo de diagnóstico.
  - **Brechas detectadas** (3): lista con icono `Warning` ámbar + texto. (Sin side-stripe; full layout limpio.)
  - **3 puntos para tu email**: las 3 frases `puntos_email`, cada una con botón **Copiar** individual + botón **"Copiar los 3 puntos"** (primary). Card oscura tipo bloque de texto, monospace-friendly, listo pa pegar en tu plantilla.
  - Botón **"Confirmar brechas → Brechas detectadas"** (pasa fase `negocio_analizado`→`brechas_detectadas`).
  - Botón **"Abrir Gmail"** (compone `mailto`/Gmail con `to=lead.email`, **asunto y cuerpo vacíos** — tú pegas tu plantilla; solo prerellena el destinatario) — opcional, comodidad.
  - Botón **"Marcar como enviado"** (`CheckCircle`, primary verde) → fase `email_enviado` + registra en `token_usage_os` (`accion:'email_enviado'`) pa el contador. Solo activo si fase ≥ `brechas_detectadas`.

**Columna izquierda (datos):** se mantiene casi igual. Email finder usa `buscarEmailCascada`. Se quita el bloque MRR-condicionado a propuesta. Se conserva: dirección, tel, web, email (editable), Maps, reputación, horario, MRR, motivo, descripción.

**Quitar:** todo el bloque tab demo, tab propuesta (texto+slides), tab email outreach, sus estados e imports (`generarSystemPrompt`, `generarPropuesta`, `generarContenidoSlides`, `generarEstrategiaOutreach`, `generarEmailOutreach`, `crearAgentDemo`, `PropuestaViewer`, `PropuestaSlides`, `buscarEmailApify`→sustituido).

**Supabase:** ninguno extra (los de B2).
**Riesgo:** bajo-medio (archivo grande, mucho que quitar — build verde lo valida).

---

## BLOQUE 4 — Sheets simplificado + Biblioteca + Dashboard

**4A — `api/export-sheets.ts` + `src/lib/googleSheets.ts`:**
- Reducir columnas al nuevo funnel. Propuesta (A–N, 14 cols):
  `A:ID · B:Fecha · C:Nombre · D:Sector · E:Ciudad · F:Teléfono · G:Email · H:Web · I:Score · J:Fase · K:Ahorro estimado · L:Brechas (resumen) · M:Analizado · N:Última actualización`
- Mantener el upsert acumulativo (nunca borra). `FASE_LABELS` local = las 4 nuevas.
- `LeadDTO` se recorta a esos campos.

**4B — `src/pages/Biblioteca.tsx` → "Negocios analizados":**
- Una sola vista (quitar las 3 tabs Demos/Propuestas/Emails). Lista de leads con `analizado_at != null`.
- Tabla: Negocio | Sector | Score | Ahorro | Fase | Analizado | Acciones (`Eye`→`/leads/{id}`).
- Buscador por nombre/sector. Empty state si ninguno analizado.
- Sidebar: el link "Biblioteca" pasa a label **"Negocios analizados"** (icono `MagnifyingGlassPlus` o mantener `Books`).

**4C — `src/pages/Dashboard.tsx`:**
- Kanban y métricas leen `FASES` → se actualizan solas a 4 fases. Verificar que no haya fase hardcodeada (revisar el archivo; ajustar labels/colores de alertas que mencionen demo/propuesta).
- Quitar alertas obsoletas ("demo sin propuesta", "caliente sin trabajar" se puede mantener pero apuntando a `nuevo` sin analizar).

**Componentes de fase:**
- `src/lib/supabaseClient.ts` — `FASES` y `FASE_LABELS` = 4 nuevas.
- `src/components/KanbanBoard.tsx` + `src/components/FaseSelector.tsx` — `FASE_COLOR` = 4 nuevas.
- `src/components/QuickView.tsx` — verificar que no asuma fases viejas (revisar; ajustar si referencia propuesta/demo).

**Supabase migración de datos (una vez):**
```sql
-- Migrar fases viejas → nuevas
UPDATE leads_os SET fase='negocio_analizado'  WHERE fase IN ('cualificado','demo_creada');
UPDATE leads_os SET fase='brechas_detectadas' WHERE fase IN ('propuesta_creada','email_generado');
UPDATE leads_os SET fase='email_enviado'      WHERE fase IN ('propuesta_enviada','cerrado');
-- 'nuevo' se queda igual
```

---

## ORDEN DE EJECUCIÓN (bloque a bloque, build verde + checkpoint tras cada uno)

1. **Migración Supabase** (ALTER columnas B2 + UPDATE fases) — base de todo. Lo aplico yo con la herramienta Supabase y te confirmo.
2. **Bloque fases** (supabaseClient/Kanban/FaseSelector = 4 fases) — barato, transversal.
3. **Bloque 2** (analizarBrechas en claudeApi + brechasConfig + Leads.tsx) — el corazón nuevo.
4. **Bloque 3** (LeadDetalle: informe + email manual, borrar tabs viejos).
5. **Bloque 1** (cascada email + filtro +50 en Extraccion).
6. **Bloque 4** (Sheets + Biblioteca + Dashboard + borrar archivos huérfanos).
7. **Limpieza final:** borrar Contenido/PropuestaViewer/PropuestaSlides/nichoConfig + funciones muertas de claudeApi. Build verde final.

---

## VERIFICACIÓN
- Tras cada bloque: `npm run build` (tsc -b + vite build, detecta unused locals — NO basta `tsc --noEmit`, ver feedback de sesiones previas).
- Verificación funcional en **Vercel prod** (no `npm run dev` — `/api/*` no corre en dev). Push a master redespliega.
- Checkpoint contigo tras cada bloque antes de seguir.

## DISEÑO (impeccable — sistema existente, identity-preserved)
- Se respeta el design system actual (globals.css tokens light, Phosphor icons, btn-*). Cero librerías nuevas.
- Sin gradient-text, sin side-stripe borders, sin cards anidadas. Contraste AA en textos.
- Card de "3 puntos para tu email": fondo oscuro coherente con la card de email actual, texto ≥4.5:1.
- Verde de "analizado" = tint sutil de `--color-success`, no relleno.

## COSTES / RIESGOS GLOBALES
- Coste IA: solo `analizarBrechas` (Haiku). ~0.012€ por tanda de 30. Email 0€ (lo redactas tú).
- Riesgo principal: actor Apify de contacto puede no existir en la cuenta → fallback a patrón. Verifico antes.
- Sin SMTP, sin backend nuevo (salvo reuso de export-sheets/find-email existentes).

---

**STOP — espero tu OK para empezar por la migración Supabase + bloque fases.**
