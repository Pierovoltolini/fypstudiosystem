// app/api/bookings/route.ts
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`bookings:${ip}`, 10, '1 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá en un momento.' }, { status: 429 })

    const body = await req.json()
    const {
      businessId, branchId, staffId, productId,
      customerName, customerPhone, date, startTime, endTime,
      durationMin, price, notes, source,
    } = body

    if (!businessId || !customerName || !date || !startTime)
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const supabase = createServiceClient()

    // Verificar comercio activo
    const { data: biz } = await supabase
      .from('businesses').select('id,active').eq('id',businessId).single()
    if (!biz?.active)
      return NextResponse.json({ error: 'Comercio no disponible' }, { status: 403 })

    // Verificar conflicto de horario
    if (staffId) {
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id,start_time,end_time')
        .eq('staff_id', staffId)
        .eq('date', date)
        .not('status','in','(cancelled,noshow)')

      const hasConflict = (conflicts??[]).some(b => {
        return startTime < b.end_time && endTime > b.start_time
      })
      if (hasConflict)
        return NextResponse.json({ error: 'Ese horario ya está reservado' }, { status: 409 })
    }

    // Upsert cliente
    let customerId: string|null = null
    if (customerPhone) {
      const { data: customer } = await supabase
        .from('customers')
        .upsert({ business_id:businessId, name:customerName, phone:customerPhone },
          { onConflict:'business_id,phone' })
        .select('id').single()
      customerId = customer?.id ?? null
    }

    const { data, error } = await supabase.from('bookings').insert({
      business_id:    businessId,
      branch_id:      branchId || null,
      staff_id:       staffId  || null,
      product_id:     productId|| null,
      customer_name:  customerName,
      customer_phone: customerPhone || null,
      date, start_time:startTime, end_time:endTime,
      duration_min:   durationMin ?? 30,
      price:          price ?? null,
      notes:          notes || null,
      status:         'pending',
      source:         source ?? 'store',
    }).select('id').single()

    if (error) throw error

    return NextResponse.json({ bookingId: data.id })
  } catch (err) {
    console.error('[bookings POST]', err)
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }
}
