// lib/ratelimit.ts
// Rate limiting con Upstash Redis. Si las env vars no están configuradas
// (ej: desarrollo local sin Upstash) la función pasa sin limitar — no bloquea dev.
import 'server-only'

type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }

// Instancia Redis compartida entre todos los limiters
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisInstance: any = null

// Cache de limiters por configuración (requests:window) para no recrearlos por request
const limiterCache = new Map<string, Limiter>()

async function getLimiter(requests: number, window: string): Promise<Limiter | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null

  const cacheKey = `${requests}:${window}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached

  const { Ratelimit } = await import('@upstash/ratelimit')
  const { Redis }     = await import('@upstash/redis')

  if (!redisInstance) redisInstance = Redis.fromEnv()

  const rl = new Ratelimit({
    redis:     redisInstance,
    analytics: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    limiter:   Ratelimit.slidingWindow(requests, window as any),
  })

  limiterCache.set(cacheKey, rl)
  return rl
}

/**
 * Retorna true si la request debe ser bloqueada (rate limit excedido).
 *
 * @param key      Identificador único — ej: `orders:${ip}` o `ai-assistant:${userId}`
 * @param requests Número máximo de requests permitidos en la ventana
 * @param window   Ventana de tiempo — ej: '1 m', '5 m', '1 h'
 */
export async function checkRateLimit(
  key:      string,
  requests  = 20,
  window    = '1 m',
): Promise<boolean> {
  const rl = await getLimiter(requests, window)
  if (!rl) return false
  const { success } = await rl.limit(key)
  return !success
}
