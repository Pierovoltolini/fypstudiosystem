// app/admin/orders/OrderStatusFilter.tsx
'use client'
import { useRouter, usePathname } from 'next/navigation'
import { orderStatusLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled']

export default function OrderStatusFilter({
  current,
  counts,
}: {
  current: string | null
  counts: Record<string, number>
}) {
  const router = useRouter()
  const pathname = usePathname()

  function filter(status: string | null) {
    if (status) router.push(`${pathname}?status=${status}`)
    else router.push(pathname)
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => filter(null)}
        className={cn(
          'shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all',
          !current ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
        )}
      >
        Todos
      </button>
      {STATUSES.map(s => (
        <button
          key={s}
          onClick={() => filter(s)}
          className={cn(
            'shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all',
            current === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
        >
          {orderStatusLabel(s)}
          {counts[s] > 0 && (
            <span className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
              current === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            )}>
              {counts[s]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
