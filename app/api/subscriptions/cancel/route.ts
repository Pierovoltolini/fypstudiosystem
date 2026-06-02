// app/api/subscriptions/cancel — Cancela la suscripción activa en MP y baja el plan a basic
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH() {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

    // ── Auth ────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })
    if (profile.role !== 'owner')
      return NextResponse.json({ error: 'Solo el dueño puede cancelar el plan' }, { status: 403 })

    const service = createServiceClient()

    // ── Obtener suscripción activa ──────────────────────────────
    const { data: sub } = await service
      .from('subscriptions')
      .select('mercadopago_subscription_id, plan')
      .eq('business_id', profile.business_id)
      .maybeSingle()

    // ── Cancelar en MP si hay subscription_id ──────────────────
    if (sub?.mercadopago_subscription_id && accessToken) {
      await fetch(
        `https://api.mercadopago.com/preapproval/${sub.mercadopago_subscription_id}`,
        {
          method:  'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      )
    }

    // ── Actualizar DB ───────────────────────────────────────────
    await Promise.all([
      service.from('subscriptions').upsert(
        {
          business_id:  profile.business_id,
          plan:         'basic',
          status:       'cancelled',
          mercadopago_subscription_id: null,
          current_period_end:          null,
          updated_at:                  new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      ),
      service.from('businesses')
        .update({ plan: 'basic', updated_at: new Date().toISOString() })
        .eq('id', profile.business_id),
      service.from('billing_events').insert({
        business_id:   profile.business_id,
        event_type:    'cancelled_by_user',
        mercadopago_id: sub?.mercadopago_subscription_id ?? null,
        payload:       { previous_plan: sub?.plan ?? 'unknown' },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscriptions/cancel]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
