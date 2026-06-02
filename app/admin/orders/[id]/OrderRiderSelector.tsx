// app/admin/orders/[id]/OrderRiderSelector.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bike, Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeliveryRider } from '@/types'

interface Props {
  orderId:       string
  businessId:    string
  currentRider?: DeliveryRider | null
}

export default function OrderRiderSelector({ orderId, businessId, currentRider: initial }: Props) {
  const supabase = createClient()
  const [riders,       setRiders]       = useState<DeliveryRider[]>([])
  const [currentRider, setCurrentRider] = useState<DeliveryRider | null>(initial ?? null)
  const [saving,       setSaving]       = useState(false)
  const [open,         setOpen]         = useState(false)

  useEffect(() => {
    supabase
      .from('delivery_riders')
      .select('id, name, phone, active, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setRiders((data ?? []) as DeliveryRider[]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  async function assign(rider: DeliveryRider | null) {
    setSaving(true)
    setOpen(false)
    await supabase
      .from('orders')
      .update({ rider_id: rider?.id ?? null })
      .eq('id', orderId)
    setCurrentRider(rider)
    setSaving(false)
  }

  if (riders.length === 0) return null

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">Repartidor</p>

      {currentRider ? (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                          bg-blue-500 text-white text-xs font-black">
            {currentRider.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{currentRider.name}</p>
            {currentRider.phone && (
              <p className="text-xs text-gray-400">{currentRider.phone}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpen(o => !o)}
              disabled={saving}
              className="text-xs text-blue-500 font-medium hover:text-blue-700 transition-colors">
              Cambiar
            </button>
            <button
              onClick={() => assign(null)}
              disabled={saving}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-300
                         hover:bg-red-50 hover:text-red-400 transition-all">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 w-full text-left',
            'text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all',
            'border-gray-200 bg-white disabled:opacity-50'
          )}>
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : <Bike size={14} />}
          Asignar repartidor
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-10">
          {riders.map(r => (
            <button key={r.id}
              onClick={() => assign(r)}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                currentRider?.id === r.id && 'bg-blue-50'
              )}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                              bg-blue-500 text-white text-[11px] font-black">
                {r.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
              </div>
              {currentRider?.id === r.id && <Check size={13} className="text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
