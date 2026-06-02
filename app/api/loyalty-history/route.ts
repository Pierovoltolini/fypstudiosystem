import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`loyalty-history:${ip}`, 20, '1 m')
    if (limited) return NextResponse.json({ rows: [] }, { status: 429 })

    const { business_id, customer_id } = await req.json() as { business_id: string; customer_id: string }
    if (!business_id || !customer_id) return NextResponse.json({ rows: [] })

    const supabase = createServiceClient()

    const { data } = await supabase
      .from('loyalty_points')
      .select('id, points, reason, note, created_at')
      .eq('business_id', business_id)
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ rows: data ?? [] })
  } catch {
    return NextResponse.json({ rows: [] })
  }
}
