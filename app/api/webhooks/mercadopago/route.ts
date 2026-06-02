// app/api/webhooks/mercadopago — Recibe y procesa eventos de MercadoPago
// Valida la firma HMAC-SHA256 antes de procesar cualquier evento.
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import type { Plan } from '@/types'

// ── Validación de firma MP ────────────────────────────────────
// Header x-signature: ts=<timestamp>,v1=<hmac>
// Template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
function validateSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return false

  const sig       = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''

  const parts: Record<string, string> = {}
  sig.split(',').forEach(part => {
    const [k, v] = part.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  })

  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // Extraer id del payload
  let dataId = ''
  try {
    const body = JSON.parse(rawBody)
    dataId = body?.data?.id ?? ''
  } catch { return false }

  const template = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(template).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
}

// ── Fetch preapproval desde MP ────────────────────────────────
async function fetchPreapproval(subscriptionId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── Mapeo de status MP → plan action ─────────────────────────
function resolveAction(mpStatus: string): 'activate' | 'cancel' | 'pause' | null {
  switch (mpStatus) {
    case 'authorized': return 'activate'
    case 'cancelled':
    case 'ended':      return 'cancel'
    case 'paused':     return 'pause'
    default:           return null
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Validar firma — en dev sin secret se permite pasar (facilita testing)
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (secret && !validateSignature(req, rawBody)) {
    console.warn('[webhook/mp] Firma inválida')
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const eventType = event.type as string
  const dataId    = (event.data as { id?: string } | null)?.id ?? ''

  // Solo procesamos eventos de preapproval (suscripciones)
  if (!eventType?.includes('preapproval') && eventType !== 'subscription_preapproval') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const service = createServiceClient()

  // Obtener detalles de la suscripción desde MP
  const preapproval = await fetchPreapproval(dataId)
  if (!preapproval) {
    return NextResponse.json({ error: 'No se pudo obtener la suscripción de MP' }, { status: 502 })
  }

  const mpStatus   = preapproval.status as string
  const action     = resolveAction(mpStatus)
  const externalRef = preapproval.external_reference

  // Parsear external_reference para obtener business_id y plan
  let businessId = ''
  let newPlan: Plan = 'basic'
  let billingCycle: 'monthly' | 'annual' = 'monthly'

  try {
    const ref = JSON.parse(externalRef ?? '{}')
    businessId  = ref.business_id ?? ''
    newPlan     = ref.plan        ?? 'basic'
    billingCycle = ref.cycle      ?? 'monthly'
  } catch {
    console.error('[webhook/mp] external_reference inválido:', externalRef)
    return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 })
  }

  if (!businessId) {
    return NextResponse.json({ error: 'business_id no encontrado en la referencia' }, { status: 400 })
  }

  // ── Registrar evento en billing_events ─────────────────────
  await service.from('billing_events').insert({
    business_id:   businessId,
    event_type:    `mp.${mpStatus}`,
    mercadopago_id: dataId,
    payload:       { event, preapproval: { id: preapproval.id, status: mpStatus } },
  })

  if (!action) {
    return NextResponse.json({ ok: true, status: mpStatus, action: 'none' })
  }

  // ── Período de vigencia ─────────────────────────────────────
  const periodEnd = preapproval.auto_recurring?.end_date
    ? new Date(preapproval.auto_recurring.end_date).toISOString()
    : null

  const now = new Date().toISOString()

  if (action === 'activate') {
    await Promise.all([
      service.from('businesses')
        .update({ plan: newPlan, updated_at: now })
        .eq('id', businessId),
      service.from('subscriptions').upsert(
        {
          business_id:                 businessId,
          plan:                        newPlan,
          status:                      'active',
          billing_cycle:               billingCycle,
          mercadopago_subscription_id: dataId,
          current_period_start:        now,
          current_period_end:          periodEnd,
          updated_at:                  now,
        },
        { onConflict: 'business_id' }
      ),
    ])
  } else if (action === 'cancel') {
    await Promise.all([
      service.from('businesses')
        .update({ plan: 'basic', updated_at: now })
        .eq('id', businessId),
      service.from('subscriptions').upsert(
        {
          business_id:  businessId,
          plan:         'basic',
          status:       'cancelled',
          mercadopago_subscription_id: null,
          current_period_end:          null,
          updated_at:                  now,
        },
        { onConflict: 'business_id' }
      ),
    ])
  } else if (action === 'pause') {
    await service.from('subscriptions').upsert(
      {
        business_id: businessId,
        status:      'past_due',
        updated_at:  now,
      },
      { onConflict: 'business_id' }
    )
  }

  return NextResponse.json({ ok: true, action, plan: newPlan })
}
