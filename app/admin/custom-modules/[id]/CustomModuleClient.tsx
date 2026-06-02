'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import { Plus, Trash2, X, Check, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { CustomModule, CustomModuleEntry, FieldDef } from '@/types'

interface Props {
  module:         CustomModule
  initialEntries: CustomModuleEntry[]
}

export default function CustomModuleClient({ module, initialEntries }: Props) {
  const supabase = createClient()
  const { businessId, userId } = useVertical()

  const [entries,    setEntries]    = useState<CustomModuleEntry[]>(initialEntries)
  const [showForm,   setShowForm]   = useState(false)
  const [formData,   setFormData]   = useState<Record<string, unknown>>({})
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const fields: FieldDef[] = module.fields as FieldDef[]

  function setValue(key: string, value: unknown) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function saveEntry() {
    // Validate required fields
    const missing = fields.filter(f => f.required && !formData[f.key])
    if (missing.length > 0) {
      setError(`Completá los campos requeridos: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    setSaving(true); setError(null)
    const { data, error: insertError } = await supabase
      .from('custom_module_entries')
      .insert({
        module_id:   module.id,
        business_id: businessId,
        data:        formData,
        created_by:  userId,
      })
      .select('*')
      .single()

    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setEntries(prev => [data as CustomModuleEntry, ...prev])
    setFormData({})
    setShowForm(false)
  }

  async function deleteEntry(id: string) {
    setDeletingId(id)
    await supabase.from('custom_module_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{module.name}</h1>
          {module.description && (
            <p className="text-sm text-gray-500 mt-0.5">{module.description}</p>
          )}
        </div>
        <button onClick={() => { setShowForm(true); setFormData({}) }}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5
                     text-sm font-semibold text-white hover:bg-gray-700 transition-all">
          <Plus size={14} /> Nueva entrada
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Nueva entrada</p>
            <button onClick={() => { setShowForm(false); setFormData({}) }}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.type === 'boolean' ? 'flex items-center gap-2' : ''}>
                <label className={f.type === 'boolean' ? 'text-sm text-gray-700' : 'field-label'}>
                  {f.label}
                  {f.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {f.type === 'boolean' ? (
                  <input type="checkbox"
                    checked={!!formData[f.key]}
                    onChange={e => setValue(f.key, e.target.checked)}
                    className="rounded" />
                ) : f.type === 'select' ? (
                  <select value={(formData[f.key] as string) ?? ''}
                    onChange={e => setValue(f.key, e.target.value)}
                    className="input-base mt-1">
                    <option value="">Seleccioná...</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'date' ? (
                  <input type="date"
                    value={(formData[f.key] as string) ?? ''}
                    onChange={e => setValue(f.key, e.target.value)}
                    className="input-base mt-1" />
                ) : f.type === 'number' ? (
                  <input type="number"
                    value={(formData[f.key] as string) ?? ''}
                    onChange={e => setValue(f.key, e.target.value ? Number(e.target.value) : '')}
                    className="input-base mt-1" placeholder="0" />
                ) : (
                  <input type="text"
                    value={(formData[f.key] as string) ?? ''}
                    onChange={e => setValue(f.key, e.target.value)}
                    className="input-base mt-1" />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowForm(false); setFormData({}) }}
              className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={saveEntry} disabled={saving}
              className="btn-brand flex-1 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Entries table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Sin entradas todavía.</p>
            <button onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Agregar primera entrada →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {fields.map(f => (
                    <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                    {fields.map(f => {
                      const val = (entry.data as Record<string, unknown>)[f.key]
                      return (
                        <td key={f.key} className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                          {f.type === 'boolean'
                            ? (val ? '✓' : '—')
                            : val != null ? String(val) : '—'
                          }
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteEntry(entry.id)}
                        disabled={deletingId === entry.id}
                        className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50">
                        {deletingId === entry.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
