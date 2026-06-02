// components/food/FoodStore.tsx
// Tienda pública gastronomía — mobile-first, tipo UberEats/PedidosYa
'use client'
import { useState, useMemo, useRef } from 'react'
import { useCart } from '@/hooks/useCart'
import { formatPrice, productImageUrl } from '@/lib/utils'
import { buildWhatsAppMessage, getWhatsAppUrl } from '@/lib/whatsapp'
import {
  Search, X, ShoppingBag, Plus, Minus, ChevronRight,
  Clock, MapPin, Truck, Store, Star, ArrowLeft,
  MessageCircle, Loader2, User, Phone, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Business, Category, Product, BusinessHours, CheckoutFormData } from '@/types'

interface Props {
  business: Business & {
    delivery_fee?: number
    delivery_enabled?: boolean
    pickup_enabled?: boolean
    min_order?: number
    estimated_time?: string
  }
  categories: Category[]
  products: Product[]
  hours: BusinessHours[]
}

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function isOpen(hours: BusinessHours[]): { open: boolean; label: string } {
  const now = new Date()
  const day = now.getDay()
  const time = now.toTimeString().slice(0, 5)
  const todayHours = hours.find(h => h.day_of_week === day)
  if (!todayHours || !todayHours.is_open) return { open: false, label: 'Cerrado hoy' }
  if (time >= todayHours.open_time && time < todayHours.close_time)
    return { open: true, label: `Abierto · Cierra ${todayHours.close_time}` }
  if (time < todayHours.open_time)
    return { open: false, label: `Abre a las ${todayHours.open_time}` }
  return { open: false, label: 'Cerrado por hoy' }
}

export default function FoodStore({ business, categories, products, hours }: Props) {
  const { addItem, items, removeItem, updateQuantity, total, itemCount, clearCart } = useCart()
  const [search, setSearch]           = useState('')
  const [activeCat, setActiveCat]     = useState<string | null>(null)
  const [cartOpen, setCartOpen]       = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [addedId, setAddedId]         = useState<string | null>(null)
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const color    = business.primary_color ?? '#FF5722'
  const currency = business.currency ?? 'UYU'
  const status   = isOpen(hours)
  const count    = itemCount()
  const cartTotal = total()

  const featured = products.filter(p => p.featured)
  const filtered = useMemo(() => {
    let list = products
    if (activeCat) list = list.filter(p => p.category_id === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    }
    return list
  }, [products, activeCat, search])

  function handleAdd(product: Product) {
    addItem(product, business.slug)
    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 900)
  }

  function scrollToCat(catId: string) {
    setActiveCat(catId)
    catRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">

      {/* ── HERO HEADER ── */}
      <div className="relative">
        {/* Banner */}
        <div className="h-40 sm:h-52 overflow-hidden bg-gray-200"
          style={{ background: business.banner_url ? undefined : `linear-gradient(135deg,${color},${color}88)` }}>
          {business.banner_url && (
            <img src={business.banner_url} alt={business.name}
              className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Info sobre el banner */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end gap-3">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name}
                className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white shrink-0" />
            ) : (
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white
                              text-lg font-bold ring-2 ring-white shrink-0"
                style={{ background: color }}>
                {business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="pb-1">
              <h1 className="text-white font-bold text-lg leading-tight">{business.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('flex items-center gap-1 text-xs font-medium',
                  status.open ? 'text-green-400' : 'text-red-400')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', status.open ? 'bg-green-400' : 'bg-red-400')} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cart button top-right */}
        <button onClick={() => setCartOpen(true)}
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center
                     rounded-xl bg-white/90 backdrop-blur-sm shadow-md">
          <ShoppingBag size={18} className="text-gray-700" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center
                             rounded-full text-[10px] font-bold text-white"
              style={{ background: color }}>
              {count}
            </span>
          )}
        </button>
      </div>

      {/* ── INFO RÁPIDA ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4 overflow-x-auto scrollbar-hide">
          {business.estimated_time && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
              <Clock size={13} className="text-gray-400" />
              {business.estimated_time}
            </div>
          )}
          {business.delivery_enabled && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
              <Truck size={13} className="text-gray-400" />
              {business.delivery_fee && business.delivery_fee > 0
                ? `Delivery ${formatPrice(business.delivery_fee, currency)}`
                : 'Delivery gratis'
              }
            </div>
          )}
          {business.pickup_enabled && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
              <Store size={13} className="text-gray-400" />
              Retiro disponible
            </div>
          )}
          {business.min_order && business.min_order > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
              Mín. {formatPrice(business.min_order, currency)}
            </div>
          )}
        </div>
      </div>

      {/* ── BUSCADOR ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-2.5">
        <div className="relative max-w-2xl mx-auto">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en el menú..."
            className="w-full rounded-xl bg-gray-100 pl-9 pr-3 py-2.5 text-sm
                       placeholder:text-gray-400 focus:outline-none focus:bg-gray-200 transition-colors" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto pb-32">
        {/* ── CATEGORÍAS SCROLL ── */}
        {categories.length > 0 && !search && (
          <div className="sticky top-[53px] z-10 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
              <button onClick={() => setActiveCat(null)}
                className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                  !activeCat ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                style={!activeCat ? { background: color } : {}}>
                Todo
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => scrollToCat(cat.id)}
                  className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                    activeCat === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  style={activeCat === cat.id ? { background: color } : {}}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DESTACADOS ── */}
        {featured.length > 0 && !activeCat && !search && (
          <div className="px-4 pt-5 pb-2">
            <p className="text-sm font-bold text-gray-700 mb-3">⭐ Destacados</p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              {featured.map(p => (
                <FeaturedCard key={p.id} product={p} currency={currency}
                  added={addedId === p.id} onAdd={() => handleAdd(p)} color={color} />
              ))}
            </div>
          </div>
        )}

        {/* ── PRODUCTOS POR CATEGORÍA ── */}
        {categories.length > 0 && !activeCat && !search ? (
          categories.map(cat => {
            const catProducts = filtered.filter(p => p.category_id === cat.id)
            if (catProducts.length === 0) return null
            return (
              <div key={cat.id} ref={el => { catRefs.current[cat.id] = el }} className="px-4 pt-5">
                <p className="text-sm font-bold text-gray-800 mb-3">{cat.name}</p>
                <div className="space-y-2">
                  {catProducts.map(p => (
                    <MenuRow key={p.id} product={p} currency={currency}
                      items={items} added={addedId === p.id}
                      onAdd={() => handleAdd(p)}
                      onRemove={() => removeItem(p.id)}
                      onQty={(qty) => updateQuantity(p.id, qty)}
                      color={color} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-4 pt-5">
            {activeCat && <p className="text-sm font-bold text-gray-800 mb-3">
              {categories.find(c => c.id === activeCat)?.name}
            </p>}
            {search && <p className="text-sm text-gray-400 mb-3">{filtered.length} resultados</p>}
            <div className="space-y-2">
              {filtered.map(p => (
                <MenuRow key={p.id} product={p} currency={currency}
                  items={items} added={addedId === p.id}
                  onAdd={() => handleAdd(p)}
                  onRemove={() => removeItem(p.id)}
                  onQty={(qty) => updateQuantity(p.id, qty)}
                  color={color} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTÓN FLOTANTE CARRITO ── */}
      {count > 0 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center z-20 px-4">
          <button onClick={() => setCartOpen(true)}
            className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5
                       text-white shadow-2xl w-full max-w-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: color }}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {count}
            </span>
            <span className="text-sm flex-1 text-center">Ver pedido</span>
            <span className="text-sm">{formatPrice(cartTotal, currency)}</span>
          </button>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {cartOpen && (
        <FoodCartDrawer
          items={items}
          business={business}
          currency={currency}
          color={color}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
          onRemove={removeItem}
          onQty={updateQuantity}
        />
      )}

      {/* ── CHECKOUT ── */}
      {checkoutOpen && (
        <FoodCheckout
          items={items}
          business={business}
          currency={currency}
          color={color}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => { clearCart(); setCheckoutOpen(false) }}
        />
      )}
    </div>
  )
}

// ── Featured Card ─────────────────────────────────────────────
function FeaturedCard({ product, currency, added, onAdd, color }: {
  product: Product; currency: string; added: boolean; onAdd: () => void; color: string
}) {
  return (
    <div className="shrink-0 w-40 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="h-28 bg-gray-100 overflow-hidden">
        <img src={productImageUrl(product.images)} alt={product.name}
          className="h-full w-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }} />
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{product.name}</p>
        <p className="text-xs font-bold mb-2" style={{ color }}>{formatPrice(product.price, currency)}</p>
        <button onClick={onAdd}
          className={cn('w-full rounded-xl py-1.5 text-xs font-bold transition-all',
            added ? 'bg-green-500 text-white' : 'text-white')}
          style={!added ? { background: color } : {}}>
          {added ? '✓ Agregado' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

// ── Menu Row ──────────────────────────────────────────────────
function MenuRow({ product, currency, items, added, onAdd, onRemove, onQty, color }: {
  product: Product; currency: string
  items: { product: Product; quantity: number }[]
  added: boolean; onAdd: () => void; onRemove: () => void
  onQty: (qty: number) => void; color: string
}) {
  const inCart = items.find(i => i.product.id === product.id)
  const qty = inCart?.quantity ?? 0

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
      <div className="h-16 w-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        <img src={productImageUrl(product.images)} alt={product.name}
          className="h-full w-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight">{product.name}</p>
        {product.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        <p className="text-sm font-bold mt-1" style={{ color }}>{formatPrice(product.price, currency)}</p>
      </div>
      {qty === 0 ? (
        <button onClick={onAdd}
          className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0',
            'transition-all active:scale-90', added ? 'bg-green-500' : '')}
          style={!added ? { background: color } : {}}>
          <Plus size={18} />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onQty(qty - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200
                       text-gray-600 hover:border-gray-400 transition-colors active:scale-90">
            <Minus size={14} />
          </button>
          <span className="text-sm font-bold text-gray-900 w-5 text-center">{qty}</span>
          <button onClick={onAdd}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white active:scale-90"
            style={{ background: color }}>
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Cart Drawer ───────────────────────────────────────────────
function FoodCartDrawer({ items, business, currency, color, onClose, onCheckout, onRemove, onQty }: {
  items: { product: Product; quantity: number }[]
  business: Props['business']; currency: string; color: string
  onClose: () => void; onCheckout: () => void
  onRemove: (id: string) => void; onQty: (id: string, qty: number) => void
}) {
  const cartTotal = items.reduce((a, i) => a + i.product.price * i.quantity, 0)
  const deliveryFee = business.delivery_fee ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="font-bold text-gray-900">Tu pedido ({items.reduce((a,i)=>a+i.quantity,0)} items)</p>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="h-12 w-12 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                <img src={productImageUrl(product.images)} alt={product.name}
                  className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-500">{formatPrice(product.price, currency)} c/u</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => onQty(product.id, quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600">
                  <Minus size={12} />
                </button>
                <span className="text-sm font-bold w-4 text-center">{quantity}</span>
                <button onClick={() => onQty(product.id, quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                  style={{ background: color }}>
                  <Plus size={12} />
                </button>
              </div>
              <p className="text-sm font-bold text-gray-900 w-16 text-right shrink-0">
                {formatPrice(product.price * quantity, currency)}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-semibold">{formatPrice(cartTotal, currency)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery</span>
              <span className="font-semibold">{formatPrice(deliveryFee, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span style={{ color }}>{formatPrice(cartTotal + deliveryFee, currency)}</span>
          </div>
          <button onClick={onCheckout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white"
            style={{ background: color }}>
            Continuar con el pedido <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Checkout ──────────────────────────────────────────────────
function FoodCheckout({ items, business, currency, color, onClose, onSuccess }: {
  items: { product: Product; quantity: number }[]
  business: Props['business']; currency: string; color: string
  onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState<CheckoutFormData>({
    name: '', phone: '', address: '', delivery_type: 'delivery', comment: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cartTotal = items.reduce((a, i) => a + i.product.price * i.quantity, 0)
  const deliveryFee = form.delivery_type === 'delivery' ? (business.delivery_fee ?? 0) : 0
  const waOk = (business.whatsapp ?? '').replace(/\D/g,'').length >= 8

  function set<K extends keyof CheckoutFormData>(key: K, val: CheckoutFormData[K]) {
    setForm(prev => ({ ...prev, [key]: val })); setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    if (form.delivery_type === 'delivery' && !form.address?.trim()) {
      setError('Ingresá la dirección de entrega'); return
    }
    if (!waOk) { setError('El comercio no tiene WhatsApp configurado'); return }

    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id, items,
          customerName: form.name.trim(), customerPhone: form.phone.trim(),
          customerAddress: form.delivery_type === 'delivery' ? form.address?.trim() : null,
          deliveryType: form.delivery_type, comment: form.comment?.trim() || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error') }

      const msg = buildWhatsAppMessage(items, form, currency)
      const waUrl = getWhatsAppUrl(business.whatsapp!, msg)
      window.open(waUrl, '_blank')
      onSuccess()
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <ArrowLeft size={16} />
          </button>
          <p className="font-bold text-gray-900">Completar pedido</p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 pb-8">
          {/* Resumen */}
          <div className="rounded-2xl bg-gray-50 px-4 py-3 space-y-1.5">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{quantity}× {product.name}</span>
                <span className="font-medium text-gray-900">{formatPrice(product.price * quantity, currency)}</span>
              </div>
            ))}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-500">Delivery</span>
                <span>{formatPrice(deliveryFee, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-1.5">
              <span>Total</span>
              <span style={{ color }}>{formatPrice(cartTotal + deliveryFee, currency)}</span>
            </div>
          </div>

          {/* Entrega */}
          <div>
            <p className="field-label mb-2">Tipo de entrega</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'delivery', label: '🛵 Delivery', sub: 'Lo llevamos', enabled: business.delivery_enabled ?? true },
                { val: 'pickup',   label: '🏃 Retiro',   sub: 'Paso a buscar', enabled: business.pickup_enabled ?? true },
              ].filter(o => o.enabled).map(({ val, label, sub }) => (
                <button key={val} type="button" onClick={() => set('delivery_type', val as 'delivery'|'pickup')}
                  className={cn('rounded-xl border-2 p-3 text-left transition-all',
                    form.delivery_type === val ? 'border-gray-900 bg-gray-50' : 'border-gray-100')}>
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Datos */}
          <div className="space-y-3">
            <div>
              <label className="field-label">Nombre <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Tu nombre" className="input-base pl-9" />
              </div>
            </div>
            <div>
              <label className="field-label">Teléfono <span className="text-red-400">*</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" required value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="099 123 456" className="input-base pl-9" inputMode="numeric" />
              </div>
            </div>
            {form.delivery_type === 'delivery' && (
              <div>
                <label className="field-label">Dirección <span className="text-red-400">*</span></label>
                <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="Calle, número, piso..." className="input-base" />
              </div>
            )}
            <div>
              <label className="field-label">
                Comentario <span className="text-gray-400 font-normal text-xs">(sin gluten, sin cebolla...)</span>
              </label>
              <textarea value={form.comment} onChange={e => set('comment', e.target.value)} rows={2}
                placeholder="Aclaraciones del pedido" className="input-base resize-none" />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={submitting || !waOk}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold
                       text-white disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: color }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            {submitting ? 'Enviando...' : 'Enviar pedido por WhatsApp'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Se abrirá WhatsApp con tu pedido ya armado · Solo tocás Enviar
          </p>
        </form>
      </div>
    </div>
  )
}
