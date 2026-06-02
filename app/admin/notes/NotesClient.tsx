'use client'
import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Trash2, Tag, BookOpen, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────
interface Note {
  id:         string
  title:      string
  content:    string
  tags:       string[]
  created_at: string
  updated_at: string
}

const PRESET_TAGS = ['importante', 'pendiente', 'idea', 'tarea']

const TAG_COLORS: Record<string, string> = {
  importante: 'bg-red-100 text-red-700 border-red-200',
  pendiente:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  idea:       'bg-blue-100 text-blue-700 border-blue-200',
  tarea:      'bg-purple-100 text-purple-700 border-purple-200',
}

function tagStyle(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600 border-gray-200'
}

function dateLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)        return 'Hace un momento'
  if (diff < 3600)      return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400)     return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `Hace ${Math.floor(diff / 86400)} días`
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })
}

// ── Modal de edición / creación ───────────────────────────────
function NoteModal({
  note, onClose, onSave,
}: {
  note: Partial<Note> | null
  onClose: () => void
  onSave:  (data: { title: string; content: string; tags: string[] }) => Promise<void>
}) {
  const isNew = !note?.id
  const [title,   setTitle]   = useState(note?.title   ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [tags,    setTags]    = useState<string[]>(note?.tags ?? [])
  const [custom,  setCustom]  = useState('')
  const [saving,  setSaving]  = useState(false)

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function addCustomTag() {
    const t = custom.trim().toLowerCase()
    if (!t || tags.includes(t)) { setCustom(''); return }
    setTags(prev => [...prev, t]); setCustom('')
  }

  async function handleSave() {
    if (!title.trim() && !content.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), content: content.trim(), tags })
    setSaving(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 inset-x-4 top-[5vh] sm:top-[10vh]
                      sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-lg
                      animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <p className="text-sm font-semibold text-gray-900">
              {isNew ? 'Nueva nota' : 'Editar nota'}
            </p>
            <button onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg
                         text-gray-400 hover:bg-gray-100 transition-all">
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título de la nota"
              className="w-full text-lg font-semibold text-gray-900 outline-none
                         placeholder:text-gray-300 bg-transparent"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escribí tu nota aquí..."
              rows={8}
              className="w-full text-sm text-gray-700 placeholder:text-gray-300
                         outline-none resize-none bg-transparent leading-relaxed"
              style={{ fontFamily: 'inherit' }}
              autoFocus={!isNew}
            />

            {/* Tags */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                <Tag size={11} /> Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_TAGS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                      tags.includes(t)
                        ? tagStyle(t) + ' ring-1 ring-offset-1 ring-current'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                    )}>
                    {t}
                  </button>
                ))}
                {/* Custom tags */}
                {tags.filter(t => !PRESET_TAGS.includes(t)).map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    className="text-xs px-2.5 py-1 rounded-full border font-medium
                               bg-gray-100 text-gray-600 border-gray-200 ring-1 ring-offset-1 ring-gray-400">
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                  placeholder="Etiqueta personalizada..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5
                             outline-none focus:border-blue-400 transition-colors"
                />
                <button onClick={addCustomTag}
                  disabled={!custom.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600
                             hover:bg-gray-200 disabled:opacity-40 transition-all">
                  Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm
                         font-medium text-gray-600 hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button onClick={handleSave}
              disabled={saving || (!title.trim() && !content.trim())}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5
                         text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700
                         disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Guardando...' : isNew ? 'Crear nota' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────
interface Props {
  businessId:   string
  userId:       string
  initialNotes: Note[]
}

export default function NotesClient({ businessId, userId, initialNotes }: Props) {
  const supabase = createClient()

  const [notes,       setNotes]       = useState<Note[]>(initialNotes)
  const [search,      setSearch]      = useState('')
  const [tagFilter,   setTagFilter]   = useState<string | null>(null)
  const [editing,     setEditing]     = useState<Partial<Note> | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  // All tags present in notes (deduplicated)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => set.add(t)))
    return Array.from(set)
  }, [notes])

  // Client-side filter
  const filtered = useMemo(() => {
    let list = notes
    if (tagFilter) list = list.filter(n => n.tags.includes(tagFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    }
    return list
  }, [notes, search, tagFilter])

  const handleSave = useCallback(async (data: { title: string; content: string; tags: string[] }) => {
    if (editing?.id) {
      // Update
      const { data: updated } = await supabase
        .from('notes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .eq('user_id', userId)
        .select('id, title, content, tags, created_at, updated_at')
        .single()
      if (updated) {
        setNotes(prev => prev.map(n => n.id === updated.id ? updated as Note : n)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      }
    } else {
      // Create
      const { data: created } = await supabase
        .from('notes')
        .insert({ business_id: businessId, user_id: userId, ...data })
        .select('id, title, content, tags, created_at, updated_at')
        .single()
      if (created) setNotes(prev => [created as Note, ...prev])
    }
  }, [editing, businessId, userId])

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('notes').delete().eq('id', id).eq('user_id', userId)
    setNotes(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <BookOpen size={16} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notas</h1>
            <p className="text-xs text-gray-400">{notes.length} nota{notes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5
                     text-sm font-semibold text-white hover:bg-gray-700 transition-all">
          <Plus size={14} /> Nueva nota
        </button>
      </div>

      {/* Search + tag filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                       outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                       transition-all bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTagFilter(null)}
            className={cn(
              'text-xs px-3 py-2.5 rounded-full border font-medium transition-all min-h-[44px]',
              !tagFilter
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}>
            Todas
          </button>
          {allTags.map(t => (
            <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className={cn(
                'text-xs px-3 py-2.5 rounded-full border font-medium transition-all min-h-[44px]',
                tagFilter === t
                  ? tagStyle(t) + ' ring-1 ring-offset-1 ring-current'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              )}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          {notes.length === 0 ? (
            <>
              <BookOpen size={24} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium mb-1">No tenés notas todavía</p>
              <p className="text-xs text-gray-400 mb-5">Creá tu primera nota para empezar</p>
              <button onClick={() => setEditing({})}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                + Crear primera nota
              </button>
            </>
          ) : (
            <>
              <Search size={20} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Sin resultados para tu búsqueda</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(note => (
            <div key={note.id}
              onClick={() => setEditing(note)}
              className="group bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer
                         hover:border-gray-200 hover:shadow-sm transition-all relative">

              {/* Delete button — siempre visible en touch (sm:opacity-0 group-hover:opacity-100) */}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                disabled={deletingId === note.id}
                className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100
                           h-8 w-8 flex items-center justify-center rounded-lg
                           text-gray-400 hover:text-red-500 hover:bg-red-50
                           transition-all disabled:opacity-50">
                {deletingId === note.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </button>

              {/* Title */}
              {note.title && (
                <p className="text-sm font-semibold text-gray-900 mb-1.5 pr-6 leading-tight line-clamp-1">
                  {note.title}
                </p>
              )}

              {/* Content preview */}
              {note.content && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3">
                  {note.content}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1 flex-wrap">
                  {note.tags.slice(0, 2).map(t => (
                    <span key={t}
                      className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full border', tagStyle(t))}>
                      {t}
                    </span>
                  ))}
                  {note.tags.length > 2 && (
                    <span className="text-xs text-gray-400">+{note.tags.length - 2}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-2">
                  {dateLabel(note.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note editor modal */}
      {editing !== null && (
        <NoteModal
          note={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
