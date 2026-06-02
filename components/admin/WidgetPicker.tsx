'use client'
// Panel "Agregar widget" — muestra los disponibles, grisea los ya activos
import { X, Plus, Check } from 'lucide-react'
import {
  BarChart2, TrendingDown, AlertTriangle, ShoppingBag,
  Users, StickyNote, Wallet, Zap,
  CalendarDays, CalendarCheck, TrendingUp, Target,
} from 'lucide-react'
import { WIDGET_REGISTRY } from '@/lib/dashboard-widgets'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  BarChart2, TrendingDown, AlertTriangle, ShoppingBag,
  Users, StickyNote, Wallet, Zap,
  CalendarDays, CalendarCheck, TrendingUp, Target,
}

interface Props {
  open:          boolean
  onClose:       () => void
  activeWidgets: string[]
  onAdd:         (id: string) => void
}

export default function WidgetPicker({ open, onClose, activeWidgets, onAdd }: Props) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — bottom sheet en mobile, modal centrado en desktop */}
      <div className="fixed z-50 bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2
                      sm:-translate-x-1/2 sm:-translate-y-1/2
                      sm:w-full sm:max-w-md animate-slide-up">
        <div className="bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">Agregar widget</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeWidgets.length} de {WIDGET_REGISTRY.length} activos
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg
                         text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Widget grid */}
          <div className="p-4 grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto">
            {WIDGET_REGISTRY.map(def => {
              const Icon    = ICON_MAP[def.iconName] ?? BarChart2
              const already = activeWidgets.includes(def.id)
              return (
                <button
                  key={def.id}
                  disabled={already}
                  onClick={() => onAdd(def.id)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all',
                    already
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 active:scale-[0.97]'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center',
                      already ? 'bg-gray-200' : 'bg-blue-100'
                    )}>
                      {already
                        ? <Check size={13} className="text-gray-500" />
                        : <Icon  size={13} className="text-blue-600" />
                      }
                    </div>
                    {!already && (
                      <Plus size={13} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{def.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{def.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
            <p className="text-[10px] text-gray-400 text-center">
              Arrastrá los widgets del dashboard para reordenarlos
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
