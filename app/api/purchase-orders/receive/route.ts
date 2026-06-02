import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

interface ReceiveItem {
  item_id:            string
  inventory_item_id?: string | null
  item_name:          string
  unit:               string
  quantity_received:  number
  unit_cost?:         number | null
}

export async function POST(req: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('business_id').eq('user_id', user.id).single()
    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio asociado' }, { status: 403 })

    // ── Rate limit ──────────────────────────────────────────────
    const limited = await checkRateLimit(`po-receive:${user.id}`, 10, '1 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })

    // ── Validar body ────────────────────────────────────────────
    const { orderId, businessId, items } = await req.json() as {
      orderId: string; businessId: string; items: ReceiveItem[]
    }
    if (!orderId || !businessId || !items?.length)
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    // Verificar que el negocio del token coincide con el del body
    if (profile.business_id !== businessId)
      return NextResponse.json({ error: 'Sin acceso a este negocio' }, { status: 403 })

    const service = createServiceClient()

    // Update each item's quantity_received + cost
    for (const item of items) {
      if ((item.quantity_received ?? 0) <= 0) continue
      await service.from('purchase_order_items').update({
        quantity_received: item.quantity_received,
        unit_cost:         item.unit_cost ?? null,
      }).eq('id', item.item_id)

      // Update inventory stock if linked
      if (item.inventory_item_id) {
        const { data: inv } = await service
          .from('inventory_items')
          .select('stock_current')
          .eq('id', item.inventory_item_id)
          .single()

        const before = (inv?.stock_current ?? 0)
        const after  = before + item.quantity_received

        await service.from('inventory_items').update({
          stock_current: after,
          updated_at:    new Date().toISOString(),
        }).eq('id', item.inventory_item_id)

        await service.from('inventory_movements').insert({
          business_id:  businessId,
          item_id:      item.inventory_item_id,
          type:         'entrada',
          quantity:     item.quantity_received,
          stock_before: before,
          stock_after:  after,
          reason:       `Recepción OC #${orderId.slice(-6).toUpperCase()}`,
        })
      }
    }

    // Mark order as received
    await service.from('purchase_orders').update({
      status:      'received',
      received_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq('id', orderId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[purchase-orders/receive]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
