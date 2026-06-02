// app/api/welcome-email/route.ts
// Envía el email de bienvenida cuando un usuario completa el onboarding.
// Llamado fire-and-forget desde el cliente tras crear el negocio.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  businessName: z.string().min(1).max(100),
})

async function sendWelcomeEmail(to: string, businessName: string): Promise<boolean> {
  const apiKey  = process.env.RESEND_API_KEY
  const from    = process.env.EMAIL_FROM ?? 'FYP Studio <noreply@fyp.studio>'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fyp.studio'

  if (!apiKey) {
    console.log('[welcome-email] No RESEND_API_KEY — simulando envío a', to)
    return true
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a FYP Studio</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:20px;
              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

    <!-- Header con gradiente -->
    <div style="background:linear-gradient(135deg,#1565FF 0%,#6366F1 100%);padding:40px 40px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;
                    display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:18px;">⚡</span>
        </div>
        <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.3px;">FYP Studio</span>
      </div>
      <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;line-height:1.2;">
        ¡Bienvenido, ${businessName}! 🎉
      </h1>
      <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;font-weight:400;">
        Tu panel ya está listo. Empezá a gestionar tu negocio.
      </p>
    </div>

    <!-- Cuerpo -->
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Hola 👋 Tu negocio <strong>${businessName}</strong> fue creado con éxito en FYP Studio.
        Ya podés empezar a usar todas las herramientas que preparamos para vos:
      </p>

      <!-- Features -->
      <div style="background:#F7F9FC;border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        ${[
          ['📦', 'Gestioná tus productos y catálogo', 'Creá tu tienda pública en minutos'],
          ['🛒', 'Recibí pedidos en tiempo real', 'Con notificaciones y seguimiento de estado'],
          ['👥', 'CRM de clientes integrado', 'Historial, segmentación y programa de fidelización'],
          ['🤖', 'Asistente IA de tu negocio', 'Consultá ventas, costos y stock con lenguaje natural'],
        ].map(([icon, title, sub]) => `
          <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
            <div style="width:36px;height:36px;background:#EEF2FF;border-radius:10px;
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;
                        font-size:16px;line-height:1;">${icon}</div>
            <div>
              <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">${title}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#6B7280;">${sub}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${appUrl}/admin"
          style="display:inline-block;background:linear-gradient(135deg,#1565FF,#6366F1);
                 color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;
                 padding:14px 36px;border-radius:14px;letter-spacing:0.2px;">
          Ir al panel →
        </a>
      </div>

      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
        Si tenés alguna duda, respondé este email y te ayudamos.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:18px 40px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="color:#9CA3AF;font-size:11px;margin:0;">
        Powered by <strong style="color:#6366F1;">FYP Studio</strong> · Herramientas para tu negocio
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to:      [to],
        subject: `Bienvenido a FYP Studio 🎉`,
        html,
      }),
    })
    return res.ok
  } catch (e) {
    console.error('[welcome-email]', e)
    return false
  }
}

export async function POST(req: Request) {
  try {
    // Verificar auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.email)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    await sendWelcomeEmail(user.email, parsed.data.businessName)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/welcome-email]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
