'use client'
// Wizard para crear un módulo personalizado con ayuda de IA
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import {
  Sparkles, ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Check, Zap,
} from 'lucide-react'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FieldDef, FieldType, CustomModule } from '@/types'

type Step = 'describe' | 'review' | 'saving'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',    label: 'Texto' },
  { value: 'number',  label: 'Número' },
  { value: 'date',    label: 'Fecha' },
  { value: 'select',  label: 'Lista' },
  { value: 'boolean', label: 'Sí/No' },
]

export default function NewCustomModulePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { businessId, business } = useVertical()
  const plan = (business.plan ?? 'basic') as import('@/types').Plan

  const [step,        setStep]        = useState<Step>('describe')
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // Module being built/edited
  const [name,   setName]   = useState('')
  const [icon,   setIcon]   = useState('LayoutGrid')
  const [desc,   setDesc]   = useState('')
  const [fields, setFields] = useState<FieldDef[]>([])

  async function generateSuggestion() {
    if (!description.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/custom-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error generando sugerencia')
      const s = data.suggestion
      setName(s.name ?? '')
      setIcon(s.icon ?? 'LayoutGrid')
      setDesc(s.description ?? '')
      setFields(s.fields ?? [])
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function saveModule() {
    if (!name.trim() || fields.length < 2) return
    setStep('saving')
    setError(null)

    try {
      // Verificar límite de módulos según plan
      const moduleLimit = PLAN_LIMITS[plan].custom_modules
      const { count } = await supabase
        .from('custom_modules')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('active', true)

      const currentCount = count ?? 0

      if (moduleLimit !== Infinity && currentCount >= moduleLimit) {
        setError(`Tu plan ${plan === 'basic' ? 'gratuito' : plan} permite hasta ${moduleLimit} módulo${moduleLimit === 1 ? '' : 's'} activo${moduleLimit === 1 ? '' : 's'}. Actualizá para crear más.`)
        setStep('review')
        return
      }

      const { data, error: insertError } = await supabase
        .from('custom_modules')
        .insert({
          business_id: businessId,
          name:        name.trim(),
          icon,
          description: desc.trim() || null,
          fields,
          is_paid:     false,
          active:      true,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      router.push(`/admin/custom-modules/${data.id}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      setStep('review')
    }
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  }

  function removeField(i: number) {
    setFields(prev => prev.filter((_, idx) => idx !== i))
  }

  function addField() {
    setFields(prev => [...prev, { key: `campo_${prev.length + 1}`, label: '', type: 'text', required: false }])
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft size={14} /> Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo módulo personalizado</h1>
        <p className="text-sm text-gray-500 mt-1">La IA te ayuda a definir la estructura en segundos.</p>
      </div>

      {/* Step 1: Describe */}
      {step === 'describe' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Sparkles size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Describí qué querés trackear</p>
              <p className="text-xs text-gray-400">La IA va a sugerir los campos y la estructura</p>
            </div>
          </div>

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={`Ej: "Quiero registrar los desperdicios de ingredientes en mi cocina: qué insumo se descartó, cuánto y por qué motivo"`}
            rows={4}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900
                       placeholder:text-gray-300 outline-none focus:border-blue-400
                       focus:ring-2 focus:ring-blue-100 resize-none transition-all"
          />

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button onClick={generateSuggestion} disabled={loading || description.trim().length < 5}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5
                       text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                       disabled:opacity-40 transition-all active:scale-[0.98]">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Generando estructura...</> :
              <><Sparkles size={15} /> Generar estructura con IA <ArrowRight size={14} /></>}
          </button>
        </div>
      )}

      {/* Step 2: Review & edit */}
      {(step === 'review' || step === 'saving') && (
        <div className="space-y-4">
          {/* Module metadata */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <p className="text-sm font-semibold text-gray-900">Información del módulo</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="field-label">Nombre del módulo</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="input-base" placeholder="Ej: Control de desperdicios" />
              </div>
              <div>
                <label className="field-label">Descripción breve</label>
                <input value={desc} onChange={e => setDesc(e.target.value)}
                  className="input-base" placeholder="Opcional" />
              </div>
              <div>
                <label className="field-label">Ícono</label>
                <input value={icon} onChange={e => setIcon(e.target.value)}
                  className="input-base" placeholder="LayoutGrid" />
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Campos ({fields.length})</p>
              <button onClick={addField}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700
                           font-medium transition-colors">
                <Plus size={13} /> Agregar campo
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Nombre visible
                      </label>
                      <input value={f.label} onChange={e => updateField(i, { label: e.target.value })}
                        className="input-base mt-1" placeholder="Ej: Insumo descartado" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Tipo de dato
                      </label>
                      <select value={f.type}
                        onChange={e => updateField(i, { type: e.target.value as FieldType })}
                        className="input-base mt-1">
                        {FIELD_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {f.type === 'select' && (
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Opciones (una por línea)
                      </label>
                      <textarea
                        value={(f.options ?? []).join('\n')}
                        onChange={e => updateField(i, { options: e.target.value.split('\n').filter(Boolean) })}
                        rows={3} className="input-base mt-1 resize-none"
                        placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={f.required}
                        onChange={e => updateField(i, { required: e.target.checked })}
                        className="rounded" />
                      Requerido
                    </label>
                    <button onClick={() => removeField(i)}
                      className="text-gray-400 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Agregá al menos 2 campos para el módulo.
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('describe')}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3
                         text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
              <ArrowLeft size={14} /> Editar descripción
            </button>
            <button onClick={saveModule}
              disabled={step === 'saving' || !name.trim() || fields.length < 2}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3
                         text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700
                         disabled:opacity-40 transition-all active:scale-[0.98]">
              {step === 'saving'
                ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                : <><Check size={15} /> Crear módulo</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
