/* eslint-disable */
/*
 * Obtiene un refresh_token de Google OAuth2 de forma interactiva.
 *
 * Uso:
 *   1. Coloca tu credentials.json (OAuth2 Desktop App) en la raíz del proyecto,
 *      O define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET como variables de entorno.
 *   2. Ejecuta:  node scripts/get-google-token.js
 *   3. Abre la URL que imprime, autoriza, y pega el código de vuelta.
 *   4. Copia el refresh_token al .env (GOOGLE_REFRESH_TOKEN).
 *
 * Requiere: npm install googleapis  (ya instalado en este proyecto)
 */

import { google } from 'googleapis'
import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
]

function cargarCredenciales() {
  // Opción A: variables de entorno
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }
  }
  // Opción B: credentials.json en la raíz
  const ruta = path.resolve(process.cwd(), 'credentials.json')
  if (fs.existsSync(ruta)) {
    const json = JSON.parse(fs.readFileSync(ruta, 'utf8'))
    const cfg = json.installed || json.web
    if (cfg) return { clientId: cfg.client_id, clientSecret: cfg.client_secret }
  }
  console.error(
    '\n✗ No se encontraron credenciales.\n' +
      '  Coloca credentials.json en la raíz o define GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.\n'
  )
  process.exit(1)
}

async function main() {
  const { clientId, clientSecret } = cargarCredenciales()
  // 'urn:ietf:wg:oauth:2.0:oob' está deprecado; usamos el flujo de copiar/pegar manual.
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost')

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // fuerza la entrega de un refresh_token nuevo
    scope: SCOPES,
  })

  console.log('\n1) Abre esta URL en tu navegador y autoriza:\n')
  console.log('   ' + authUrl + '\n')
  console.log('2) Tras autorizar, el navegador te redirige a http://localhost/?code=XXXX')
  console.log('   Copia SOLO el valor del parámetro "code" de la URL.\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question('Pega el código aquí: ', async (code) => {
    rl.close()
    try {
      const { tokens } = await oauth2.getToken(code.trim())
      if (!tokens.refresh_token) {
        console.error(
          '\n✗ No se recibió refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y reintenta.\n'
        )
        process.exit(1)
      }
      console.log('\n✓ ¡Listo! Copia esta línea a tu .env:\n')
      console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n')
    } catch (err) {
      console.error('\n✗ Error al canjear el código:', err.message, '\n')
      process.exit(1)
    }
  })
}

main()
