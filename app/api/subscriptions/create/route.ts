// app/api/subscriptions/create — Crea una preaprobación de MercadoPago y retorna la URL de checkout
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PLAN_PRICES } from '@/lib/plan-limits'
import { z } from 'zod'
import type { Plan } from '@/types'

const schema = z.object({
  plan:  z.enum(['pro', 'premium']),
  cycle: z.enum(['monthly', 'annual']),
})

const MP_API = 'https://api.mercadopago.com/preapproval'

export async function POST(req: Request) {
  try {
    // Feature flag — desactivar MP sin tocar código
    if (process.env.MERCADOPAGO_ENABLED !== 'true')
      return NextResponse.json({ error: 'Pagos online no disponibles aún. Contactanos para upgradear.' }, { status: 503 })

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken)
      return NextResponse.json({ error: 'Pagos no configurados' }, { status: 503 })

    // ── Auth ────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, role, email, business:businesses(plan, name)')
      .eq('user_id', user.id)
      .single()

    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })
    if (profile.role !== 'owner')
      return NextResponse.json({ error: 'Solo el dueño puede cambiar el plan' }, { status: 403 })

    // ── Validar body ────────────────────────────────────────────
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

    const { plan, cycle } = parsed.data
    const prices   = PLAN_PRICES[plan]
    const amount   = cycle === 'annual' ? prices.annual : prices.monthly
    const bizName  = (profile.business as { name?: string } | null)?.name ?? 'Tu negocio'
    const payerEmail = profile.email ?? user.email ?? ''

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // ── Crear preaprobación en MP ───────────────────────────────
    // Frecuencia: mensual = 1 mes | anual = 12 meses
    const frequency      = cycle === 'annual' ? 12 : 1
    const planLabel      = plan === 'pro' ? 'Pro' : 'Premium'
    const cycleLabel     = cycle === 'annual' ? 'Anual' : 'Mensual'

    const mpBody = {
      reason:      `FYP Studio ${planLabel} · ${cycleLabel}`,
      auto_recurring: {
        frequency,
        frequency_type:     'months',
        transaction_amount: amount,
        currency_id:        'USD',
      },
      payer_email: payerEmail,
      back_url:    `${appUrl}/admin/planes?payment=success`,
      external_reference: JSON.stringify({
        business_id: profile.business_id,
        plan,
        cycle,
      }),
    }

    const mpRes = await fetch(MP_API, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${accessToken}`,
      },
      body: JSON.stringify(mpBody),
    })

    if (!mpRes.ok) {
      const err = await mpRes.json()
      console.error('[subscriptions/create] MP error:', err)
      return NextResponse.json({ error: 'Error creando suscripción en MercadoPago' }, { status: 502 })
    }

    const mpData = await mpRes.json()

    // ── Guardar preapproval_id en subscriptions (pendiente) ────
    const service = createServiceClient()
    await service.from('subscriptions').upsert(
      {
        business_id:                 profile.business_id,
        plan:                        plan as Plan,
        status:                      'active',
        billing_cycle:               cycle,
        mercadopago_subscription_id: mpData.id,
        updated_at:                  new Date().toISOString(),
      },
      { onConflict: 'business_id' }
    )

    return NextResponse.json({ init_point: mpData.init_point })
  } catch (err) {
    console.error('[subscriptions/create]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
