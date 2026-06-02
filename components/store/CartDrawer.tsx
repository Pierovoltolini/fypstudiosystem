// components/store/CartDrawer.tsx
'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { formatPrice, productImageUrl } from '@/lib/utils'
import { X, Plus, Minus, Trash2, ShoppingBag, ChevronRight, AlertCircle, Truck } from 'lucide-react'
import type { Business } from '@/types'

export default function CartDrawer({
  open,
  onClose,
  business,
  tableId,
}: {
  open: boolean
  onClose: () => void
  business: Business
  tableId?: string | null
}) {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart()
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)
  const currency = business.currency ?? 'UYU'

  const deliveryEnabled = business.delivery_enabled ?? false
  const deliveryFee     = business.delivery_fee ?? 0
  const minOrder        = business.min_order ?? 0

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const subtotal  = total()
  const belowMin  = minOrder > 0 && subtotal < minOrder
  const missing   = minOrder - subtotal
  const cartTotal = subtotal

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300
                    ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl
                    flex flex-col transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={18} className="text-gray-700" />
            <h2 className="font-semibold text-gray-900">Tu pedido</h2>
            {items.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full
                               text-[10px] font-bold text-white"
                style={{ background: business.primary_color }}>
                {items.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                       hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <ShoppingBag size={24} className="text-gray-300" />
              </div>
              <p className="font-medium text-gray-400">Tu carrito está vacío</p>
              <p className="text-xs text-gray-300 mt-1">Agregá productos para hacer tu pedido</p>
              <button onClick={onClose}
                className="mt-5 rounded-xl border border-gray-200 px-5 py-2 text-sm text-gray-500
                           hover:bg-gray-50 transition-colors">
                Ver productos
              </button>
            </div>
          ) : (
            <div className="px-4 space-y-2">
              {items.map(({ product, quantity }) => (
                <div key={product.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 cart-item-enter">
                  {/* Imagen */}
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                    <img src={productImageUrl(product.images)} alt={product.name}
                      className="h-full w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatPrice(product.price, currency)} c/u
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {formatPrice(product.price * quantity, currency)}
                    </p>
                  </div>

                  {/* Cantidad */}
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => removeItem(product.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg
                                   bg-white border border-gray-200 text-gray-600
                                   hover:border-gray-400 transition-colors active:scale-90"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="text-sm font-semibold text-gray-900 w-5 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-white
                                   transition-colors active:scale-90"
                        style={{ background: business.primary_color }}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con total y checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            {/* Min order warning */}
            {belowMin && (
              <div className="flex items-start gap-2.5 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
                <AlertCircle size={14} className="text-orange-500 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-700 leading-relaxed">
                  Mínimo {formatPrice(minOrder, currency)} · te faltan{' '}
                  <span className="font-semibold">{formatPrice(missing, currency)}</span>
                </p>
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatPrice(subtotal, currency)}
                </span>
              </div>
              {deliveryEnabled && deliveryFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Truck size={12} />
                    Envío (si elegís delivery)
                  </span>
                  <span className="text-xs text-gray-400">
                    +{formatPrice(deliveryFee, currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(cartTotal, currency)}
              </span>
            </div>

            {/* Ir al checkout */}
            <button
              disabled={belowMin}
              onClick={() => {
                onClose()
                router.push(`/store/${business.slug}/checkout${tableId ? `?mesa=${tableId}` : ''}`)
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4
                         text-sm font-semibold transition-all active:scale-[0.98] shadow-lg
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ background: business.primary_color, color: business.secondary_color }}
            >
              Confirmar pedido
              <ChevronRight size={16} />
            </button>

            {/* Limpiar carrito */}
            <button onClick={clearCart}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  )
}
