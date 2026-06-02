'use client'
// UpgradePrompt — banner/bloqueo cuando un usuario Basic llega al límite de su plan
import Link from 'next/link'
import { Zap, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  resource:    string          // "productos", "clientes", "pedidos", etc.
  current:     number
  limit:       number
  variant?:    'banner' | 'inline' | 'block'
  className?:  string
}

export default function UpgradePrompt({
  resource, current, limit, variant = 'banner', className,
}: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const atLimit = current >= limit

  if (variant === 'block') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed',
        'border-amber-200 bg-amber-50/50 px-6 py-10 text-center',
        className
      )}>
        <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Zap size={22} className="text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Límite de {resource} alcanzado</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Tu plan gratuito permite hasta <strong>{limit} {resource}</strong>. Tenés {current} activos.
            Actualizá para agregar más.
          </p>
        </div>
        <Link
          href="/admin/planes"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5
                     text-sm font-bold text-white hover:bg-amber-600 transition-all shadow-sm"
        >
          <Zap size={14} /> Ver planes
        </Link>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3',
        className
      )}>
        <Zap size={15} className="text-amber-500 shrink-0" />
        <p className="text-xs text-gray-700 flex-1">
          <span className="font-semibold">Plan gratuito:</span>{' '}
          {current}/{limit} {resource} usados.{' '}
          {atLimit ? (
            <Link href="/admin/planes" className="font-semibold text-amber-600 hover:underline">
              Actualizá tu plan para agregar más →
            </Link>
          ) : (
            <span className="text-gray-500">Te quedan {limit - current} disponibles.</span>
          )}
        </p>
        {!atLimit && (
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  // variant === 'banner' (default)
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5',
      atLimit
        ? 'bg-amber-50 border border-amber-200'
        : 'bg-gray-50 border border-gray-100',
      className
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <Zap size={15} className={atLimit ? 'text-amber-500 shrink-0' : 'text-gray-400 shrink-0'} />
        <p className="text-xs text-gray-600 truncate">
          {atLimit
            ? <>Límite de <strong>{limit} {resource}</strong> alcanzado en el plan gratuito.</>
            : <>{current}/{limit} {resource} en tu plan gratuito.</>
          }
        </p>
      </div>
      <Link
        href="/admin/planes"
        className="shrink-0 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
      >
        {atLimit ? 'Upgradear →' : 'Ver planes'}
      </Link>
    </div>
  )
}
