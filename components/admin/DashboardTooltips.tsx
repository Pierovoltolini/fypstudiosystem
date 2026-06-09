'use client'
import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'fyp_dashboard_tooltips_seen'
const ARROW = 8
const TOOLTIP_W = 276

interface TooltipDef {
  targetId:    string
  title:       string
  description: string
  // 'center' = card centrado en pantalla, spotlight sobre el target (sin flecha)
  position:    'bottom' | 'top-left' | 'right' | 'center'
}

const TOOLTIPS: TooltipDef[] = [
  {
    targetId:    'add-widget-btn',
    title:       'Personalizá tu dashboard',
    description: 'Agregá los widgets que más uses y acomodalos como quieras. Cada negocio tiene su propio layout.',
    position:    'bottom',
  },
  {
    targetId:    'first-widget',
    title:       'Mové y redimensioná',
    description: 'Arrastrá los widgets con el ícono ⠿ para reordenarlos. Usá S / M / L para cambiar el tamaño.',
    position:    'bottom',
  },
  {
    targetId:    'ai-chat-btn',
    title:       'Tu asistente inteligente',
    description: 'Preguntale cualquier cosa sobre tu negocio. ¿Cuánto vendí hoy? ¿Qué stock me falta? Responde con tus datos reales.',
    position:    'top-left',
  },
  {
    targetId:    'settings-nav',
    title:       'Configuración del negocio',
    description: 'Desde acá configurás los datos de tu negocio, el equipo, los horarios y tus planes.',
    // 'center' evita problemas de z-index/stacking con el sidebar
    position:    'center',
  },
]

interface Pos {
  tooltip:  React.CSSProperties
  arrow:    React.CSSProperties
  arrowDir: 'up' | 'down' | 'left' | 'none'
}

function calcPos(rect: DOMRect, def: TooltipDef): Pos {
  const vw  = window.innerWidth
  const vh  = window.innerHeight
  const GAP = 12
  const EST_H = 148

  if (def.position === 'center') {
    return {
      tooltip:  {
        top:  Math.max(8, vh / 2 - EST_H / 2),
        left: Math.max(8, vw / 2 - TOOLTIP_W / 2),
        width: TOOLTIP_W,
      },
      arrow:    {},
      arrowDir: 'none',
    }
  }

  if (def.position === 'bottom') {
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8))
    const arrowLeft = rect.left + rect.width / 2 - left - ARROW
    return {
      tooltip:  { top: rect.bottom + GAP, left, width: TOOLTIP_W },
      arrow:    { top: -ARROW, left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - ARROW * 3)) },
      arrowDir: 'up',
    }
  }

  if (def.position === 'top-left') {
    const left = Math.max(8, rect.right - TOOLTIP_W)
    const arrowLeft = rect.left + rect.width / 2 - left - ARROW
    return {
      tooltip:  { top: rect.top - EST_H - GAP, left, width: TOOLTIP_W },
      arrow:    { bottom: -ARROW, left: Math.max(8, Math.min(arrowLeft, TOOLTIP_W - ARROW * 3)) },
      arrowDir: 'down',
    }
  }

  // right — clamp both axes
  const rawTop   = rect.top + rect.height / 2 - EST_H / 2
  const top      = Math.max(8, Math.min(rawTop, vh - EST_H - 8))
  const left     = Math.max(8, Math.min(rect.right + GAP, vw - TOOLTIP_W - 8))
  const arrowTop = rect.top + rect.height / 2 - top - ARROW
  return {
    tooltip:  { top, left, width: TOOLTIP_W },
    arrow:    { top: Math.max(8, Math.min(arrowTop, EST_H - ARROW * 3)), left: -ARROW },
    arrowDir: 'left',
  }
}

function ArrowEl({ dir, style }: { dir: 'up' | 'down' | 'left' | 'none'; style: React.CSSProperties }) {
  if (dir === 'none') return null
  const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0 }
  if (dir === 'up')   return <div style={{ ...base, ...style, borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid white` }} />
  if (dir === 'down') return <div style={{ ...base, ...style, borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderTop: `${ARROW}px solid white` }} />
  return <div style={{ ...base, ...style, borderTop: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid white` }} />
}

export default function DashboardTooltips() {
  const [idx,        setIdx]        = useState(-1)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return
    const t = setTimeout(() => advance(0), 500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function advance(index: number) {
    if (index >= TOOLTIPS.length) { finish(); return }
    const def = TOOLTIPS[index]

    if (def.position === 'center') {
      setTargetRect(null)
      setIdx(index)
      return
    }

    const el = document.querySelector(`[data-tooltip-id="${def.targetId}"]`)
    if (!el) { advance(index + 1); return }
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) { advance(index + 1); return }
    if (rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right  < 0 || rect.left > window.innerWidth) {
      advance(index + 1); return
    }
    setTargetRect(rect)
    setIdx(index)
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1')
    setIdx(-1)
    setTargetRect(null)
  }

  if (idx === -1) return null

  const def = TOOLTIPS[idx]
  // targetRect puede ser null para posición 'center' — calcPos lo maneja
  const pos = calcPos(targetRect ?? new DOMRect(), def)

  return (
    <>
      {/* Overlay oscuro siempre presente; spotlight solo cuando hay elemento */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 148,
            top:    targetRect.top    - 4,
            left:   targetRect.left   - 4,
            width:  targetRect.width  + 8,
            height: targetRect.height + 8,
            borderRadius: 12,
            boxShadow: '0 0 0 4px rgba(99,102,241,0.55), 0 0 0 9999px rgba(0,0,0,0.42)',
          }}
        />
      ) : (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 148, background: 'rgba(0,0,0,0.42)' }} />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[150] bg-white rounded-2xl shadow-2xl p-4"
        style={{ ...pos.tooltip, position: 'fixed' }}
      >
        <ArrowEl dir={pos.arrowDir} style={pos.arrow} />

        {/* Close */}
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Cerrar"
        >
          <X size={13} />
        </button>

        {/* Step indicator */}
        <p className="text-[10px] font-bold text-indigo-500 mb-1.5 uppercase tracking-wider">
          {idx + 1} de {TOOLTIPS.length}
        </p>

        {/* Content */}
        <h4 className="text-sm font-bold text-gray-900 mb-1 pr-4 leading-tight">
          {def.title}
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          {def.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Saltar todo
          </button>
          <button
            onClick={() => advance(idx + 1)}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700
                       text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Entendido <ChevronRight size={11} />
          </button>
        </div>
      </div>
    </>
  )
}
