// components/admin/PlanGate.tsx
// Reusable plan gate — wrap any feature that requires Pro or Premium
'use client'
import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'
import { useVertical } from '@/lib/vertical-context'

const PLAN_ORDER: Plan[] = ['basic', 'pro', 'premium']

interface Props {
  required: 'pro' | 'premium'
  feature?: string
  description?: string
  children: React.ReactNode
}

export default function PlanGate({
  required, feature, description, children,
}: Props) {
  const { business, color: accent } = useVertical()
  const current = business.plan
  const currentIdx = current ? PLAN_ORDER.indexOf(current) : 0
  const requiredIdx = PLAN_ORDER.indexOf(required)
  const hasAccess = currentIdx >= requiredIdx

  if (hasAccess) return <>{children}</>

  const planLabel = required === 'pro' ? 'Pro' : 'Premium'

  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-4"
        style={{ background: accent + '18' }}
      >
        <Lock size={20} style={{ color: accent }} />
      </div>

      <p className="font-semibold text-gray-900 mb-1">
        {feature ? `${feature} requiere plan ${planLabel}` : `Requiere plan ${planLabel}`}
      </p>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
        {description ?? `Activá el plan ${planLabel} para desbloquear esta funcionalidad.`}
      </p>

      <Link
        href="/admin/billing"
        className={cn(
          'inline-flex items-center gap-2 rounded-xl px-5 py-2.5',
          'text-sm font-semibold text-white transition-all hover:opacity-90'
        )}
        style={{ background: accent }}
      >
        <Zap size={14} /> Ver planes
      </Link>
    </div>
  )
}
