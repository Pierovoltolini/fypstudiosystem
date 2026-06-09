'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// idx:  -1 = oculto, 0 = bienvenida, 1-3 = spotlight, 4 = cierre

const ARROW     = 8
const TOOLTIP_W = 296
const EST_H     = 148
const GAP       = 12

const SPOTLIGHT = [
  {
    targetId:    'sidebar-nav',
    title:       'Menú lateral',
    description: 'Toda la gestión de tu negocio se encuentra aquí. Desde este menú podés acceder a ventas, clientes, inventario, reportes, configuración y todos los módulos de FYP Studio.',
  },
  {
    targetId:    'add-widget-btn',
    title:       'Personalizá tu dashboard',
    description: 'Agregá los widgets que más utilizás y acomodalos como quieras. Cada negocio tiene su propio layout.',
  },
  {
    targetId:    'first-widget',
    title:       'Mové y redimensioná',
    description: 'Podés mover, ordenar y cambiar el tamaño de los widgets usando los botones S / M / L.',
  },
  {
    targetId:    'ai-chat-btn',
    title:       'Tu asistente inteligente',
    description: 'La IA puede ayudarte a analizar tu negocio y responder preguntas sobre tus datos en tiempo real.',
  },
]

const CLOSING = SPOTLIGHT.length + 1  // idx 5

async function persist(action: 'complete' | 'skip') {
  await fetch('/api/tour/complete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action }),
  }).catch(() => {})
}

function getRect(targetId: string): DOMRect | null {
  const el = document.querySelector(`[data-tooltip-id="${targetId}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  if (rect.bottom < 0 || rect.top > window.innerHeight ||
      rect.right  < 0 || rect.left > window.innerWidth) return null
  return rect
}

function calcPos(rect: DOMRect): {
  tooltip:  React.CSSProperties
  arrow:    React.CSSProperties
  arrowDir: 'up' | 'down' | 'left'
} {
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (rect.bottom + GAP + EST_H <= vh) {
    const left     = Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8))
    const arrowLeft = rect.left + rect.width / 2 - left - ARROW
    return {
      tooltip:  { top: rect.bottom + GAP, left, width: TOOLTIP_W },
      arrow:    { top: -ARROW, left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - ARROW * 3)) },
      arrowDir: 'up',
    }
  }
  if (rect.top - GAP - EST_H >= 0) {
    const left      = Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8))
    const arrowLeft = rect.left + rect.width / 2 - left - ARROW
    return {
      tooltip:  { top: rect.top - EST_H - GAP, left, width: TOOLTIP_W },
      arrow:    { bottom: -ARROW, left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - ARROW * 3)) },
      arrowDir: 'down',
    }
  }
  const rawTop  = rect.top + rect.height / 2 - EST_H / 2
  const top     = Math.max(8, Math.min(rawTop, vh - EST_H - 8))
  const left    = Math.max(8, Math.min(rect.right + GAP, vw - TOOLTIP_W - 8))
  const arrowTop = rect.top + rect.height / 2 - top - ARROW
  return {
    tooltip:  { top, left, width: TOOLTIP_W },
    arrow:    { top: Math.max(8, Math.min(arrowTop, EST_H - ARROW * 3)), left: -ARROW },
    arrowDir: 'left',
  }
}

function Arrow({ dir, style }: { dir: 'up' | 'down' | 'left'; style: React.CSSProperties }) {
  const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  if (dir === 'up')
    return <div style={{ ...base, ...style, borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid white` }} />
  if (dir === 'down')
    return <div style={{ ...base, ...style, borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderTop: `${ARROW}px solid white` }} />
  return <div style={{ ...base, ...style, borderTop: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid white` }} />
}

export default function DashboardOnboarding({ alreadySeen }: { alreadySeen: boolean }) {
  const router = useRouter()
  const [idx,        setIdx]        = useState(alreadySeen ? -1 : 0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    setTargetRect(null)
    if (idx < 1 || idx > SPOTLIGHT.length) return

    const rect = getRect(SPOTLIGHT[idx - 1].targetId)
    if (rect) {
      setTargetRect(rect)
    } else {
      setIdx(i => i + 1)
    }
  }, [idx])

  async function done(action: 'complete' | 'skip') {
    await persist(action)
    setIdx(-1)
  }

  async function goToSettings() {
    await persist('complete')
    setIdx(-1)
    router.push('/admin/settings')
  }

  if (idx === -1) return null

  // ── Bienvenida ──────────────────────────────────────────────────
  if (idx === 0) {
    return (
      <>
        <div className="fixed inset-0 z-[148] bg-black/50 backdrop-blur-sm" />
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <p className="text-4xl mb-4">👋</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
              Bienvenido a FYP Studio
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Te vamos a mostrar rápidamente las herramientas principales para que puedas
              empezar a gestionar tu negocio. Este recorrido dura menos de 30 segundos.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIdx(1)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                           font-semibold py-2.5 rounded-xl transition-colors"
              >
                Comenzar recorrido
              </button>
              <button
                onClick={() => done('skip')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
              >
                Saltar
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Cierre ──────────────────────────────────────────────────────
  if (idx === CLOSING) {
    return (
      <>
        <div className="fixed inset-0 z-[148] bg-black/50 backdrop-blur-sm" />
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <p className="text-4xl mb-4">🎉</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
              ¡Listo! Ya conocés las funciones principales de FYP Studio.
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Podés completar la configuración de tu negocio ahora o hacerlo más adelante.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={goToSettings}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                           font-semibold py-2.5 rounded-xl transition-colors"
              >
                Ir a Configuración
              </button>
              <button
                onClick={() => done('complete')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Spotlight ───────────────────────────────────────────────────
  const step = SPOTLIGHT[idx - 1]
  const pos  = targetRect ? calcPos(targetRect) : null

  return (
    <>
      {targetRect ? (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex:       148,
            top:          targetRect.top    - 4,
            left:         targetRect.left   - 4,
            width:        targetRect.width  + 8,
            height:       targetRect.height + 8,
            borderRadius: 12,
            boxShadow:    '0 0 0 4px rgba(99,102,241,0.55), 0 0 0 9999px rgba(0,0,0,0.42)',
          }}
        />
      ) : (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 148, background: 'rgba(0,0,0,0.42)' }}
        />
      )}

      {pos && (
        <div
          className="fixed z-[150] bg-white rounded-2xl shadow-2xl p-4"
          style={{ ...pos.tooltip, position: 'fixed' }}
        >
          <Arrow dir={pos.arrowDir} style={pos.arrow} />

          <button
            onClick={() => done('skip')}
            className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Cerrar"
          >
            <X size={13} />
          </button>

          <p className="text-[10px] font-bold text-indigo-500 mb-1.5 uppercase tracking-wider">
            {idx} de {SPOTLIGHT.length}
          </p>

          <h4 className="text-sm font-bold text-gray-900 mb-1 pr-4 leading-tight">
            {step.title}
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={() => done('skip')}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Saltar
            </button>
            <div className="flex items-center gap-1.5">
              {idx > 1 && (
                <button
                  onClick={() => setIdx(idx - 1)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700
                             px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <ChevronLeft size={11} /> Anterior
                </button>
              )}
              <button
                onClick={() => setIdx(idx + 1)}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700
                           text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Entendido <ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
