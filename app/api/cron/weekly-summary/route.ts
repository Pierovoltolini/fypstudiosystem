// app/api/cron/weekly-summary/route.ts
// Envía el resumen semanal a todos los dueños de negocio.
// Protegido con CRON_SECRET. Configurado en vercel.json para ejecutarse
// todos los lunes a las 9am (UTC).
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const FROM = process.env.EMAIL_FROM ?? 'FYP Studio <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fyp.studio'

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function pct(curr: number, prev: number): { value: number; up: boolean } {
  if (prev === 0) return { value: curr > 0 ? 100 : 0, up: curr >= 0 }
  const v = Math.round(((curr - prev) / prev) * 100)
  return { value: Math.abs(v), up: v >= 0 }
}

function weekRanges(now: Date) {
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currFrom  = new Date(today.getTime() - 7  * 86_400_000)
  const prevFrom  = new Date(today.getTime() - 14 * 86_400_000)
  const prevTo    = new Date(today.getTime() -  7 * 86_400_000 - 1)
  return {
    currFrom: currFrom.toISOString(),
    currTo:   now.toISOString(),
    prevFrom: prevFrom.toISOString(),
    prevTo:   prevTo.toISOString(),
  }
}

// ── Email HTML ──────────────────────────────────────────────────
function buildEmailHtml(data: {
  businessName: string
  currRevenue:  number
  prevRevenue:  number
  currOrders:   number
  prevOrders:   number
  currency:     string
  topProducts:  { name: string; qty: number }[]
  lowStock:     { name: string; stock_current: number; stock_min: number }[]
  periodLabel:  string
}): string {
  const { businessName, currRevenue, prevRevenue, currOrders, prevOrders,
          currency, topProducts, lowStock, periodLabel } = data

  const revDelta  = pct(currRevenue, prevRevenue)
  const ordDelta  = pct(currOrders, prevOrders)
  const arrowUp   = '↑'
  const arrowDown = '↓'

  const deltaHtml = (d: ReturnType<typeof pct>) =>
    `<span style="color:${d.up ? '#10B981' : '#EF4444'};font-weight:700;">
      ${d.up ? arrowUp : arrowDown} ${d.value}%
    </span>`

  const topProdsHtml = topProducts.length > 0
    ? topProducts.slice(0, 3).map((p, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                    border-bottom:1px solid #F3F4F6;">
          <div style="width:24px;height:24px;border-radius:8px;background:#EEF2FF;
                      display:flex;align-items:center;justify-content:center;
                      font-size:11px;font-weight:800;color:#6366F1;">${i + 1}</div>
          <div style="flex:1;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${p.name}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6B7280;">${p.qty} unidades vendidas</p>
          </div>
        </div>`).join('')
    : '<p style="font-size:13px;color:#6B7280;margin:0;">Sin datos de productos esta semana.</p>'

  const lowStockHtml = lowStock.length > 0
    ? `<div style="background:#FEF3C7;border-radius:12px;padding:16px 20px;margin-top:8px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#92400E;">
          ⚠️ ${lowStock.length} ${lowStock.length === 1 ? 'ítem con' : 'ítems con'} stock bajo
        </p>
        ${lowStock.slice(0, 4).map(i =>
          `<p style="margin:4px 0;font-size:12px;color:#78350F;">
            · ${i.name}: ${i.stock_current} (mín ${i.stock_min})
          </p>`
        ).join('')}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Resumen semanal — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:20px;
              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1565FF 0%,#6366F1 100%);
                padding:36px 40px 28px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);
                    border-radius:9px;display:inline-flex;align-items:center;
                    justify-content:center;font-size:16px;">⚡</div>
        <span style="color:#fff;font-size:16px;font-weight:800;letter-spacing:-0.3px;">FYP Studio</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;line-height:1.2;">
        Resumen semanal
      </h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">
        ${businessName} · ${periodLabel}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;">
        <div style="background:#F7F9FC;border-radius:14px;padding:18px;">
          <p style="margin:0 0 6px;font-size:11px;color:#6B7280;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.05em;">Ingresos</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">
            ${currency} ${fmt(currRevenue)}
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">
            vs ${currency} ${fmt(prevRevenue)} la semana anterior
            ${deltaHtml(revDelta)}
          </p>
        </div>
        <div style="background:#F7F9FC;border-radius:14px;padding:18px;">
          <p style="margin:0 0 6px;font-size:11px;color:#6B7280;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.05em;">Pedidos</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">${currOrders}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">
            vs ${prevOrders} la semana anterior
            ${deltaHtml(ordDelta)}
          </p>
        </div>
      </div>

      <!-- Top productos -->
      <div style="margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">
          🏆 Top productos de la semana
        </p>
        ${topProdsHtml}
      </div>

      <!-- Stock bajo -->
      ${lowStockHtml}

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${APP_URL}/admin"
          style="display:inline-block;background:linear-gradient(135deg,#1565FF,#6366F1);
                 color:#fff;text-decoration:none;font-size:14px;font-weight:700;
                 padding:13px 32px;border-radius:12px;">
          Ver panel completo →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:16px 40px;border-top:1px solid #E5E7EB;
                text-align:center;">
      <p style="color:#9CA3AF;font-size:11px;margin:0;">
        Powered by <strong style="color:#6366F1;">FYP Studio</strong> ·
        <a href="${APP_URL}/admin/settings" style="color:#9CA3AF;">Configurar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ── Handler principal ───────────────────────────────────────────
export async function GET(req: Request) {
  // Verificar CRON_SECRET
  const auth   = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const now     = new Date()
  const { currFrom, currTo, prevFrom, prevTo } = weekRanges(now)

  const mondayDate = new Date(now.getTime() - 7 * 86_400_000)
  const periodLabel = `${mondayDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`

  // Obtener todos los negocios con sus perfiles
  const { data: profiles } = await service
    .from('profiles')
    .select('user_id, business_id, business:businesses(name, currency)')
    .not('business_id', 'is', null)

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Deduplicar por business_id (primer perfil = dueño)
  const seen  = new Set<string>()
  const items = profiles.filter(p => {
    if (!p.business_id || seen.has(p.business_id)) return false
    seen.add(p.business_id)
    return true
  })

  const apiKey = process.env.RESEND_API_KEY
  let sent = 0

  for (const item of items) {
    try {
      const biz = item.business as unknown as { name: string; currency: string } | null
      if (!biz) continue

      // Obtener email del usuario desde auth
      const { data: { user: authUser } } = await service.auth.admin.getUserById(item.user_id)
      const email = authUser?.email
      if (!email) continue

      // Stats de la semana actual
      const [currOrdersRes, prevOrdersRes, topItemsRes, inventoryRes] = await Promise.all([
        service.from('orders')
          .select('total, confirmed_sale')
          .eq('business_id', item.business_id)
          .gte('created_at', currFrom)
          .lte('created_at', currTo)
          .eq('confirmed_sale', true),
        service.from('orders')
          .select('total, confirmed_sale')
          .eq('business_id', item.business_id)
          .gte('created_at', prevFrom)
          .lte('created_at', prevTo)
          .eq('confirmed_sale', true),
        service.from('order_items')
          .select('product_name, quantity')
          .eq('business_id', item.business_id)
          .gte('created_at', currFrom)
          .limit(200),
        service.from('inventory_items')
          .select('name, stock_current, stock_min')
          .eq('business_id', item.business_id)
          .eq('active', true)
          .limit(50),
      ])

      const currOrders  = currOrdersRes.data ?? []
      const prevOrders  = prevOrdersRes.data ?? []
      const currRevenue = currOrders.reduce((s, o) => s + o.total, 0)
      const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0)

      // Top productos
      const prodMap: Record<string, number> = {}
      ;(topItemsRes.data ?? []).forEach(i => {
        prodMap[i.product_name] = (prodMap[i.product_name] ?? 0) + i.quantity
      })
      const topProducts = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, qty]) => ({ name, qty }))

      // Stock bajo
      const lowStock = (inventoryRes.data ?? [])
        .filter(i => i.stock_current <= i.stock_min)
        .slice(0, 4)

      const html = buildEmailHtml({
        businessName: biz.name,
        currRevenue,
        prevRevenue,
        currOrders:   currOrders.length,
        prevOrders:   prevOrders.length,
        currency:     biz.currency ?? 'UYU',
        topProducts,
        lowStock,
        periodLabel,
      })

      // Enviar vía Resend
      if (apiKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    FROM,
            to:      [email],
            subject: `📊 Resumen semanal de ${biz.name}`,
            html,
          }),
        })
        if (res.ok) sent++
      } else {
        // Sin API key: loguear para debug
        console.log(`[weekly-summary] Simularía envío a ${email} para "${biz.name}"`)
        sent++
      }
    } catch (err) {
      console.error('[weekly-summary] Error procesando negocio', item.business_id, err)
    }
  }

  return NextResponse.json({ ok: true, sent, total: items.length })
}
