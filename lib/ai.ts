// lib/ai.ts
// IA con OpenAI — solo usar en Server Components / Route Handlers
import type { AIProductOutput, AIPromoOutput, DashboardStats } from '@/types'

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<string> {
  const res = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content as string
}

// response_format json_object garantiza JSON puro — no necesita limpieza
function parseJSON<T>(raw: string): T {
  return JSON.parse(raw) as T
}

// ── Generar producto completo desde texto libre ─────────────────────────────
export async function generateProductAI(
  rawText: string,
  businessName: string,
  businessType = 'comercio'
): Promise<AIProductOutput> {
  const system = `Sos un experto en marketing para comercios latinoamericanos.
Respondés SIEMPRE con un JSON válido y nada más.
El JSON debe tener exactamente estas keys:
name, description, category, tags (array), instagram_copy, whatsapp_copy, hashtags (array), seo_title, seo_description.`

  const user = `Comercio: "${businessName}" (tipo: ${businessType}).
El dueño escribió: "${rawText}"

Generá el JSON con:
- name: nombre del producto limpio y comercial
- description: descripción atractiva de 2-3 oraciones para el tipo de negocio
- category: categoría sugerida (1-2 palabras)
- tags: array de 4 tags relevantes
- instagram_copy: texto para post de Instagram con emojis (máx 150 chars)
- whatsapp_copy: texto corto para compartir por WhatsApp (máx 80 chars)
- hashtags: array de 5 hashtags con #
- seo_title: título SEO optimizado (máx 60 chars)
- seo_description: descripción SEO convincente (máx 155 chars)`

  const raw = await callOpenAI(system, user, 800)
  return parseJSON<AIProductOutput>(raw)
}

// ── Generar promo / campaña ─────────────────────────────────────────────────
export async function generatePromoAI(
  businessName: string,
  context: string
): Promise<AIPromoOutput> {
  const system = `Sos un experto en marketing digital para pequeños comercios latinoamericanos.
Respondés SIEMPRE con un JSON válido y nada más.
El JSON debe tener exactamente estas keys: title, body, instagram_story, whatsapp_message, cta.`

  const user = `Comercio: "${businessName}"
Idea para la promo: "${context}"

Generá el JSON con:
- title: título de la promo (máx 8 palabras)
- body: descripción completa (2-3 oraciones)
- instagram_story: texto para historia de Instagram con emojis (máx 100 chars)
- whatsapp_message: mensaje para difundir por WhatsApp (máx 120 chars)
- cta: llamada a la acción corta (máx 5 palabras, ej: "Pedí ahora por WhatsApp")`

  const raw = await callOpenAI(system, user, 600)
  return parseJSON<AIPromoOutput>(raw)
}

// ── Generar insights del negocio ────────────────────────────────────────────
export async function generateInsightsAI(
  businessName: string,
  stats: Partial<DashboardStats> & { cancelRate?: number }
): Promise<string[]> {
  const topProds =
    stats.topProducts
      ?.slice(0, 3)
      .map(p => p.name)
      .join(', ') ?? 'sin datos'

  const system = `Sos un consultor de negocios para pequeños comercios latinoamericanos.
Respondés SIEMPRE con un JSON válido y nada más.
El JSON debe tener exactamente esta key: insights (array de strings).`

  const user = `Comercio: "${businessName}"

Datos del período:
- Pedidos pendientes sin confirmar: ${stats.pendingOrders ?? 0}
- Pedidos confirmados: ${stats.confirmedOrders ?? 0}
- Ingresos totales: $${stats.totalRevenue ?? 0}
- Tasa de cancelación: ${stats.cancelRate ?? 0}%
- Productos más vendidos: ${topProds}
- Clientes totales: ${stats.totalCustomers ?? 0}

Generá exactamente 3 insights prácticos, directos y accionables en español rioplatense.
Cada insight debe ser una sola oración que el dueño pueda actuar HOY.
Devolvé: { "insights": ["insight 1", "insight 2", "insight 3"] }`

  const raw = await callOpenAI(system, user, 400)
  const parsed = parseJSON<{ insights: string[] }>(raw)
  return parsed.insights
}
