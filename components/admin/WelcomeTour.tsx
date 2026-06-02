'use client'
// WelcomeTour — guía interactiva de bienvenida para usuarios nuevos
// Se muestra una vez; se puede saltar o completar. Estado guardado en DB.
import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Zap, LayoutDashboard, Search, Sparkles, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  icon:        React.ElementType
  color:       string
  title:       string
  description: string
  hint:        string   // dónde está en la pantalla
}

const STEPS: Step[] = [
  {
    icon:        LayoutDashboard,
    color:       '#6366F1',
    title:       '¡Bienvenido a tu panel! 🎉',
    description: 'Este es tu dashboard personalizable. Podés agregar, quitar y reordenar widgets según lo que más uses. Cada widget te muestra información en tiempo real de tu negocio.',
    hint:        '👆 El área central es tu dashboard',
  },
  {
    icon:        Search,
    color:       '#0EA5E9',
    title:       'Búsqueda global',
    description: 'Buscá cualquier producto, cliente, movimiento de caja o costo desde cualquier pantalla. Presioná ⌘K (o Ctrl+K) para abrirla instantáneamente.',
    hint:        '🔍 El botón de búsqueda está en la barra superior',
  },
  {
    icon:        Sparkles,
    color:       '#8B5CF6',
    title:       'Asistente IA',
    description: 'Tu asistente conoce los datos reales de tu negocio. Preguntale "¿Cuánto facturé esta semana?" o "¿Qué productos vendí más?". Responde con datos concretos.',
    hint:        '✨ El botón violeta flotante en la esquina inferior derecha',
  },
  {
    icon:        Zap,
    color:       '#F59E0B',
    title:       'Módulos personalizados',
    description: 'Podés crear secciones a medida para trackear cualquier dato de tu negocio: desperdicio de ingredientes, mantenimientos, control de empleados, lo que necesites.',
    hint:        '📦 En el menú lateral → "Mis módulos"',
  },
  {
    icon:        CreditCard,
    color:       '#10B981',
    title:       '¡Ya estás listo!',
    description: 'Explorá la app libremente. Si querés desbloquear más funciones — pedidos ilimitados, más IA, staff adicional y exportaciones — podés upgradar tu plan en cualquier momento.',
    hint:        '💳 Menú lateral → Planes',
  },
]

interface Props {
  onFinish: () => void
}

export default function WelcomeTour({ onFinish }: Props) {
  const [step,    setStep]    = useState(0)
  const [leaving, setLeaving] = useState(false)

  const current    = STEPS[step]
  const isLast     = step === STEPS.length - 1
  const Icon       = current.icon
  const progress   = ((step + 1) / STEPS.length) * 100

  async function finish(action: 'complete' | 'skip') {
    setLeaving(true)
    // Fire and forget — no bloquear la UI
    fetch('/api/tour/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action }),
    }).catch(() => {})
    // Pequeño delay para que se vea el fade
    setTimeout(onFinish, 200)
  }

  return (
    <>
      {/* Overlay semitransparente */}
      <div className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
        leaving ? 'opacity-0' : 'opacity-100'
      )} />

      {/* Modal centrado */}
      <div className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200',
        leaving ? 'opacity-0' : 'opacity-100'
      )}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%`, background: current.color }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <div key={i} className="h-1.5 w-1.5 rounded-full transition-all"
                  style={{ background: i === step ? current.color : '#E5E7EB' }} />
              ))}
            </div>
            <button onClick={() => finish('skip')}
              className="h-7 w-7 flex items-center justify-center rounded-lg
                         text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Icon */}
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: current.color + '18' }}>
              <Icon size={26} style={{ color: current.color }} />
            </div>

            {/* Step counter */}
            <p className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: current.color }}>
              Paso {step + 1} de {STEPS.length}
            </p>

            {/* Title */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-tight">
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              {current.description}
            </p>

            {/* Hint */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{current.hint}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 pb-6 gap-3">
            <button
              onClick={() => finish('skip')}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              Saltar tour
            </button>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700
                             px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <ChevronLeft size={14} /> Anterior
                </button>
              )}
              <button
                onClick={() => isLast ? finish('complete') : setStep(s => s + 1)}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold
                           text-white transition-all active:scale-[0.97]"
                style={{ background: current.color }}>
                {isLast ? '¡Empezar!' : 'Siguiente'}
                {!isLast && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
