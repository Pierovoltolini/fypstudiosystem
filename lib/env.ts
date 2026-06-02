// lib/env.ts — server-only
// Valida variables de entorno al arranque. Si falta alguna el proceso falla
// rápido en lugar de explotar en runtime con mensajes confusos.
import 'server-only'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
] as const

type EnvKey = typeof REQUIRED[number]

function validateEnv(): Record<EnvKey, string> {
  const missing = REQUIRED.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `[FYP.STUDIO] Variables de entorno faltantes:\n${missing.map(k => `  • ${k}`).join('\n')}\n` +
      `Copiá .env.example a .env.local y completá los valores.`
    )
  }
  return Object.fromEntries(REQUIRED.map(k => [k, process.env[k]!])) as Record<EnvKey, string>
}

export const env = validateEnv()
