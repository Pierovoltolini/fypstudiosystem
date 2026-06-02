// app/admin/orders/[id]/OrderStatusUpdater.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { orderStatusLabel, orderStatusColor, cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'

const STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'
] as const

type Status = typeof STATUSES[number]

// Flujo visual: qué estados son "progreso" vs "final"
const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered']

export default function OrderStatusUpdater({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState(currentStatus)

  async function updateStatus(status: Status) {
    if (status === selected) return
    setLoading(status)
    const confirmedSale =
      status === 'delivered' ? true :
      status === 'cancelled' ? false : undefined
    const patch = confirmedSale !== undefined
      ? { status, confirmed_sale: confirmedSale }
      : { status }
    await supabase.from('orders').update(patch).eq('id', orderId)
    setSelected(status)
    router.refresh()
    setLoading(null)
  }

  const currentIdx = STATUS_ORDER.indexOf(selected)

  return (
    <div className="space-y-4">
      {/* Barra de progreso (solo para estados no cancelados) */}
      {selected !== 'cancelled' && (
        <div className="flex items-center gap-1.5">
          {STATUS_ORDER.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={cn(
                'h-1.5 w-full rounded-full transition-all',
                i <= currentIdx ? 'bg-gray-900' : 'bg-gray-100'
              )} />
            </div>
          ))}
        </div>
      )}

      {/* Botones de estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            disabled={loading !== null}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all',
              selected === s
                ? 'ring-2 ring-gray-900 ring-offset-1 bg-white shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600',
              s === 'cancelled' && selected !== 'cancelled' && 'hover:bg-red-50 hover:text-red-600'
            )}
          >
            {loading === s ? (
              <Loader2 size={11} className="animate-spin" />
            ) : selected === s ? (
              <Check size={11} />
            ) : null}
            <span className={selected === s ? orderStatusColor(s).split(' ')[1] : ''}>
              {orderStatusLabel(s)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
