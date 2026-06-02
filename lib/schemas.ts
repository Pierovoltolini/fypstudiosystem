// lib/schemas.ts — Zod schemas para validación de API routes
import { z } from 'zod'

// ── Shared primitives ─────────────────────────────────────────
const uuid      = z.string().uuid()
const phone     = z.string().max(30).optional()
const shortText = (max = 200) => z.string().min(1).max(max).trim()

// ── Orders ────────────────────────────────────────────────────
export const createOrderSchema = z.object({
  businessId:             uuid,
  items:                  z.array(z.object({
    product: z.object({
      id:    uuid,
      name:  shortText(),
      price: z.number().nonnegative(),
    }),
    quantity: z.number().int().positive().max(999),
    note:     z.string().max(300).optional(),
  })).min(1, 'El pedido necesita al menos un ítem'),
  customerName:           shortText(100),
  customerPhone:          phone,
  customerAddress:        z.string().max(300).optional(),
  deliveryType:           z.enum(['delivery', 'pickup', 'dine_in']),
  comment:                z.string().max(500).optional(),
  pos:                    z.boolean().optional(),
  tableId:                uuid.optional().nullable(),
  discountCode:           z.string().max(50).optional().nullable(),
  discountAmount:         z.number().nonnegative().optional(),
  loyaltyPointsToRedeem:  z.number().nonnegative().int().optional(),
  loyaltyDiscount:        z.number().nonnegative().optional(),
  deliveryFee:            z.number().nonnegative().optional(),
  deliveryZone:           z.string().max(100).optional().nullable(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// ── AI ────────────────────────────────────────────────────────
export const aiProductSchema = z.object({
  rawText:      shortText(1000),
  businessType: z.string().max(100).optional(),
})

export const aiPromoSchema = z.object({
  context:      shortText(1000),
  businessType: z.string().max(100).optional(),
  promoType:    z.string().max(100).optional(),
})

export const aiInsightsSchema = z.object({
  period:       z.string().max(50).optional(),
})

// ── Bookings ──────────────────────────────────────────────────
export const confirmBookingSchema = z.object({
  businessId:     uuid,
  staffId:        uuid.optional().nullable(),
  productId:      uuid.optional().nullable(),
  branchId:       uuid.optional().nullable(),
  customerName:   shortText(100),
  customerPhone:  phone,
  customerEmail:  z.string().email().optional(),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM'),
  durationMin:    z.number().int().positive().max(480),
  notes:          z.string().max(500).optional(),
  price:          z.number().nonnegative().optional(),
})

// ── Discount codes ────────────────────────────────────────────
export const validateCouponSchema = z.object({
  businessId: uuid,
  code:       z.string().min(1).max(50).trim(),
  orderTotal: z.number().nonnegative(),
})

// ── Business settings ─────────────────────────────────────────
export const businessSettingsSchema = z.object({
  name:             shortText(100).optional(),
  description:      z.string().max(500).optional(),
  whatsapp:         phone,
  address:          z.string().max(300).optional(),
  delivery_enabled: z.boolean().optional(),
  pickup_enabled:   z.boolean().optional(),
  delivery_fee:     z.number().nonnegative().optional(),
  min_order:        z.number().nonnegative().optional(),
  estimated_time:   z.string().max(50).optional(),
  primary_color:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  currency:         z.enum(['UYU','ARS','CLP','COP','MXN','USD','BRL']).optional(),
  instagram:        z.string().max(100).optional(),
  facebook:         z.string().max(100).optional(),
  tiktok:           z.string().max(100).optional(),
  website:          z.string().url().optional().or(z.literal('')),
})
