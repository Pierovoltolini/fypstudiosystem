'use client'
import { useState } from 'react'
import { GripVertical, X, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSS } from '@dnd-kit/utilities'
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import type { AnimateLayoutChanges } from '@dnd-kit/sortable'
import type { WidgetSize } from '@/lib/dashboard-widgets'

const SIZE_LABELS: Record<WidgetSize, string> = { small: 'S', medium: 'M', large: 'L' }

const COL_SPAN: Record<WidgetSize, string> = {
  small:  'col-span-1',
  medium: 'col-span-1 md:col-span-2',
  large:  'col-span-1 md:col-span-2 lg:col-span-3',
}

// Anima el reacomodo de widgets vecinos al soltar, no solo durante el drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.isSorting || args.wasDragging ? defaultAnimateLayoutChanges(args) : true

interface Props {
  id:             string
  currentSize:    WidgetSize
  availableSizes: WidgetSize[]
  onResize:       (size: WidgetSize) => void
  onRemove:       () => void
  children:       React.ReactNode
  'data-tooltip-id'?: string
}

export default function DashboardWidgetWrapper({
  id, currentSize, availableSizes, onResize, onRemove, children,
  'data-tooltip-id': tooltipId,
}: Props) {
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, animateLayoutChanges })

  return (
    <div
      ref={setNodeRef}
      data-widget-id={id}
      data-tooltip-id={tooltipId}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group select-none flex flex-col h-[260px]',
        COL_SPAN[currentSize],
        isDragging && 'opacity-0',
      )}
      {...attributes}
    >
      {/* Barra de controles — shrink-0 para que no se comprima */}
      <div className={cn(
        'flex items-center justify-end gap-1 px-2 h-7 shrink-0 transition-opacity duration-150',
        sizeMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>

        {/* Selector de tamaño */}
        {availableSizes.length > 1 && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setSizeMenuOpen(o => !o) }}
              className="flex h-6 items-center gap-1 px-1.5 rounded-lg
                         bg-white/80 backdrop-blur-sm border border-gray-200
                         text-gray-400 hover:text-gray-600 hover:bg-white shadow-sm transition-all"
              title="Cambiar tamaño"
            >
              <Maximize2 size={10} />
              <span className="text-[10px] font-bold leading-none">{SIZE_LABELS[currentSize]}</span>
            </button>

            {sizeMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSizeMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-30 flex gap-1
                                bg-white rounded-xl border border-gray-200 shadow-lg p-1.5">
                  {availableSizes.map(s => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); onResize(s); setSizeMenuOpen(false) }}
                      className={cn(
                        'w-8 py-1 rounded-lg text-[11px] font-bold transition-all',
                        s === currentSize
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-500 hover:bg-gray-100',
                      )}
                    >
                      {SIZE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Drag handle */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          className="flex h-6 w-6 cursor-grab active:cursor-grabbing items-center justify-center
                     rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200
                     text-gray-400 hover:text-gray-600 hover:bg-white shadow-sm transition-all
                     touch-none"
          title="Arrastrá para reordenar"
        >
          <GripVertical size={12} />
        </div>

        {/* Quitar widget */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="flex h-6 w-6 items-center justify-center rounded-lg
                     bg-white/80 backdrop-blur-sm border border-gray-200
                     text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50
                     shadow-sm transition-all"
          title="Quitar widget"
        >
          <X size={11} />
        </button>
      </div>

      {/* Contenido del widget — flex-1 llena los 232px restantes, [&>*]:h-full estira el card */}
      <div className="flex-1 min-h-0 overflow-hidden [&>*]:h-full">
        {children}
      </div>
    </div>
  )
}
