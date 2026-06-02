// app/admin/mercados/POSClient.tsx
'use client'
import { useState, useMemo, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, Check,
  Package, ChevronRight, Banknote, CreditCard, Smartphone,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import type { Product, Category } from '@/types'

interface CartLine { id: string; name: string; price: number; qty: number }

interface Props {
  products:   Product[]
  categories: Category[]
}

type PayMethod = 'efectivo' | 'tarjeta' | 'transferencia'

const PAY_METHODS: { key: PayMethod; label: string; Icon: React.ElementType }[] = [
  { key: 'efectivo',      label: 'Efectivo',     Icon: Banknote    },
  { key: 'tarjeta',       label: 'Tarjeta',       Icon: CreditCard  },
  { key: 'transferencia', label: 'Transf.',       Icon: Smartphone  },
]

export default function POSClient({ products, categories }: Props) {
  const { businessId, business, currency, color: primaryColor } = useVertical()
  const color = primaryColor || '#16A34A'

  const [search,       setSearch]       = useState('')
  const [activeCat,    setActiveCat]    = useState<string | null>(null)
  const [cart,         setCart]         = useState<CartLine[]>([])
  const [showCartMob,  setShowCartMob]  = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [done,         setDone]         = useState<{ num: number; total: number } | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [payMethod,    setPayMethod]    = useState<PayMethod>('efectivo')
  const [cashRec,      setCashRec]      = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Product filter ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products
    if (activeCat) list = list.filter(p => p.category_id === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => {
        if (p.name.toLowerCase().includes(q)) return true
        const inv = (p as Product & { inventory_item?: { sku?: string } }).inventory_item
        if (inv?.sku?.toLowerCase().includes(q)) return true
        return false
      })
    }
    return list
  }, [products, activeCat, search])

  // ── Cart ops ──────────────────────────────────────────────────
  function add(p: Product) {
    setCart(prev => {
      const ex = prev.find(l => l.id === p.id)
      if (ex) return prev.map(l => l.id === p.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  function qty(id: string, delta: number) {
    setCart(prev =>
      prev.map(l => l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l)
          .filter(l => l.qty > 0)
    )
  }

  function remove(id: string) { setCart(prev => prev.filter(l => l.id !== id)) }

  const total     = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const itemCount = cart.reduce((s, l) => s + l.qty, 0)
  const change    = payMethod === 'efectivo' && cashRec ? parseFloat(cashRec) - total : 0

  // ── Barcode scanner: Enter key on search ──────────────────────
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !search.trim()) return
    const q = search.trim().toLowerCase()
    const match = products.find(p => {
      if (p.name.toLowerCase() === q) return true
      const inv = (p as Product & { inventory_item?: { sku?: string } }).inventory_item
      return inv?.sku?.toLowerCase() === q
    })
    if (match) { add(match); setSearch(''); searchRef.current?.focus() }
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (!cart.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerName: customerName.trim() || 'Cliente POS',
          deliveryType: 'pickup',
          pos: true,
          comment: payMethod === 'efectivo' && cashRec
            ? `Pago en efectivo · Recibido: ${cashRec}`
            : `Pago: ${payMethod}`,
          items: cart.map(l => ({
            product: { id: l.id, name: l.name, price: l.price },
            quantity: l.qty,
          })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      const { orderNumber } = await res.json()
      setDone({ num: orderNumber, total })
      setCart([]); setCashRec(''); setCustomerName(''); setShowCheckout(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar venta')
    } finally { setLoading(false) }
  }

  // ── Success ───────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="h-20 w-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
          style={{ background: color }}>
          <Check size={38} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">¡Venta registrada!</h2>
        <p className="text-gray-400 mb-2">
          Venta #{String(done.num).padStart(4, '0')}
        </p>
        <p className="text-3xl font-black mb-8" style={{ color }}>
          {formatPrice(done.total, currency)}
        </p>
        <button onClick={() => setDone(null)}
          className="flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold text-white"
          style={{ background: color }}>
          + Nueva venta
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 pb-28 lg:pb-4">

      {/* ── LEFT: búsqueda + productos ───────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-gray-900">Punto de Venta</h1>
          <p className="text-xs text-gray-400">{business.name}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Buscar por nombre, SKU o escanear código..."
            autoFocus
            className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-9 py-3
                       text-sm outline-none focus:ring-2 focus:ring-green-100 transition-all
                       placeholder:text-gray-300"
            style={{ borderColor: search ? color : undefined,
                     boxShadow: search ? `0 0 0 2px ${color}22` : undefined }}
          />
          {search && (
            <button onClick={() => { setSearch(''); searchRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[{ id: null, name: 'Todos' }, ...categories].map(cat => {
              const active = activeCat === cat.id
              return (
                <button key={String(cat.id)} onClick={() => setActiveCat(cat.id)}
                  className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                  style={active
                    ? { background: color, color: 'white' }
                    : { background: 'white', border: '1px solid #E5E7EB', color: '#6B7280' }}>
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={28} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sin productos{search ? ` con "${search}"` : ''}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filtered.map(product => {
              const inCart = cart.find(l => l.id === product.id)
              const img = product.images?.[0]
              return (
                <button key={product.id} onClick={() => add(product)}
                  className="relative flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3
                             bg-white text-left transition-all active:scale-[0.97] hover:shadow-sm"
                  style={inCart
                    ? { borderColor: color, background: `${color}08` }
                    : { borderColor: '#E5E7EB' }}>
                  {/* Qty badge */}
                  {inCart && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center
                                    justify-center text-[10px] font-black text-white"
                      style={{ background: color }}>
                      {inCart.qty}
                    </div>
                  )}
                  {/* Image */}
                  {img ? (
                    <img src={img} alt={product.name}
                      className="w-full aspect-square rounded-xl object-cover" />
                  ) : (
                    <div className="w-full aspect-square rounded-xl flex items-center justify-center"
                      style={{ background: `${color}12` }}>
                      <Package size={22} style={{ color }} />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-sm font-black" style={{ color }}>
                    {formatPrice(product.price, currency)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: Cart (desktop) ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0">
        <CartPanel
          cart={cart} total={total} currency={currency} color={color}
          onQty={qty} onRemove={remove}
          onCheckout={() => setShowCheckout(true)}
        />
      </aside>

      {/* ── Mobile: sticky bottom bar ────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-white border-t border-gray-100 shadow-lg">
        {itemCount === 0 ? (
          <p className="text-center text-xs text-gray-400 py-1">
            Tocá un producto para agregarlo
          </p>
        ) : (
          <button onClick={() => setShowCartMob(true)}
            className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 text-white font-bold"
            style={{ background: color }}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={17} />
              <span>{itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{formatPrice(total, currency)}</span>
              <ChevronRight size={15} />
            </div>
          </button>
        )}
      </div>

      {/* ── Mobile: Cart drawer ───────────────────────────────── */}
      {showCartMob && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCartMob(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="font-bold text-gray-900">Carrito</p>
              <button onClick={() => setShowCartMob(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <CartPanel
                cart={cart} total={total} currency={currency} color={color}
                onQty={qty} onRemove={remove}
                onCheckout={() => { setShowCartMob(false); setShowCheckout(true) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Checkout modal ────────────────────────────────────── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCheckout(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl
                          shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100
                            sticky top-0 bg-white z-10">
              <p className="font-bold text-gray-900">Cobrar venta</p>
              <button onClick={() => setShowCheckout(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="p-5 space-y-4">

              {/* Resumen */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                {cart.map(l => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">
                      {l.name} <span className="text-gray-400">×{l.qty}</span>
                    </span>
                    <span className="font-semibold text-gray-900 shrink-0">
                      {formatPrice(l.price * l.qty, currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-baseline border-t border-gray-200 pt-2">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-xl font-black" style={{ color }}>
                    {formatPrice(total, currency)}
                  </span>
                </div>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Cliente <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input type="text" value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                             outline-none focus:ring-2 focus:ring-green-100 transition-all"
                  style={{ borderColor: customerName ? color : undefined }} />
              </div>

              {/* Forma de pago */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Forma de pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map(({ key, label, Icon }) => (
                    <button key={key} type="button" onClick={() => setPayMethod(key)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border-2 p-3
                                 text-xs font-semibold transition-all"
                      style={payMethod === key
                        ? { borderColor: color, background: `${color}10`, color }
                        : { borderColor: '#E5E7EB', color: '#6B7280' }}>
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vuelto para efectivo */}
              {payMethod === 'efectivo' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Monto recibido
                  </label>
                  <input type="number" min={0} step="1"
                    value={cashRec} onChange={e => setCashRec(e.target.value)}
                    placeholder={String(Math.ceil(total))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                               outline-none focus:ring-2 focus:ring-green-100 transition-all" />
                  {cashRec && change >= 0 && (
                    <p className="text-sm font-bold mt-2" style={{ color }}>
                      Vuelto: {formatPrice(change, currency)}
                    </p>
                  )}
                  {cashRec && change < 0 && (
                    <p className="text-sm font-bold mt-2 text-red-500">
                      Faltan {formatPrice(Math.abs(change), currency)}
                    </p>
                  )}
                </div>
              )}

              <button type="submit"
                disabled={loading || !cart.length || (payMethod === 'efectivo' && !!cashRec && change < 0)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-4
                           text-sm font-bold text-white disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{ background: color }}>
                {loading ? 'Registrando...' : `Confirmar venta · ${formatPrice(total, currency)}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cart Panel ────────────────────────────────────────────────────
function CartPanel({ cart, total, currency, color, onQty, onRemove, onCheckout }: {
  cart: CartLine[]; total: number; currency: string; color: string
  onQty: (id: string, d: number) => void; onRemove: (id: string) => void; onCheckout: () => void
}) {
  const itemCount = cart.reduce((s, l) => s + l.qty, 0)
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <ShoppingCart size={14} style={{ color }} />
        <p className="text-sm font-semibold text-gray-900">
          Carrito{itemCount > 0 ? ` (${itemCount})` : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart size={24} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">Agregá productos</p>
            <p className="text-[11px] text-gray-300 mt-1">o escaneá un código</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {cart.map(l => (
              <div key={l.id} className="flex items-center gap-2 px-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{l.name}</p>
                  <p className="text-[11px] font-bold mt-0.5" style={{ color }}>
                    {formatPrice(l.price * l.qty, currency)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onQty(l.id, -1)}
                    className="h-6 w-6 rounded-lg flex items-center justify-center
                               bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    <Minus size={10} />
                  </button>
                  <span className="text-xs font-bold w-5 text-center">{l.qty}</span>
                  <button onClick={() => onQty(l.id, 1)}
                    className="h-6 w-6 rounded-lg flex items-center justify-center text-white"
                    style={{ background: color }}>
                    <Plus size={10} />
                  </button>
                  <button onClick={() => onRemove(l.id)}
                    className="h-6 w-6 rounded-lg flex items-center justify-center
                               text-red-400 hover:bg-red-50 transition-colors ml-0.5">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 font-medium">Total</span>
            <span className="text-xl font-black" style={{ color }}>
              {formatPrice(total, currency)}
            </span>
          </div>
          <button onClick={onCheckout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5
                       text-sm font-bold text-white transition-all active:scale-[0.98]"
            style={{ background: color }}>
            Cobrar {formatPrice(total, currency)}
          </button>
        </div>
      )}
    </div>
  )
}
