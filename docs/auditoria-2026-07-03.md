# Auditoría WIARE Leads OS — 2026-07-03

Auditoría en 4 fases: seguridad, funcionalidad, UX/UI, brecha vs. visión.
Verificado contra código local + base de datos Supabase real (proyecto `pdpcrueqwmhammtuisob`).

---

## Resumen ejecutivo

1. **La seguridad es decorativa**: la BD entera es legible/escribible/borrable por cualquiera con la URL (política RLS "todo a anon"), los endpoints `/api/*` son proxies abiertos de tus API keys, y el login se bypassea desde DevTools.
2. **Dos funcionalidades rotas en producción**: la sección Contenido entera (RLS sin políticas en `content_os`) y el sync de leads web (RLS bloquea el SELECT de `quiz_leads`) — **se están perdiendo leads de wiaresolution.com ahora mismo**.
3. La integración Retell → Supabase (call analysis) **no existe**; la tabla `call_analysis_os` tampoco.
4. El design system está bien implantado (tokens, fuentes, Phosphor); las violaciones son menores (emojis, animaciones largas, colores de fase sin tokenizar).
5. La mayor fricción UX: Kanban con 13 columnas (9 vacías), sin búsqueda de texto, y sin cockpit de seguimiento post-envío — justo donde se cierra el dinero.
6. Vs. la visión: el embudo prospección→brechas→email está construido; faltan cierre (follow-up), llamadas (Retell) y brand kit en contenido.

---

## Tabla de bugs por fase

| # | Fase | Severidad | Descripción | Ubicación |
|---|------|-----------|-------------|-----------|
| C1 | Seguridad | Crítica | BD abierta: política `ALL/true` para anon en `leads_os` y `extracciones_os`; anon key pública en bundle | políticas BD + `src/lib/supabaseClient.ts:4` |
| C2 | Seguridad | Crítica | RLS desactivado en `outreach_os` y `roadmap_os` | BD |
| C3 | Seguridad | Crítica | 8 endpoints serverless sin auth = proxy abierto de keys (Anthropic, Apify, Retell, Gemini...) | `api/claude.ts:14`, `api/apify.ts:14`, etc. |
| C4 | Seguridad | Crítica | Login bypasseable: sesión = `sessionStorage` sin token | `src/App.tsx:80`, `src/pages/Login.tsx:26` |
| M1 | Seguridad | Media | Roles solo cosméticos (checks `user==='jacobo'` en cliente) | `Sidebar.tsx:193`, `Roadmap.tsx:24` |
| M2 | Seguridad | Media | Contraseña compartida `wiare2025` + sin rate limit en `/api/auth` | `.env.local:9,11`, `api/auth.ts:33` |
| M3 | Seguridad | Media | Webhook Apify sin verificación de firma | `api/webhooks/apify-maps.ts:11` |
| M4 | Seguridad | Media | Keys sensibles con prefijo `VITE_` (mina futura, hoy no van al bundle) | `.env.local:4,7,15,17,25` |
| M5 | Seguridad | Media | `token_usage_os` público + tokenGuard client-side → límites bypasseables | `src/lib/tokenGuard.ts` |
| B1-B3 | Seguridad | Baja | Logs de auditoría públicos; sesión sin expiración; usernames en bundle | `api_audit_logs`, `Configuracion.tsx:470` |
| F1 | Funcional | Crítica | Sección CONTENIDO rota: `content_os` con RLS activado y 0 políticas | BD + `src/pages/contenido/*` |
| F2 | Funcional | Crítica | Sync web roto: `quiz_leads` sin política SELECT; error tragado en silencio. 1 quiz_lead en BD, 0 sincronizados | `src/lib/syncWebLeads.ts:52,127` |
| F3 | Funcional | Crítica | Webhook Retell → Supabase no existe; tabla `call_analysis_os` no existe | `api/webhooks/` |
| F4 | Funcional | Media | Radar telemetría muerto: realtime en tabla cuyo SELECT es solo `authenticated` | `src/App.tsx:29-40` |
| F5 | Funcional | Media | 13 fases declaradas, 4 en uso; sin guardas de transición; `brechas_detectadas` legacy | `supabaseClient.ts:97-111` |
| F6 | Funcional | Media | `FASE_COLOR` duplicado con valores contradictorios | `KanbanBoard.tsx:26` vs `FaseSelector.tsx:6` |
| F8 | Funcional | Baja | 87 problemas lint (80 errores): setState-in-effect, deps de hooks, `any` | `npm run lint` |
| F9-F11 | Funcional | Baja | Página muerta (`Biblioteca.tsx`), tabla muerta (`outreach_os`), basura en raíz (tests, SQLs, 3 proyectos ajenos) | raíz del repo |
| F12 | Funcional | Baja | 17 archivos modificados sin commitear — drift local vs. prod | git status |
| D1 | UX/UI | Baja | Emojis en UI (🔥 ✅ ✕) contra la regla del DS | `App.tsx:35`, `apifyClient.ts:193`, `Roadmap.tsx:199` |
| D2 | UX/UI | Baja | Animaciones >300ms: token 400ms, GSAP 1.2s, barras 800ms | `globals.css:45`, `Dashboard.tsx:65,324` |
| D3 | UX/UI | Baja | 23 hex fuera de tokens (colores de fase) en 6 archivos | `FaseSelector.tsx:6-14` y otros |
| D4 | UX/UI | Baja | "Administrador" hardcodeado para todos los usuarios | `Sidebar.tsx:236` |
| U1 | UX/UI | Media | Kanban: 13 columnas, 9 siempre vacías | `KanbanBoard.tsx:356` |
| U2 | UX/UI | Media | Sin búsqueda por texto en Leads (95 leads) | `src/pages/Leads.tsx` |
| U3 | UX/UI | Media | "Email enviado" requiere 2º click manual → funnel miente si se olvida | `Leads.tsx:1224,1275` |
| U4-U7 | UX/UI | Baja | Dropdown 13 fases; sync falla en silencio; cards sin datos de acción; sin cockpit post-envío | varios |

---

## Fase 4 — Brecha vs. visión de producto

Visión: embudo completo en una herramienta — prospección, análisis de negocio,
detección de brechas, propuestas tono Hormozi, contenido RRSS con brand kit.

| Pilar de la visión | Estado | Detalle |
|--------------------|--------|---------|
| Prospección de leads | ✅ Construido | Apify Maps + cascada email (5 actores) + decisor LinkedIn + calculadora web (sync roto, F2) |
| Análisis de negocio | ✅ Construido | "Analizar brechas" con Claude, individual y por lote |
| Detección de brechas | ✅ Construido | `analisis_brechas` jsonb: brechas, puntos email, ahorro, recomendación |
| Propuestas tono Hormozi | 🟡 Parcial | `generarPropuestaComercial` (`claudeApi.ts:550`) + email Hormozi existen. Falta: entrega (PDF/link con tracking) y las fases de cierre no tienen herramientas |
| Contenido RRSS con brand kit | 🟡 Parcial | Generador texto IG/LinkedIn + calendario + biblioteca (roto por F1). **Sin brand kit**: cero integración visual (plantillas, colores, logo, imágenes) |
| (Implícito) Demos de voz | 🟡 Parcial | Crear agente Retell + audio demos + DemoPlayer público funcionan. **Sin call analysis** (F3): no sabes qué pasa en las llamadas |

**Dato relevante**: los 7 PDFs del ADN Hormozi en `/docs` (playbook, estilo, guardarraíles) NO están conectados a los prompts — `claudeApi.ts` usa un prompt inline genérico. Material de calibración pagado sin explotar.

### Qué falta, priorizado por impacto en ingresos

1. **Reparar fugas del embudo actual** (F2 + U3 + F1) — leads web que ya pagaste en captar se pierden hoy; el funnel miente. 2 políticas SQL + 1 ajuste UX. *Impacto inmediato, esfuerzo mínimo.*
2. **Cockpit de cierre** — 18 leads en `email_enviado` sin herramientas: vista "qué toca hoy" (follow-ups del día), registro de respuestas, acciones por fase post-envío. El dinero se cierra ahí, no en la prospección.
3. **Seguridad C1-C4** — no genera ingresos pero un borrado malicioso de `leads_os` (posible hoy por cualquiera) destruye el pipeline entero. Riesgo existencial.
4. **Retell call analysis** (F3) — webhook + tabla + vista en LeadDetalle. La llamada demo es el momento wow que convierte; ahora mismo eres ciego a lo que pasa en ellas.
5. **Propuesta entregable con tracking** — reutilizar el patrón DemoPlayer (`/d/:id`): link público de propuesta con telemetría de apertura. Aviso "X está leyendo tu propuesta" = timing de cierre perfecto.
6. **Brand kit en contenido + ADN Hormozi en prompts** — conectar los PDFs de `/docs` a los prompts y añadir capa visual al generador. Top of funnel: más lento en convertirse en caja.

---

## Top 5 mejoras priorizadas

| # | Mejora | Por qué | Esfuerzo |
|---|--------|---------|----------|
| 1 | Políticas RLS para `content_os` (CRUD) y `quiz_leads` (SELECT) | Repara Contenido + sync web: leads perdiéndose hoy | ~5 min SQL |
| 2 | Auth real: JWT/cookie en `/api/auth`, verificado en todos los `/api/*`, y Supabase solo vía serverless (quitar políticas anon) | Cierra C1-C4 de raíz con un solo mecanismo | 1-2 días |
| 3 | Cockpit de cierre (vista "hoy" + acciones fases post-envío) | Donde se convierte pipeline en ingresos | 2-3 días |
| 4 | Kanban limitado a fases activas + búsqueda de texto + auto-marcar email enviado | Quita las 3 fricciones diarias mayores | 1 día |
| 5 | Webhook Retell + tabla `call_analysis_os` + vista en lead | Cierra el ciclo demo → llamada → análisis | 1-2 días |

## Qué NO tocar (funciona bien)

- **Kanban drag&drop**: optimista + revert + toast, sólido (`KanbanBoard.tsx:315-344`)
- **Flujo extracción Apify**: run → webhook → normalización → dedupe, completo
- **Cascada email finder** (5 actores con fallbacks)
- **Design system base**: tokens, Bricolage/Inter, Phosphor, spacing 4pt — no rediseñar, solo corregir desviaciones
- **QuickView** y **DemoPlayer público** (`/d/:id`): patrones buenos, reutilizables
- **Patrón proxy serverless**: arquitectura correcta, solo falta autenticarla
- Los 95 leads y datos reales de BD: cualquier fix de RLS debe probarse en tabla de prueba antes

---

*Auditoría realizada el 2026-07-03. Ningún fix aplicado — pendiente de aprobación por fases.*
