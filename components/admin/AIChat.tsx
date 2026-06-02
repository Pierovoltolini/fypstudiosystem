'use client'
// AIChat.tsx — chat de IA reutilizado por sidebar y botón flotante
// Props: open/onClose para controlar desde afuera
import { useState, useRef, useEffect, useCallback } from 'react'
import { useVertical } from '@/lib/vertical-context'
import { AI_LIMITS, PLAN_DISPLAY } from '@/lib/ai-limits'
import { Sparkles, Send, X, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

const SUGGESTIONS = [
  '¿Cuánto vendí esta semana?',
  '¿Qué productos se venden más?',
  '¿Cuánto gasté en costos este mes?',
  '¿Hay alertas de stock?',
  'Dame un resumen del negocio',
]

interface Props {
  open:    boolean
  onClose: () => void
}

export default function AIChat({ open, onClose }: Props) {
  const { business } = useVertical()
  const plan = business.plan as Plan

  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; unlimited: boolean } | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = useCallback(async (text: string) => {
    const userMsg = text.trim()
    if (!userMsg || loading) return
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Build history (exclude errors, last 6 turns)
      const history = newMessages
        .filter(m => m.role !== 'error')
        .slice(-6)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: history.slice(0, -1) }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgradePrompt) {
          setMessages(prev => [...prev, {
            role: 'error',
            content: data.error ?? 'Límite de IA alcanzado',
          }])
        } else {
          setMessages(prev => [...prev, { role: 'error', content: data.error ?? 'Error desconocido' }])
        }
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data._usage) setUsageInfo(data._usage)
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Error de conexión. Intentá de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearChat = () => { setMessages([]); setUsageInfo(null) }

  const limit     = AI_LIMITS[plan]
  const unlimited = limit === Infinity
  const atLimit   = !unlimited && (usageInfo?.used ?? 0) >= limit

  if (!open) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-blue-100 flex items-center justify-center">
            <Sparkles size={13} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Asistente IA</p>
            <p className="text-[10px] text-gray-400">
              Plan {PLAN_DISPLAY[plan]}
              {!unlimited && usageInfo && ` · ${usageInfo.used}/${limit} este mes`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearChat}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400
                         hover:bg-gray-100 hover:text-gray-600 transition-all"
              title="Limpiar chat">
              <RotateCcw size={13} />
            </button>
          )}
          <button onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400
                       hover:bg-gray-100 hover:text-gray-600 transition-all">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={12} className="text-blue-600" />
              </div>
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 max-w-[80%]">
                ¡Hola! Soy tu asistente. Puedo ayudarte a entender las ventas, costos, inventario y más de tu negocio.
              </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-1.5 pl-10">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="w-full text-left text-xs rounded-xl border border-gray-200 px-3 py-2
                             text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            {msg.role !== 'user' && (
              <div className={cn(
                'h-7 w-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                msg.role === 'error' ? 'bg-red-100' : 'bg-blue-100'
              )}>
                {msg.role === 'error'
                  ? <AlertCircle size={12} className="text-red-500" />
                  : <Sparkles size={12} className="text-blue-600" />
                }
              </div>
            )}
            <div className={cn(
              'px-4 py-3 text-sm rounded-2xl max-w-[80%] leading-relaxed',
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : msg.role === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-sm'
                  : 'bg-gray-50 text-gray-700 rounded-tl-sm'
            )}>
              {msg.role === 'error' && msg.content.includes('ímite') ? (
                <div>
                  <p className="font-semibold mb-1">Límite de IA alcanzado</p>
                  <p className="text-xs">Usaste tus {limit} consultas del mes en el plan {PLAN_DISPLAY[plan]}. Actualizá tu plan para seguir usando el asistente.</p>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Loader2 size={12} className="text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
        {atLimit ? (
          <div className="text-center py-2">
            <p className="text-xs text-red-500 font-medium">Límite mensual alcanzado</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Actualizá tu plan para seguir chateando</p>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntame sobre tu negocio... (Enter para enviar)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm
                         text-gray-900 placeholder:text-gray-400 outline-none
                         focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                         disabled:opacity-50 transition-all"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600
                         text-white hover:bg-blue-700 disabled:opacity-40 transition-all shrink-0">
              <Send size={15} />
            </button>
          </div>
        )}
        <p className="text-[9px] text-gray-300 text-center mt-1.5">
          Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
