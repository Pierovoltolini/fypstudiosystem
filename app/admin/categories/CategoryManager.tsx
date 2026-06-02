// app/admin/categories/CategoryManager.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { slugify, cn } from '@/lib/utils'
import { Plus, Tag, Loader2, Eye, EyeOff, GripVertical } from 'lucide-react'
import type { Category } from '@/types'

export default function CategoryManager({
  businessId,
  initialCategories,
  label = 'categoría',
}: {
  businessId: string
  initialCategories: Category[]
  label?: string
}) {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)

    const slug = slugify(newName) + '-' + Math.random().toString(36).slice(2, 5)
    const { data, error: err } = await supabase
      .from('categories')
      .insert({
        business_id: businessId,
        name: newName.trim(),
        slug,
        sort_order: categories.length,
        active: true,
      })
      .select('*')
      .single()

    if (err) {
      setError(err.message)
    } else if (data) {
      setCategories(prev => [...prev, data as Category])
      setNewName('')
    }
    setCreating(false)
  }

  async function toggleActive(cat: Category) {
    setLoadingId(cat.id)
    const { data } = await supabase
      .from('categories')
      .update({ active: !cat.active })
      .eq('id', cat.id)
      .select('*')
      .single()

    if (data) {
      setCategories(prev => prev.map(c => c.id === cat.id ? data as Category : c))
    }
    setLoadingId(null)
  }

  const active = categories.filter(c => c.active)
  const inactive = categories.filter(c => !c.active)

  return (
    <div className="space-y-5">
      {/* Formulario nueva categoría */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Nueva {label}
        </p>
        <form onSubmit={createCategory} className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={`Nombre de la ${label}...`}
            className="input-base flex-1"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium
                       text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0
                       active:scale-[0.98]"
          >
            {creating
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={14} />
            }
            Crear
          </button>
        </form>
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Lista de categorías */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-14 text-center">
          <Tag size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Sin {label}s todavía</p>
          <p className="text-xs text-gray-300 mt-1">Creá {label}s para organizar tu catálogo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Activas */}
          {active.length > 0 && (
            <div>
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-medium text-gray-500">
                  Activas ({active.length})
                </p>
              </div>
              {active.map((cat, i) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  loading={loadingId === cat.id}
                  onToggle={() => toggleActive(cat)}
                  isLast={i === active.length - 1 && inactive.length === 0}
                />
              ))}
            </div>
          )}

          {/* Inactivas */}
          {inactive.length > 0 && (
            <div>
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-medium text-gray-400">
                  Inactivas ({inactive.length})
                </p>
              </div>
              {inactive.map((cat, i) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  loading={loadingId === cat.id}
                  onToggle={() => toggleActive(cat)}
                  isLast={i === inactive.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  cat,
  loading,
  onToggle,
  isLast,
}: {
  cat: Category
  loading: boolean
  onToggle: () => void
  isLast: boolean
}) {
  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors',
      !isLast && 'border-b border-gray-50'
    )}>
      <GripVertical size={14} className="text-gray-200 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          cat.active ? 'text-gray-900' : 'text-gray-400'
        )}>
          {cat.name}
        </p>
        <p className="text-xs text-gray-400 font-mono">/{cat.slug}</p>
      </div>

      <span className={cn(
        'badge',
        cat.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
      )}>
        {cat.active ? 'Activa' : 'Inactiva'}
      </span>

      <button
        onClick={onToggle}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                   hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-40"
        title={cat.active ? 'Desactivar' : 'Activar'}
      >
        {loading
          ? <Loader2 size={14} className="animate-spin" />
          : cat.active
            ? <EyeOff size={14} />
            : <Eye size={14} />
        }
      </button>
    </div>
  )
}
