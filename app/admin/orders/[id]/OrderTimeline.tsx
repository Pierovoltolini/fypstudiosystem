// app/admin/orders/[id]/OrderTimeline.tsx
'use client'
import { orderStatusLabel } from '@/lib/utils'
import {
  Clock, CheckCircle2, ChefHat, Bell, Truck, PackageCheck, XCircle, ShoppingCart
} from 'lucide-react'
import { formatDistanceStrict, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export interface OrderEvent {
  id: string
  status: string
  note?: string | null
  actor_name?: string | null
  created_at: string
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <ShoppingCart size={14} />,
  confirmed: <CheckCircle2 size={14} />,
  preparing: <ChefHat size={14} />,
  ready:     <Bell size={14} />,
  shipped:   <Truck size={14} />,
  delivered: <PackageCheck size={14} />,
  cancelled: <XCircle size={14} />,
}

const STATUS_COLOR: Record<string, { dot: string; line: string; icon: string }> = {
  pending:   { dot: 'bg-gray-400',   line: 'bg-gray-200',  icon: 'text-gray-500' },
  confirmed: { dot: 'bg-blue-500',   line: 'bg-blue-200',  icon: 'text-blue-600' },
  preparing: { dot: 'bg-amber-500',  line: 'bg-amber-200', icon: 'text-amber-600' },
  ready:     { dot: 'bg-violet-500', line: 'bg-violet-200',icon: 'text-violet-600' },
  shipped:   { dot: 'bg-indigo-500', line: 'bg-indigo-200',icon: 'text-indigo-600' },
  delivered: { dot: 'bg-green-500',  line: 'bg-green-200', icon: 'text-green-600' },
  cancelled: { dot: 'bg-red-500',    line: 'bg-red-200',   icon: 'text-red-600' },
}

function fallback(status: string) {
  return { dot: 'bg-gray-400', line: 'bg-gray-200', icon: 'text-gray-500' }
}

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (!events.length) return null

  // Sort ascending (oldest first for visual top-to-bottom)
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Clock size={15} className="text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Timeline</p>
      </div>

      <ol className="relative">
        {sorted.map((ev, i) => {
          const isLast = i === sorted.length - 1
          const col = STATUS_COLOR[ev.status] ?? fallback(ev.status)
          const nextEv = sorted[i + 1]
          const elapsed = nextEv
            ? formatDistanceStrict(
                parseISO(nextEv.created_at),
                parseISO(ev.created_at),
                { locale: es }
              )
            : null

          return (
            <li key={ev.id} className="flex gap-4 pb-5 last:pb-0">
              {/* Left column: dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`
                  flex h-7 w-7 items-center justify-center rounded-full
                  ${isLast ? col.dot + ' text-white shadow-sm' : 'bg-gray-100 ' + col.icon}
                `}>
                  {STATUS_ICON[ev.status] ?? <Clock size={14} />}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 mt-1.5 ${col.line} min-h-[16px]`} />
                )}
              </div>

              {/* Right column: content */}
              <div className="flex-1 pt-0.5 pb-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${isLast ? 'text-gray-900' : 'text-gray-600'}`}>
                    {orderStatusLabel(ev.status)}
                  </p>
                  <time className="text-xs text-gray-400 tabular-nums shrink-0">
                    {format(parseISO(ev.created_at), 'HH:mm', { locale: es })}
                  </time>
                </div>

                {ev.note && (
                  <p className="mt-0.5 text-xs text-gray-500">{ev.note}</p>
                )}
                {ev.actor_name && (
                  <p className="mt-0.5 text-xs text-gray-400">por {ev.actor_name}</p>
                )}
                {elapsed && (
                  <p className="mt-1 text-[11px] text-gray-300 flex items-center gap-1">
                    <Clock size={10} /> {elapsed} hasta el siguiente estado
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
