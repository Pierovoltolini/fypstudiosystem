// app/api/validate-coupon/route.ts
// Public — validates a discount code for a given business and subtotal
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`coupon:${ip}`, 20, '1 m')
    if (limited)
      return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })

    const { business_id, code, subtotal } = await req.json() as {
      business_id?: string; code?: string; subtotal?: number
    }

    if (!business_id || !code || subtotal == null)
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: dc } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('business_id', business_id)
      .ilike('code', code.trim())
      .eq('active', true)
      .maybeSingle()

    if (!dc)
      return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if (dc.expires_at && new Date(dc.expires_at) < new Date())
      return NextResponse.json({ error: 'expired' }, { status: 422 })

    if (dc.max_uses != null && dc.uses_count >= dc.max_uses)
      return NextResponse.json({ error: 'exhausted' }, { status: 422 })

    if (subtotal < dc.min_order)
      return NextResponse.json(
        { error: 'min_order', min_order: dc.min_order },
        { status: 422 }
      )

    const discount = dc.type === 'percent'
      ? Math.min((subtotal * dc.value) / 100, subtotal)
      : Math.min(dc.value, subtotal)

    return NextResponse.json({
      ok: true,
      code:     dc.code,
      type:     dc.type,
      value:    dc.value,
      discount: Math.round(discount * 100) / 100,
    })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
