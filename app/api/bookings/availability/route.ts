// app/api/bookings/availability/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`availability:${ip}`, 60, '1 m')
    if (limited)
      return NextResponse.json({ booked: {}, blocked: {} }, { status: 429 })

    const { searchParams } = new URL(req.url)
    const staffId    = searchParams.get('staffId')
    const businessId = searchParams.get('businessId')
    const from       = searchParams.get('from')
    const to         = searchParams.get('to')

    if (!from || !to)
      return NextResponse.json({ booked: {}, blocked: {} })

    const supabase = createServiceClient()

    // 1. Turnos ya reservados
    let bookingQuery = supabase
      .from('bookings')
      .select('date, start_time, status')
      .gte('date', from)
      .lte('date', to)
      .not('status', 'in', '(cancelled,noshow)')

    if (staffId) bookingQuery = bookingQuery.eq('staff_id', staffId)
    else if (businessId) bookingQuery = bookingQuery.eq('business_id', businessId)

    const { data: bookings } = await bookingQuery

    // 2. Días/slots bloqueados manualmente
    let blockedQuery = supabase
      .from('blocked_slots')
      .select('date, time_slot, reason')
      .gte('date', from)
      .lte('date', to)

    if (staffId)    blockedQuery = blockedQuery.or(`staff_id.eq.${staffId},staff_id.is.null`)
    if (businessId) blockedQuery = blockedQuery.eq('business_id', businessId)

    const { data: blocked } = await blockedQuery

    // Agrupar bookings: { 'YYYY-MM-DD': ['09:00', '09:30'] }
    const bookedMap: Record<string, string[]> = {}
    for (const b of bookings ?? []) {
      if (!bookedMap[b.date]) bookedMap[b.date] = []
      bookedMap[b.date].push(b.start_time.slice(0, 5))
    }

    // Agrupar blocked: { 'YYYY-MM-DD': { allDay: bool, slots: ['10:00'] } }
    const blockedMap: Record<string, { allDay: boolean; slots: string[]; reason?: string }> = {}
    for (const bl of blocked ?? []) {
      if (!blockedMap[bl.date]) blockedMap[bl.date] = { allDay: false, slots: [], reason: bl.reason ?? undefined }
      if (!bl.time_slot) {
        blockedMap[bl.date].allDay = true
        blockedMap[bl.date].reason = bl.reason ?? undefined
      } else {
        blockedMap[bl.date].slots.push(bl.time_slot)
      }
    }

    return NextResponse.json({ booked: bookedMap, blocked: blockedMap })
  } catch (err) {
    console.error('[availability]', err)
    return NextResponse.json({ booked: {}, blocked: {} })
  }
}
