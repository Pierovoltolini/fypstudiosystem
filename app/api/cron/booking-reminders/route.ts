// app/api/cron/booking-reminders/route.ts
// Envía recordatorios de turno para el día siguiente.
// Protegido con CRON_SECRET.

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FROM = process.env.EMAIL_FROM ?? 'FYP Studio <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fyp.studio'

function fmtDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)

  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function fmtTime(time: string): string {
  return time.slice(0, 5)
}

type RelationName = { name: string } | { name: string }[] | null

type BookingRow = {
  id: string
  business_id: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  date: string
  start_time: string
  end_time: string
  business: RelationName
  product: RelationName
}

function getRelationName(value: RelationName): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.name ?? null
  return value.name ?? null
}

function customerReminderHtml(data: {
  customerName: string
  businessName: string
  dateLabel: string
  startTime: string
  serviceName: string | null
}): string {
  const { customerName, businessName, dateLabel, startTime, serviceName } = data

  const serviceRow = serviceName
    ? `<tr>
        <td style="padding:6px 0;font-size:13px;color:#6B7280;width:110px;">Servicio</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${serviceName}</td>
       </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Recordatorio de turno</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#1565FF 0%,#6366F1 100%);padding:36px 40px 28px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;">📅</div>
        <span style="color:#fff;font-size:16px;font-weight:800;letter-spacing:-0.3px;">FYP Studio</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;line-height:1.2;">Recordatorio de turno</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Hola ${customerName}, te esperamos mañana</p>
    </div>

    <div style="padding:32px 40px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tbody>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;width:110px;">Negocio</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${businessName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Fecha</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${dateLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Hora</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${startTime}</td>
          </tr>
          ${serviceRow}
        </tbody>
      </table>

      <div style="background:#EEF2FF;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#4338CA;">Si necesitás cancelar o modificar tu turno, contactá al negocio con anticipación.</p>
      </div>

      <div style="text-align:center;">
        <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#1565FF,#6366F1);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;">
          Ver detalles →
        </a>
      </div>
    </div>

    <div style="background:#F9FAFB;padding:16px 40px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="color:#9CA3AF;font-size:11px;margin:0;">Powered by <strong style="color:#6366F1;">FYP Studio</strong></p>
    </div>
  </div>
</body>
</html>`
}

function businessSummaryHtml(data: {
  businessName: string
  dateLabel: string
  bookings: {
    customerName: string
    startTime: string
    endTime: string
    serviceName: string | null
    customerPhone: string | null
  }[]
}): string {
  const { businessName, dateLabel, bookings } = data

  const rows = bookings
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((b) => {
      const service = b.serviceName ?? '—'
      const phone = b.customerPhone
        ? `<a href="tel:${b.customerPhone}" style="color:#6366F1;">${b.customerPhone}</a>`
        : '—'

      return `<tr>
        <td style="padding:10px 12px;font-size:13px;color:#111827;border-bottom:1px solid #F3F4F6;font-weight:600;white-space:nowrap;">${fmtTime(b.startTime)}</td>
        <td style="padding:10px 12px;font-size:13px;color:#111827;border-bottom:1px solid #F3F4F6;">${b.customerName}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${service}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${phone}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Turnos de mañana — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#1565FF 0%,#6366F1 100%);padding:36px 40px 28px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;">📋</div>
        <span style="color:#fff;font-size:16px;font-weight:800;letter-spacing:-0.3px;">FYP Studio</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;line-height:1.2;">Turnos de mañana</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${businessName} · ${dateLabel}</p>
    </div>

    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Tenés <strong>${bookings.length} ${bookings.length === 1 ? 'turno' : 'turnos'}</strong> para mañana.
      </p>

      <div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#F9FAFB;">
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:left;letter-spacing:0.05em;">Hora</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:left;letter-spacing:0.05em;">Cliente</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:left;letter-spacing:0.05em;">Servicio</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;text-align:left;letter-spacing:0.05em;">Teléfono</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="text-align:center;margin-top:28px;">
        <a href="${APP_URL}/admin/bookings" style="display:inline-block;background:linear-gradient(135deg,#1565FF,#6366F1);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:12px;">
          Ver agenda completa →
        </a>
      </div>
    </div>

    <div style="background:#F9FAFB;padding:16px 40px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="color:#9CA3AF;font-size:11px;margin:0;">
        Powered by <strong style="color:#6366F1;">FYP Studio</strong> ·
        <a href="${APP_URL}/admin/settings" style="color:#9CA3AF;">Configurar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const dateLabel = fmtDate(tomorrowStr)

  const { data: bookings, error } = await service
    .from('bookings')
    .select(
      'id, business_id, customer_name, customer_email, customer_phone, date, start_time, end_time, business:businesses(name), product:products(name)'
    )
    .eq('date', tomorrowStr)
    .not('status', 'in', '(cancelled,noshow)')
    .is('reminder_sent_at', null)
    .not('customer_email', 'is', null)

  if (error) {
    console.error('[booking-reminders] Error fetching bookings:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!bookings?.length) {
    return NextResponse.json({ ok: true, customersSent: 0, businessesSent: 0 })
  }

  const apiKey = process.env.RESEND_API_KEY
  let customersSent = 0
  let businessesSent = 0
  const processedIds: string[] = []

  const rows = (bookings ?? []) as unknown as BookingRow[]
  const byBusiness = new Map<string, BookingRow[]>()

  for (const b of rows) {
    const list = byBusiness.get(b.business_id) ?? []
    list.push(b)
    byBusiness.set(b.business_id, list)
  }

  for (const [businessId, bizBookings] of Array.from(byBusiness.entries())) {
    const businessName = getRelationName(bizBookings[0].business) ?? 'Tu negocio'

    for (const booking of bizBookings) {
      const serviceName = getRelationName(booking.product)

      const html = customerReminderHtml({
        customerName: booking.customer_name,
        businessName,
        dateLabel,
        startTime: fmtTime(booking.start_time),
        serviceName,
      })

      if (apiKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM,
            to: [booking.customer_email],
            subject: `Recordatorio: tu turno mañana en ${businessName}`,
            html,
          }),
        })

        if (res.ok) customersSent++
      } else {
        console.log(`[booking-reminders] Simularía email a ${booking.customer_email} (${businessName})`)
        customersSent++
      }

      processedIds.push(booking.id)
    }

    try {
      const { data: profile } = await service
        .from('profiles')
        .select('user_id')
        .eq('business_id', businessId)
        .limit(1)
        .single()

      if (profile?.user_id) {
        const {
          data: { user: authUser },
        } = await service.auth.admin.getUserById(profile.user_id)

        const ownerEmail = authUser?.email

        if (ownerEmail) {
          const html = businessSummaryHtml({
            businessName,
            dateLabel,
            bookings: bizBookings.map((b) => ({
              customerName: b.customer_name,
              startTime: b.start_time,
              endTime: b.end_time,
              serviceName: getRelationName(b.product),
              customerPhone: b.customer_phone,
            })),
          })

          if (apiKey) {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: FROM,
                to: [ownerEmail],
                subject: `Turnos de mañana — ${businessName}`,
                html,
              }),
            })

            if (res.ok) businessesSent++
          } else {
            console.log(
              `[booking-reminders] Simularía resumen a ${ownerEmail} (${businessName}, ${bizBookings.length} turnos)`
            )
            businessesSent++
          }
        }
      }
    } catch (err) {
      console.error('[booking-reminders] Error enviando resumen al negocio', businessId, err)
    }
  }

  if (processedIds.length > 0) {
    const { error: updateErr } = await service
      .from('bookings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .in('id', processedIds)

    if (updateErr) {
      console.error('[booking-reminders] Error marcando reminder_sent_at:', updateErr)
    }
  }

  return NextResponse.json({
    ok: true,
    date: tomorrowStr,
    customersSent,
    businessesSent,
    total: processedIds.length,
  })
}