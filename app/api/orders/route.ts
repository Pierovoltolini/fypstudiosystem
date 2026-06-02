import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createOrderSchema } from '@/lib/schemas'
import { checkRateLimit } from '@/lib/ratelimit'
import { PLAN_LIMITS, isAtLimit } from '@/lib/plan-limits'
import { ZodError } from 'zod'
import type { Plan } from '@/types'

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const limited = await checkRateLimit(`orders:${ip}`, 20, '1 m')
    if (limited) return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá en un momento.' }, { status: 429 })

    const body = await req.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Datos inválidos'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const {
      businessId, items, customerName, customerPhone, customerAddress,
      deliveryType, comment, pos, tableId,
      discountCode, discountAmount,
      loyaltyPointsToRedeem, loyaltyDiscount,
      deliveryFee, deliveryZone,
    } = parsed.data

    const supabase = createServiceClient()

    const { data: business } = await supabase
      .from('businesses').select('id,active,plan').eq('id', businessId).single()
    if (!business?.active)
      return NextResponse.json({ error: 'Comercio no disponible' }, { status: 403 })

    // ── Límite de pedidos por mes según plan ────────────────────
    const plan = (business.plan ?? 'basic') as Plan
    const limit = PLAN_LIMITS[plan].orders_per_month
    if (limit !== Infinity) {
      const monthStart = new Date()
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', monthStart.toISOString())
      if (isAtLimit(plan, 'orders_per_month', count ?? 0)) {
        return NextResponse.json({
          error: `Tu plan ${plan === 'basic' ? 'gratuito' : plan} llegó al límite de ${limit} pedidos este mes. Actualizá tu plan para seguir recibiendo pedidos.`,
          limitReached: true,
          upgradePrompt: true,
        }, { status: 403 })
      }
    }

    const subtotal      = items.reduce((acc, { product, quantity }) => acc + product.price * quantity, 0)
    const applied       = discountAmount && discountAmount > 0 ? discountAmount : 0
    const loyDiscount   = loyaltyDiscount && loyaltyDiscount > 0 ? loyaltyDiscount : 0
    const appliedFee    = deliveryFee && deliveryFee > 0 ? deliveryFee : 0
    const orderTotal    = Math.max(0, subtotal + appliedFee - applied - loyDiscount)

    let customerId: string | null = null
    if (customerPhone) {
      const { data: customer } = await supabase.from('customers')
        .upsert({ business_id: businessId, name: customerName, phone: customerPhone, address: customerAddress },
          { onConflict: 'business_id,phone' })
        .select('id').single()
      customerId = customer?.id ?? null
    }

    const { data: order, error } = await supabase.from('orders').insert({
      business_id: businessId, customer_id: customerId,
      status:          pos ? 'delivered' : 'pending',
      payment_status:  pos ? 'paid'      : 'unpaid',
      confirmed_sale:  pos ? true        : false,
      delivery_type: deliveryType, subtotal, total: orderTotal,
      delivery_fee:  appliedFee,
      delivery_zone: deliveryZone || null,
      discount_code:            discountCode || null,
      discount_amount:          applied,
      loyalty_points_redeemed:  loyaltyPointsToRedeem || 0,
      loyalty_discount:         loyDiscount,
      comment: comment || null, customer_name: customerName,
      customer_phone: customerPhone || null, customer_address: customerAddress || null,
      table_id: tableId || null,
    }).select('id, order_number').single()

    if (error) throw error

    // ── Fetch product details for cost tracking & inventory decrement ──
    const productIds = items.map(i => i.product.id)

    const { data: productDetails } = await supabase
      .from('products')
      .select('id, product_type, inventory_item_id, cost_price')
      .in('id', productIds)

    const productMap = new Map(
      (productDetails ?? []).map(p => [p.id, p])
    )

    // ── Insert order_items with cost_price snapshot ────────────────
    // Note: subtotal is a GENERATED ALWAYS column — do not include it
    await supabase.from('order_items').insert(
      items.map(({ product, quantity, note }) => {
        const detail = productMap.get(product.id)
        return {
          order_id: order.id, product_id: product.id,
          product_name: product.name, unit_price: product.price, quantity,
          cost_price: detail?.cost_price ?? null,
          note: note?.trim() || null,
        }
      })
    )

    // ── Build inventory decrement map ──────────────────────────────
    // item_id → total quantity to deduct (accumulated across all cart items)
    const decrementMap = new Map<string, number>()

    const compositeProductIds = (productDetails ?? [])
      .filter(p => p.product_type === 'composite')
      .map(p => p.id)

    // Fetch ingredients for all composite products in one query
    const ingredientsByProduct = new Map<string, { inventory_item_id: string; quantity: number }[]>()
    if (compositeProductIds.length > 0) {
      const { data: allIngredients } = await supabase
        .from('product_ingredients')
        .select('product_id, inventory_item_id, quantity')
        .in('product_id', compositeProductIds)

      for (const ing of allIngredients ?? []) {
        const list = ingredientsByProduct.get(ing.product_id) ?? []
        list.push({ inventory_item_id: ing.inventory_item_id, quantity: ing.quantity })
        ingredientsByProduct.set(ing.product_id, list)
      }
    }

    for (const { product, quantity } of items) {
      const detail = productMap.get(product.id)
      if (!detail || detail.product_type === 'service') continue

      if (detail.product_type === 'simple' && detail.inventory_item_id) {
        const prev = decrementMap.get(detail.inventory_item_id) ?? 0
        decrementMap.set(detail.inventory_item_id, prev + quantity)
      } else if (detail.product_type === 'composite') {
        const ingredients = ingredientsByProduct.get(product.id) ?? []
        for (const ing of ingredients) {
          const prev = decrementMap.get(ing.inventory_item_id) ?? 0
          decrementMap.set(ing.inventory_item_id, prev + ing.quantity * quantity)
        }
      }
    }

    // ── Insert inventory movements (trigger handles stock_before/after) ──
    if (decrementMap.size > 0) {
      const movements = Array.from(decrementMap.entries()).map(([item_id, qty]) => ({
        business_id: businessId,
        item_id,
        order_id: order.id,
        type: 'salida' as const,
        quantity: -qty,          // negative = salida
        stock_before: 0,         // overwritten by DB trigger
        stock_after: 0,          // overwritten by DB trigger
        reason: `Pedido #${order.order_number}`,
      }))

      await supabase.from('inventory_movements').insert(movements)
    }

    // Increment coupon uses_count atomically
    if (discountCode && applied > 0) {
      await supabase.rpc('increment_coupon_uses', {
        p_business_id: businessId,
        p_code: discountCode,
      })
    }

    // ── Loyalty points ─────────────────────────────────────────────
    if (customerId) {
      const { data: loySettings } = await supabase
        .from('loyalty_settings')
        .select('enabled, points_per_unit, welcome_points')
        .eq('business_id', businessId)
        .single()

      if (loySettings?.enabled) {
        const earnedPoints = Math.floor(orderTotal * loySettings.points_per_unit)
        const loyInserts: object[] = []

        if (earnedPoints > 0) {
          loyInserts.push({
            business_id: businessId,
            customer_id: customerId,
            order_id:    order.id,
            points:      earnedPoints,
            reason:      'earned',
            note:        `Pedido #${order.order_number}`,
          })
        }

        if ((loyaltyPointsToRedeem ?? 0) > 0) {
          loyInserts.push({
            business_id: businessId,
            customer_id: customerId,
            order_id:    order.id,
            points:      -(loyaltyPointsToRedeem!),
            reason:      'redeemed',
            note:        `Pedido #${order.order_number}`,
          })
        }

        if (loyInserts.length > 0) {
          await supabase.from('loyalty_points').insert(loyInserts)
          await supabase.from('orders')
            .update({ loyalty_points_earned: earnedPoints })
            .eq('id', order.id)
        }

        // Welcome bonus on first order
        if (loySettings.welcome_points > 0) {
          const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('customer_id', customerId)
          if (count === 1) {
            await supabase.from('loyalty_points').insert({
              business_id: businessId,
              customer_id: customerId,
              order_id:    order.id,
              points:      loySettings.welcome_points,
              reason:      'welcome',
              note:        'Puntos de bienvenida',
            })
          }
        }
      }
    }

    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    console.error('[api/orders]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
