# Configurar Google Sheets API

La función **Exportar a Google Sheets** usa OAuth2 server-side. El refresh token vive
solo en las variables de entorno de Vercel (nunca en el bundle del cliente).

## 1. Google Cloud Console

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto
   llamado **WIARE Leads OS**.
2. **APIs y servicios → Biblioteca** → habilita:
   - **Google Sheets API**
   - **Google Drive API**
3. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo: **Externo** → crea la app.
   - Añade tu cuenta de Google como **usuario de prueba** (Test user).
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo de aplicación: **App de escritorio** (Desktop App).
   - Descarga el `credentials.json` y guárdalo en la raíz del proyecto
     (ya está en `.gitignore`, no se sube).

## 2. Obtener el refresh token

Con `credentials.json` en la raíz (o con `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
en el entorno), ejecuta:

```bash
node scripts/get-google-token.js
```

1. Abre la URL que imprime y autoriza con tu cuenta.
2. El navegador redirige a `http://localhost/?code=XXXX` (mostrará error de conexión: es normal).
3. Copia el valor de `code` de la barra de direcciones y pégalo en la terminal.
4. El script imprime tu `GOOGLE_REFRESH_TOKEN`.

## 3. Variables de entorno

Añade en **`.env.local`** (local) y en **Vercel → Settings → Environment Variables**
(production):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_SHEET_ID=        # opcional — se autodetecta por nombre si se deja vacío
```

> Estas variables **no** llevan el prefijo `VITE_`: son server-side (API route),
> no deben exponerse al navegador.

## 4. Probar

1. Redeploy en Vercel (o `vercel dev` en local con las variables cargadas).
2. En **Leads** → botón **Exportar a Google Sheets** → Exportar.
3. Se crea/actualiza un único sheet maestro **"WIARE Leads OS — [fecha]"**.
   Cada exportación limpia las filas y reinserta los leads (no duplica).

## Notas

- El endpoint vive en [`api/export-sheets.ts`](api/export-sheets.ts) y se despliega
  automáticamente como Vercel Function.
- En **local con Vite** (`npm run dev`) el endpoint **no** existe — solo funciona con
  `vercel dev` o tras desplegar. El botón mostrará un error claro si el endpoint no responde.
- El sheet se reutiliza buscando en Drive cualquier archivo cuyo nombre empiece por
  `WIARE Leads OS`. Si defines `GOOGLE_SHEET_ID`, se salta la búsqueda y usa ese.
