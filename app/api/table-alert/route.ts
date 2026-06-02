// app/api/table-alert/route.ts
// Called from the public store when a customer requests waiter or bill
// Uses service role to bypass RLS (no auth cookie available in public store)
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

type AlertAction = 'waiter' | 'bill'

const ACTION_STATUS: Record<AlertAction, string> = {
  waiter: 'waiting_attention',
  bill:   'bill_requested',
}

export async function POST(req: NextRequest) {
  try {
    const { qr_token, action } = await req.json() as { qr_token?: string; action?: AlertAction }

    // Rate limit por qr_token para evitar spam desde una mesa
    if (qr_token) {
      const limited = await checkRateLimit(`table-alert:${qr_token}`, 5, '1 m')
      if (limited)
        return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })
    }

    if (!qr_token || !action || !ACTION_STATUS[action]) {
      return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Find table by qr_token
    const { data: table, error: findErr } = await supabase
      .from('restaurant_tables')
      .select('id, status, business_id')
      .eq('qr_token', qr_token)
      .eq('active', true)
      .maybeSingle()

    if (findErr || !table) {
      return NextResponse.json({ error: 'table_not_found' }, { status: 404 })
    }

    const newStatus = ACTION_STATUS[action]

    // Update table status
    await supabase
      .from('restaurant_tables')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', table.id)

    // Update open session's alert fields
    await supabase
      .from('table_sessions')
      .update({ last_alert: action, alert_at: new Date().toISOString() })
      .eq('table_id', table.id)
      .eq('status', 'open')

    return NextResponse.json({ ok: true, status: newStatus })

  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
