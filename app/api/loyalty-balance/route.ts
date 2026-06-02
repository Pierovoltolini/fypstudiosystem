import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`loyalty-balance:${ip}`, 20, '1 m')
    if (limited) return NextResponse.json({ points: 0 }, { status: 429 })

    const { business_id, phone } = await req.json() as { business_id: string; phone: string }
    if (!business_id || !phone) return NextResponse.json({ points: 0 })

    const supabase = createServiceClient()

    // Fetch loyalty settings
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('enabled, redeem_ratio, min_redeem')
      .eq('business_id', business_id)
      .single()

    if (!settings?.enabled) return NextResponse.json({ points: 0, enabled: false })

    // Look up customer by phone
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('business_id', business_id)
      .eq('phone', phone.replace(/[^\d+]/g, ''))
      .single()

    if (!customer) return NextResponse.json({ points: 0, enabled: true })

    // Get total points via RPC
    const { data: points } = await supabase
      .rpc('get_customer_points', { p_business_id: business_id, p_customer_id: customer.id })

    const total = (points as number) ?? 0
    const redeemValue = total >= settings.min_redeem
      ? parseFloat((total / settings.redeem_ratio).toFixed(2))
      : 0

    return NextResponse.json({
      enabled:       true,
      customer_id:   customer.id,
      customer_name: customer.name,
      points:        total,
      redeem_value:  redeemValue,
      min_redeem:    settings.min_redeem,
      redeem_ratio:  settings.redeem_ratio,
    })
  } catch {
    return NextResponse.json({ points: 0 })
  }
}
