// components/store/CheckoutClient.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { formatPrice, productImageUrl } from '@/lib/utils'
import { buildWhatsAppMessage, getWhatsAppUrl } from '@/lib/whatsapp'
import {
  ArrowLeft, Loader2, MessageCircle, MapPin, ShoppingBag,
  User, Phone, FileText, AlertCircle, Clock, UtensilsCrossed,
  Tag, Check, X, Gift, Star,
} from 'lucide-react'
import type { Business, CheckoutFormData, DeliveryZone } from '@/types'

export default function CheckoutClient({
  business,
  table,
}: {
  business: Business
  table?: { id: string; name: string } | null
}) {
  const router = useRouter()
  const { items, total, clearCart, isEmpty, updateNote } = useCart()
  const currency = business.currency ?? 'UYU'

  const isDineIn        = !!table
  const deliveryEnabled = !isDineIn && (business.delivery_enabled !== false)
  const pickupEnabled   = !isDineIn && (business.pickup_enabled   !== false)
  const flatDeliveryFee = business.delivery_fee ?? 0
  const zones           = (business.delivery_zones ?? []) as DeliveryZone[]
  const hasZones        = zones.length > 0
  const minOrder        = business.min_order ?? 0
  const estimatedTime   = business.estimated_time ?? null

  const defaultDelivery: 'delivery' | 'pickup' = isDineIn
    ? 'pickup'
    : deliveryEnabled ? 'delivery' : 'pickup'

  const [form, setForm] = useState<CheckoutFormData>({
    name: '', phone: '', address: '',
    delivery_type: defaultDelivery,
    comment: '',
  })
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(
    hasZones ? zones[0] : null
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cupón
  const [couponInput,    setCouponInput]    = useState('')
  const [couponLoading,  setCouponLoading]  = useState(false)
  const [appliedCoupon,  setAppliedCoupon]  = useState<{
    code: string; type: 'percent' | 'fixed'; value: number; discount: number
  } | null>(null)
  const [couponError,    setCouponError]    = useState<string | null>(null)

  // Loyalty
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    customer_id: string; customer_name: string
    points: number; redeem_value: number; min_redeem: number; redeem_ratio: number
  } | null>(null)
  const [loyaltyLoading,  setLoyaltyLoading]  = useState(false)
  const [loyaltyApplied,  setLoyaltyApplied]  = useState(false)

  useEffect(() => {
    if (isEmpty()) router.replace(`/store/${business.slug}`)
  }, [])

  function set<K extends keyof CheckoutFormData>(key: K, val: CheckoutFormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
    setError(null)
  }

  const businessWA  = (business.whatsapp ?? '').replace(/[^\d]/g, '')
  const hasWhatsapp = businessWA.length >= 8
  const subtotal    = total()
  const deliveryFee = hasZones && form.delivery_type === 'delivery'
    ? (selectedZone?.fee ?? flatDeliveryFee)
    : flatDeliveryFee
  const appliedFee  = form.delivery_type === 'delivery' ? deliveryFee : 0
  const discountAmt   = appliedCoupon?.discount ?? 0
  const loyaltyAmt    = loyaltyApplied && loyaltyInfo ? loyaltyInfo.redeem_value : 0
  const cartTotal     = Math.max(0, subtotal + appliedFee - discountAmt - loyaltyAmt)
  const belowMin    = minOrder > 0 && subtotal < minOrder
  const missingAmt  = minOrder - subtotal

  async function checkLoyalty(phone: string) {
    if (!phone.trim() || phone.trim().length < 6) { setLoyaltyInfo(null); return }
    setLoyaltyLoading(true)
    try {
      const res  = await fetch('/api/loyalty-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, phone: phone.trim() }),
      })
      const data = await res.json()
      if (data.enabled && data.points > 0) {
        setLoyaltyInfo(data)
      } else {
        setLoyaltyInfo(null); setLoyaltyApplied(false)
      }
    } finally {
      setLoyaltyLoading(false)
    }
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return
    setCouponLoading(true); setCouponError(null); setAppliedCoupon(null)
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id, code: couponInput.trim(), subtotal }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs: Record<string, string> = {
          not_found: 'Código no válido',
          expired:   'Este cupón ya expiró',
          exhausted: 'Este cupón ya se agotó',
          min_order: `Pedido mínimo para este cupón: ${formatPrice(data.min_order, currency)}`,
        }
        setCouponError(msgs[data.error] ?? 'Código no válido')
      } else {
        setAppliedCoupon(data)
        setCouponInput('')
      }
    } finally {
      setCouponLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasWhatsapp && !isDineIn) { setError('Este comercio no tiene WhatsApp configurado todavía.'); return }
    if (!form.name.trim())  { setError('Ingresá tu nombre'); return }
    if (!form.phone.trim()) { setError('Ingresá tu teléfono'); return }
    if (!isDineIn && form.delivery_type === 'delivery' && !form.address?.trim()) {
      setError('Ingresá la dirección de entrega'); return
    }
    if (belowMin) {
      setError(`El pedido mínimo es ${formatPrice(minOrder, currency)}. Te faltan ${formatPrice(missingAmt, currency)}.`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const tableComment = isDineIn ? `Mesa: ${table!.name}` : null
      const fullComment  = [tableComment, form.comment?.trim() || null].filter(Boolean).join(' · ')

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId:      business.id,
          items,
          customerName:    form.name.trim(),
          customerPhone:   form.phone.trim(),
          customerAddress: form.delivery_type === 'delivery' ? form.address?.trim() : null,
          deliveryType:    isDineIn ? 'dine_in' : form.delivery_type,
          deliveryFee:     appliedFee,
          deliveryZone:    form.delivery_type === 'delivery' && selectedZone ? selectedZone.name : null,
          tableId:         isDineIn ? table!.id : null,
          comment:         fullComment || null,
          discountCode:           appliedCoupon?.code ?? null,
          discountAmount:         discountAmt,
          loyaltyPointsToRedeem:  loyaltyApplied && loyaltyInfo ? Math.floor(loyaltyInfo.redeem_value * loyaltyInfo.redeem_ratio) : 0,
          loyaltyDiscount:        loyaltyAmt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el pedido')

      clearCart()
      if (hasWhatsapp) {
        const waForm: CheckoutFormData = {
          ...form,
          comment: isDineIn ? `En ${table!.name}` + (form.comment ? ` · ${form.comment}` : '') : form.comment,
        }
        const message = buildWhatsAppMessage(items, waForm, currency)
        const waUrl   = getWhatsAppUrl(businessWA, message)
        window.open(waUrl, '_blank')
      }
      router.push(`/store/${business.slug}/pedido/${data.orderId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl
                       text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name}
                className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                style={{ background: business.primary_color, color: business.secondary_color }}
              >
                {business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm text-gray-900">{business.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-40 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Confirmar pedido</h1>

        {/* WhatsApp no configurado */}
        {!hasWhatsapp && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Comercio sin WhatsApp</p>
              <p className="text-xs text-amber-600 mt-0.5">El dueño todavía no configuró el número.</p>
            </div>
          </div>
        )}

        {/* Mínimo de pedido */}
        {belowMin && (
          <div className="rounded-2xl bg-orange-50 border border-orange-200 px-5 py-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Pedido mínimo</p>
              <p className="text-xs text-orange-600 mt-0.5">
                El mínimo es {formatPrice(minOrder, currency)}.
                Agregá {formatPrice(missingAmt, currency)} más para continuar.
              </p>
            </div>
          </div>
        )}

        {/* Resumen del carrito */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ShoppingBag size={14} className="text-gray-400" />
              Tu pedido ({items.reduce((a, i) => a + i.quantity, 0)} {items.reduce((a,i)=>a+i.quantity,0)===1?'item':'items'})
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map(({ product, quantity, note }) => (
              <div key={product.id} className="px-5 py-3.5 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <img
                      src={productImageUrl(product.images)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400">×{quantity} · {formatPrice(product.price, currency)} c/u</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {formatPrice(product.price * quantity, currency)}
                  </p>
                </div>
                <input
                  type="text"
                  value={note ?? ''}
                  onChange={e => updateNote(product.id, e.target.value)}
                  placeholder="Instrucciones (sin cebolla, extra salsa…)"
                  maxLength={120}
                  className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50 px-3 py-2
                             text-gray-700 placeholder:text-gray-300 outline-none
                             focus:border-gray-400 focus:bg-white transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            {form.delivery_type === 'delivery' && (
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  Delivery
                  {selectedZone && hasZones && (
                    <span className="ml-1 text-xs text-gray-400">({selectedZone.name})</span>
                  )}
                </span>
                <span className={appliedFee === 0 ? 'text-green-600 font-medium' : ''}>
                  {appliedFee === 0 ? 'Gratis' : formatPrice(appliedFee, currency)}
                </span>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex items-center justify-between text-sm text-green-600 font-medium">
                <span className="flex items-center gap-1">
                  <Tag size={12} /> {appliedCoupon.code}
                  <button onClick={() => setAppliedCoupon(null)}
                    className="ml-0.5 text-green-400 hover:text-red-400 transition-colors">
                    <X size={11} />
                  </button>
                </span>
                <span>−{formatPrice(discountAmt, currency)}</span>
              </div>
            )}
            {loyaltyApplied && loyaltyInfo && (
              <div className="flex items-center justify-between text-sm text-amber-600 font-medium">
                <span className="flex items-center gap-1">
                  <Star size={12} className="fill-amber-400" /> {loyaltyInfo.points} puntos
                </span>
                <span>−{formatPrice(loyaltyAmt, currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="font-semibold text-gray-800">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatPrice(cartTotal, currency)}</span>
            </div>
          </div>
        </div>

        {/* Puntos de fidelización */}
        {(loyaltyLoading || loyaltyInfo) && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Gift size={14} className="text-gray-400" />
                Puntos de fidelización
              </p>
            </div>
            <div className="p-4">
              {loyaltyLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Verificando puntos...
                </div>
              ) : loyaltyInfo && loyaltyInfo.redeem_value > 0 ? (
                loyaltyApplied ? (
                  <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <Star size={16} className="fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">
                        {loyaltyInfo.points} puntos aplicados
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        −{formatPrice(loyaltyInfo.redeem_value, currency)} de descuento
                      </p>
                    </div>
                    <button onClick={() => setLoyaltyApplied(false)}
                      className="text-amber-400 hover:text-red-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <Star size={16} className="fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        Tenés {loyaltyInfo.points} puntos
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        = {formatPrice(loyaltyInfo.redeem_value, currency)} de descuento disponible
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoyaltyApplied(true)}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-white bg-amber-500
                                 hover:bg-amber-600 transition-colors shrink-0"
                    >
                      Usar
                    </button>
                  </div>
                )
              ) : loyaltyInfo && loyaltyInfo.points > 0 ? (
                <p className="text-xs text-gray-400">
                  Tenés {loyaltyInfo.points} pts — necesitás {loyaltyInfo.min_redeem} pts para canjear.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* Cupón de descuento */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Tag size={14} className="text-gray-400" />
              Cupón de descuento <span className="text-gray-400 font-normal text-xs">(opcional)</span>
            </p>
          </div>
          <div className="p-4">
            {appliedCoupon ? (
              <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <Check size={16} className="text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-800">{appliedCoupon.code}</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {appliedCoupon.type === 'percent'
                      ? `${appliedCoupon.value}% de descuento aplicado`
                      : `${formatPrice(appliedCoupon.value, currency)} de descuento aplicado`}
                  </p>
                </div>
                <button onClick={() => setAppliedCoupon(null)}
                  className="text-green-400 hover:text-red-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                  placeholder="CÓDIGO"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm
                             font-mono uppercase tracking-widest outline-none focus:ring-2
                             focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': business.primary_color } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white
                             disabled:opacity-50 transition-all"
                  style={{ background: business.primary_color }}
                >
                  {couponLoading ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                </button>
              </div>
            )}
            {couponError && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={11} /> {couponError}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos personales */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={14} className="text-gray-400" /> Tus datos
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="field-label">Nombre completo <span className="text-red-400">*</span></label>
                <input type="text" required value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Tu nombre" className="input-base" autoComplete="name" />
              </div>
              <div>
                <label className="field-label">Teléfono / WhatsApp <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" required value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    onBlur={e => checkLoyalty(e.target.value)}
                    placeholder="099 123 456" className="input-base pl-9" autoComplete="tel" />
                </div>
              </div>
            </div>
          </div>

          {/* Entrega */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin size={14} className="text-gray-400" /> Entrega
              </p>
            </div>
            <div className="p-5 space-y-4">
              {/* Table / dine-in mode */}
              {isDineIn ? (
                <div className="flex items-center gap-3 rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
                  <UtensilsCrossed size={18} className="text-gray-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{table!.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Tu pedido llegará a la mesa</p>
                  </div>
                </div>
              ) : (deliveryEnabled || pickupEnabled) ? (
                <>
                  {/* Solo mostrar grid si ambas opciones están disponibles */}
                  {deliveryEnabled && pickupEnabled ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val: 'delivery', label: '🛵 Delivery',
                          sub: hasZones ? 'Elegir zona' : (flatDeliveryFee > 0 ? `+${formatPrice(flatDeliveryFee, currency)}` : 'Gratis') },
                        { val: 'pickup', label: '🏃 Retiro', sub: 'Paso a buscar' },
                      ].map(({ val, label, sub }) => (
                        <button key={val} type="button"
                          onClick={() => set('delivery_type', val as 'delivery' | 'pickup')}
                          className={`rounded-xl border-2 p-3 text-left transition-all ${
                            form.delivery_type === val
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}>
                          <p className="text-sm font-medium text-gray-900">{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-base">{deliveryEnabled ? '🛵' : '🏃'}</span>
                      <span className="font-medium">{deliveryEnabled ? 'Delivery' : 'Solo retiro en local'}</span>
                      {deliveryEnabled && !hasZones && flatDeliveryFee > 0 && (
                        <span className="text-gray-400">· {formatPrice(flatDeliveryFee, currency)}</span>
                      )}
                      {deliveryEnabled && !hasZones && flatDeliveryFee === 0 && (
                        <span className="text-green-600 font-medium">· Gratis</span>
                      )}
                    </div>
                  )}

                  {form.delivery_type === 'delivery' && (
                    <>
                      {hasZones && (
                        <div>
                          <label className="field-label">Zona de entrega</label>
                          <div className="grid grid-cols-2 gap-2">
                            {zones.map(z => (
                              <button key={z.id} type="button"
                                onClick={() => setSelectedZone(z)}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${
                                  selectedZone?.id === z.id
                                    ? 'border-gray-900 bg-gray-50'
                                    : 'border-gray-100 hover:border-gray-200'
                                }`}>
                                <p className="text-sm font-medium text-gray-900 truncate">{z.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {z.fee === 0 ? 'Gratis' : formatPrice(z.fee, currency)}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="field-label">
                          Dirección de entrega <span className="text-red-400">*</span>
                        </label>
                        <input type="text" value={form.address}
                          onChange={e => set('address', e.target.value)}
                          placeholder="Calle, número, apartamento..."
                          className="input-base" autoComplete="street-address" />
                        {business.address && (
                          <p className="text-xs text-gray-400 mt-1.5">📍 Local: {business.address}</p>
                        )}
                      </div>
                    </>
                  )}

                  {form.delivery_type === 'pickup' && business.address && (
                    <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Dirección del local</p>
                      <p className="text-sm text-blue-900">{business.address}</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* Comentario */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText size={14} className="text-gray-400" />
                Comentario <span className="text-gray-400 font-normal text-xs">(opcional)</span>
              </p>
            </div>
            <div className="p-5">
              <textarea value={form.comment}
                onChange={e => set('comment', e.target.value)}
                placeholder="Sin cebolla, sin TACC, aclaraciones..."
                rows={3} className="input-base resize-none" />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Footer fijo */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm
                          border-t border-gray-100 p-4 z-10">
            <div className="max-w-lg mx-auto space-y-2">
              {/* Tiempo estimado */}
              {estimatedTime && form.delivery_type === 'delivery' && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Clock size={12} />
                  Tiempo estimado: {estimatedTime}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || (!hasWhatsapp && !isDineIn) || belowMin}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-4
                           text-base font-semibold transition-all active:scale-[0.98]
                           disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{ background: business.primary_color, color: business.secondary_color }}
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Preparando pedido...</>
                ) : (
                  <><MessageCircle size={18} /> Enviar pedido · {formatPrice(cartTotal, currency)}</>
                )}
              </button>
              {hasWhatsapp && !belowMin && (
                <p className="text-center text-xs text-gray-400">
                  Se abrirá WhatsApp con tu pedido ya armado · Solo tocás Enviar
                </p>
              )}
              {belowMin && (
                <p className="text-center text-xs text-orange-500">
                  Mínimo {formatPrice(minOrder, currency)} — agregá {formatPrice(missingAmt, currency)} más
                </p>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
