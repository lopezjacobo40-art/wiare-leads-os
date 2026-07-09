# CLAUDE.md — WIARE Leads OS

CRM interno de WIARE (agencia española: agentes de voz IA sobre Retell para negocios locales — clínicas, restaurantes). 2 usuarios: `jacobo` (admin), `luis`. Todo en español.

## Comandos

- Build (obligatorio antes de dar algo por hecho): `npm run build` — corre `tsc -b` con `noUnusedLocals`; `tsc --noEmit` NO detecta lo mismo. 0 errores.
- Lint: `npm run lint` (debe quedar en 0 problemas).
- Deploy a producción: `npx vercel --prod --yes`. Verificar bundle nuevo: `curl -s https://wiare-leads-os.vercel.app | grep -o 'index-[A-Za-z0-9_-]*\.js'`.
- **La validación se hace SIEMPRE contra producción** (Vercel). Jacobo no usa `npm run dev`.
- Scripts Node sueltos: ejecutarlos desde la raíz del repo (resuelven `node_modules` locales).

## Stack real

- React 19 + Vite 8, SPA con rutas lazy (`src/App.tsx`). React Router 7.
- **Sin Tailwind.** Estilos = tokens CSS en `src/styles/globals.css` (`--color-*`, `--radius-*`, `--shadow-*`, `--space-*`) + clases del design system (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.badge`) + estilos inline.
- Supabase (Postgres + Auth) — proyecto `pdpcrueqwmhammtuisob`, plan Free. MCP de Supabase disponible (`execute_sql`, `apply_migration` para DDL).
- Vercel serverless en `/api/*.ts` (`@vercel/node`), plan **Hobby**.
- Scraping: Apify vía proxy `/api/apify` (patrón run→polling en `src/lib/apifyClient.ts#correrActor`).
- IA: Claude vía `/api/claude`, Gemini vía `/api/gemini` (`gemini-2.5-flash`). Motor elegible por el usuario (`src/lib/iaProvider.ts`, localStorage `ia_provider`, **default gemini** por coste).

## Límites duros de plataforma (te van a morder)

- **Vercel Hobby: máx 12 funciones serverless — YA están las 12.** Un `api/*.ts` nuevo da **404 silencioso sin error de build**. Endpoint nuevo = consolidar en uno existente (precedentes: proxy de media de IG en `/api/news?media=<url>`; cron de competidores en `GET /api/apify`). `maxDuration` por función en `vercel.json`.
- Crons en `vercel.json` (Hobby: máx 2, granularidad diaria). Vercel los invoca con `Authorization: Bearer $CRON_SECRET` (env ya creada).
- Supabase Free: **sin backups automáticos** — nada de DELETE/DROP masivo sin respaldo previo; ya se perdió una extracción real por un bug. Sin PITR.
- Retención de logs de runtime en Vercel: 1 hora. Para verificar que algo corrió, mejor buscar su efecto en la BD que en los logs.

## Auth y API

- Supabase Auth email/password. Frontend adjunta `Authorization: Bearer <token>` con `authHeaders()` de `src/lib/supabaseClient.ts`.
- Todo endpoint `/api/*` empieza con `if (!(await requireAuth(req, res))) return` (`api/_lib/verifyAuth.ts`). Excepciones deliberadas: media proxy (los `<img>` no mandan headers; host whitelisted) y cron (CRON_SECRET).
- `api/_lib/` no cuenta como función — el código server compartido va ahí.
- Env keys: las de servidor se leen `process.env.X || process.env.VITE_X`. **`VITE_GEMINI_API_KEY` es la única key de Gemini: no renombrar ni borrar** (decisión explícita de Jacobo). No crear keys `VITE_*` nuevas que se usen en cliente.

## Base de datos

- Todas las tablas del dominio llevan sufijo `_os`. RLS patrón herramienta interna: `create policy authenticated_all ... for all to authenticated using (true) with check (true)` — decisión consciente para 2 usuarios; las tablas nuevas siguen ese patrón.
- DDL siempre vía `apply_migration` (queda historial), datos vía `execute_sql`.
- Tablas núcleo: `leads_os` (pipeline; jsonb `analisis_brechas`), `lead_touches_os` (historial de toques), `extracciones_os`, `content_ideas_os` / `content_pillars_os` / `brand_kit_os` / `brand_voice_examples_os`, `competitors_os` / `competitor_snapshots_os` / `competitor_posts_os`, `token_usage_os` (contador diario de IA — se inserta SOLO tras éxito de la llamada: sirve como evidencia de runs exitosos), `content_stories_os` (**permanente** — decisión de Jacobo; las secuencias de Historias viven ahí, no en ideas).

## Reglas de dominio cableadas en el código

- Fases: leads usan `nuevo|negocio_analizado|listo_para_enviar|email_enviado|respondido|reunion_agendada|sin_respuesta|baja` (activas; las de cierre CRM aparecen solo si tienen leads); contenido usa `idea|en_progreso|listo|publicado` re-etiquetados en UI como Backlog/Borrador/Programado/Publicado. **Nunca migrar valores en BD para cambiar una etiqueta — solo re-mapear en UI.**
- Cold email: secuencia D0 email → D3 email → D7 WhatsApp → D14 breakup → fase `sin_respuesta`, en `src/lib/followUp.ts`. Marcar enviado registra timestamp + copy usado + programa el siguiente toque. Cupo 15 emails/día (deliverability).
- Contenido: pasar a "Programado" exige `fecha_publicacion`. Colores/fuentes de marca se leen de `brand_kit_os` vía `useBrandKit()` (fallback `#6366F1`/`#22D3EE`) — nunca hardcodear los de marca en features nuevas.
- Emails de outreach: nunca inventar patrones tipo `info@dominio` — solo emails encontrados (cascada de 5 scrapers en `apifyClient.ts`).

## Convenciones UI

- Sin emojis en la UI. Iconos: Phosphor (`@phosphor-icons/react`). Fuentes: Bricolage Grotesque (display) + Inter (body).
- Página nueva = `PageHeader` + `PageTransition` + `Skeleton` para carga + `EmptyState` que enseña el flujo. CTAs de cabecera: 36px/13px.
- Charts: paleta categórica validada `#6366F1, #0891B2, #8B5CF6, #16A34A, #D97706` sobre `#FAFAFA` (el cyan/ámbar de marca puros fallan contraste). Tooltip + leyenda para 2+ series.

## Llamadas a IA (patrón del repo)

- Prompts piden **JSON crudo sin markdown**; parseo siempre en `try/catch` con `console.error` del raw ante fallo (ver `generarCaption`, `aconsejarReplicas` en `src/lib/claudeApi.ts`).
- Generación de contenido pasa por `generarTextoContenido(prompt, maxTokens, proveedor)` (router Claude/Gemini) y `guardedCall` (límite diario + registro de uso).
- Contexto de marca en prompts: `HORMOZI_ADN_CORE` + `tono_voz` de `brand_kit_os` + ejemplos de `brand_voice_examples_os`. Prohibido en copy de cliente: "IA", "bot", "algoritmo".

## ESLint — desviaciones deliberadas

- `react-hooks/set-state-in-effect: off` (regla de React Compiler; el patrón `useEffect(() => { cargar() }, [])` del repo la dispara en falso). Documentado en `eslint.config.js`.
- `react-hooks/purity`: no llamar `Date.now()` en render — usar una `const AHORA = Date.now()` a nivel de módulo (precedente en Dashboard, Analítica, Configuración).

## Nunca sin confirmación de Jacobo

- Borrar leads/datos de producción; `DROP TABLE`.
- Cambiar fase de un cliente a `activo`/`baja` o tocar fees.
- Enviar emails reales o publicar contenido fuera del sistema.
