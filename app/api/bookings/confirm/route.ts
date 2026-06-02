// app/api/bookings/confirm/route.ts
// Envía email de confirmación al cliente y a la barbería
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre']

function formatDate(dateStr: string) {
  const [y,m,d] = dateStr.split('-').map(Number)
  const day = new Date(y,m-1,d)
  const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  return `${days[day.getDay()]} ${d} de ${MONTHS_ES[m-1]} de ${y}`
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[email] No RESEND_API_KEY — simulando envío a', to)
    return true
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    process.env.EMAIL_FROM ?? 'FyP Studio <noreply@fyp.studio>',
        to:      [to],
        subject,
        html,
      }),
    })
    return res.ok
  } catch(e) {
    console.error('[email error]', e)
    return false
  }
}

function clientEmailHTML(data: {
  customerName: string; date: string; time: string; endTime: string
  service?: string; staff?: string; branch?: string; businessName: string
  color: string; businessEmail?: string
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Turno confirmado</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:${data.color};padding:32px 32px 24px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">✂️</div>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:800;">¡Turno confirmado!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">${data.businessName}</p>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="color:#374151;font-size:15px;margin:0 0 20px;">
      Hola <strong>${data.customerName}</strong>, tu turno está reservado 🎉
    </p>

    <!-- Detalle -->
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
      ${[
        ['📅 Fecha', formatDate(data.date)],
        ['🕐 Hora', `${data.time} — ${data.endTime} hs`],
        data.service ? ['✂️ Servicio', data.service] : null,
        data.staff   ? ['👤 Peluquero', data.staff]   : null,
        data.branch  ? ['📍 Lugar', data.branch]       : null,
      ].filter((r): r is string[] => r !== null).map(([k,v]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;font-size:13px;">${k}</span>
          <span style="color:#111827;font-size:13px;font-weight:600;">${v}</span>
        </div>
      `).join('')}
    </div>

    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 24px;">
      Si necesitás cancelar o cambiar el turno, escribinos con anticipación.
      ${data.businessEmail ? `Podés contactarnos en <a href="mailto:${data.businessEmail}" style="color:${data.color};">${data.businessEmail}</a>` : ''}
    </p>

    <!-- CTA -->
    <div style="text-align:center;">
      <div style="display:inline-block;background:${data.color};color:#ffffff;padding:12px 28px;
                  border-radius:12px;font-size:14px;font-weight:700;">
        ¡Nos vemos pronto! 💈
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <strong>FyP Studio</strong></p>
  </div>
</div>
</body></html>`
}

function businessEmailHTML(data: {
  customerName: string; customerPhone?: string; customerEmail?: string
  date: string; time: string; endTime: string
  service?: string; staff?: string; branch?: string
  notes?: string; businessName: string; color: string; bookingId: string
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo turno</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#0B1929;padding:24px 32px;">
    <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:800;">🔔 Nuevo turno reservado</h1>
    <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">${data.businessName}</p>
  </div>
  <div style="padding:24px 32px;">
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px;">
      ${[
        ['👤 Cliente', data.customerName],
        data.customerPhone ? ['📱 Teléfono', data.customerPhone] : null,
        data.customerEmail ? ['📧 Email', data.customerEmail]    : null,
        ['📅 Fecha', formatDate(data.date)],
        ['🕐 Hora', `${data.time} — ${data.endTime} hs`],
        data.service ? ['✂️ Servicio', data.service] : null,
        data.staff   ? ['👤 Barbero', data.staff]    : null,
        data.branch  ? ['📍 Sucursal', data.branch]  : null,
        data.notes   ? ['💬 Notas', data.notes]       : null,
      ].filter((r): r is string[] => r !== null).map(([k,v]) => `
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;font-size:13px;">${k}</span>
          <span style="color:#111827;font-size:13px;font-weight:600;">${v}</span>
        </div>
      `).join('')}
    </div>
    <p style="color:#6b7280;font-size:12px;">ID del turno: <code>${data.bookingId.slice(0,8)}</code></p>
  </div>
</div>
</body></html>`
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) ?? 'unknown'
    const limited = await checkRateLimit(`bookings-confirm:${ip}`, 5, '1 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá en un momento.' }, { status: 429 })

    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 })

    const supabase = createServiceClient()

    // Cargar booking completo
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, staff:staff(name), branch:branches(name), product:products(name), business:businesses(name,primary_color,notification_email,whatsapp)')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

    const biz   = booking.business as Record<string,unknown>
    const color = (biz?.primary_color as string) ?? '#1565FF'
    const bizName = (biz?.name as string) ?? 'Barbería'
    const bizEmail = (biz?.notification_email as string) ?? ''

    const commonData = {
      date:     booking.date,
      time:     booking.start_time.slice(0,5),
      endTime:  booking.end_time.slice(0,5),
      service:  (booking.product as {name:string}|null)?.name,
      staff:    (booking.staff   as {name:string}|null)?.name,
      branch:   (booking.branch  as {name:string}|null)?.name,
      businessName: bizName,
      color,
    }

    const emails: Promise<boolean>[] = []

    // 1. Email al cliente
    if (booking.customer_email) {
      emails.push(sendEmail(
        booking.customer_email,
        `✂️ Turno confirmado en ${bizName}`,
        clientEmailHTML({
          ...commonData,
          customerName: booking.customer_name,
          businessEmail: bizEmail,
        })
      ))
    }

    // 2. Email a la barbería
    if (bizEmail) {
      emails.push(sendEmail(
        bizEmail,
        `🔔 Nuevo turno — ${booking.customer_name} · ${booking.date} ${booking.start_time.slice(0,5)}`,
        businessEmailHTML({
          ...commonData,
          customerName:  booking.customer_name,
          customerPhone: booking.customer_phone,
          customerEmail: booking.customer_email,
          notes:         booking.notes,
          bookingId:     booking.id,
        })
      ))
    }

    await Promise.all(emails)

    // Log emails
    const logEntries = []
    if (booking.customer_email) {
      logEntries.push({ business_id: booking.business_id, booking_id: bookingId, to_email: booking.customer_email, type: 'booking_confirm_client', status: 'sent' })
    }
    if (bizEmail) {
      logEntries.push({ business_id: booking.business_id, booking_id: bookingId, to_email: bizEmail, type: 'booking_confirm_business', status: 'sent' })
    }
    if (logEntries.length > 0) {
      await supabase.from('email_logs').insert(logEntries)
    }

    return NextResponse.json({ ok: true, emailsSent: logEntries.length })
  } catch (err) {
    console.error('[booking confirm email]', err)
    return NextResponse.json({ error: 'Error enviando emails' }, { status: 500 })
  }
}
