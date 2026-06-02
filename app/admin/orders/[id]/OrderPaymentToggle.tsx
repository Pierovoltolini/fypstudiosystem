// app/admin/orders/[id]/OrderPaymentToggle.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, CircleDollarSign, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

const CONF: Record<PaymentStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  unpaid:   { label: 'Sin cobrar',  icon: CircleDollarSign, bg: '#FEF3C7', text: '#92400E' },
  paid:     { label: 'Cobrado',     icon: CheckCircle,       bg: '#D1FAE5', text: '#065F46' },
  refunded: { label: 'Devuelto',    icon: CircleDollarSign,  bg: '#EDE9FE', text: '#5B21B6' },
}

export default function OrderPaymentToggle({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: PaymentStatus
}) {
  const router  = useRouter()
  const supabase = createClient()
  const [status,  setStatus]  = useState<PaymentStatus>(currentStatus)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next: PaymentStatus = status === 'paid' ? 'unpaid' : 'paid'
    setLoading(true)
    await supabase.from('orders').update({ payment_status: next }).eq('id', orderId)
    setStatus(next)
    router.refresh()
    setLoading(false)
  }

  const conf = CONF[status]
  const Icon = conf.icon

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{ background: conf.bg, color: conf.text }}>
          <Icon size={11} />
          {conf.label}
        </span>
      </div>
      {status !== 'refunded' && (
        <button
          onClick={toggle}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all',
            status === 'paid'
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
          )}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
          {status === 'paid' ? 'Marcar sin cobrar' : 'Marcar cobrado'}
        </button>
      )}
    </div>
  )
}
