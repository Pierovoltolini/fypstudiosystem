'use client'
// QuickNotesWidget — carrusel horizontal de post-its
// Escribe en la tabla `notes` para que las notas aparezcan en /admin/notes.
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import { Plus, X, Check, Loader2 } from 'lucide-react'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface Note {
  id:      string
  content: string
}

// ── NoteCard ─────────────────────────────────────────────────
function NoteCard({
  note,
  isNew,
  onDelete,
}: {
  note:     Note
  isNew:    boolean
  onDelete: (id: string) => void
}) {
  const supabase = createClient()

  const [content,   setContent]   = useState(note.content)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [entered,   setEntered]   = useState(!isNew)

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef(note.content)

  useEffect(() => {
    if (!isNew) return
    const t = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [isNew])

  const save = useCallback(async (text: string) => {
    if (text === lastSaved.current) return
    setSaveState('saving')
    const { error } = await supabase
      .from('notes')
      .update({ content: text, updated_at: new Date().toISOString() })
      .eq('id', note.id)
    if (error) { setSaveState('error'); return }
    lastSaved.current = text
    setSaveState('saved')
    if (savedRef.current) clearTimeout(savedRef.current)
    savedRef.current = setTimeout(() => setSaveState('idle'), 2000)
  }, [note.id])

  const handleChange = (val: string) => {
    setContent(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(val), 800)
  }

  const handleDelete = async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await supabase.from('notes').delete().eq('id', note.id)
    onDelete(note.id)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (savedRef.current) clearTimeout(savedRef.current)
  }, [])

  return (
    <div
      className={[
        'group relative flex-shrink-0 w-[200px] flex flex-col rounded-xl shadow-sm',
        'bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900/50',
        'hover:-translate-y-1.5 hover:shadow-md',
        'transition-all duration-200 ease-out',
        isNew
          ? entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          : 'opacity-100 scale-100',
      ].join(' ')}
    >
      {/* Botón × — solo visible en hover */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 h-5 w-5 flex items-center justify-center
                   rounded-full bg-red-100/80 text-red-400
                   hover:bg-red-200 hover:text-red-600
                   opacity-0 group-hover:opacity-100
                   transition-opacity duration-150 z-10"
        title="Eliminar nota"
      >
        <X size={10} />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
        <span className="text-[10px] font-semibold text-amber-600 leading-none">📝 Nota</span>
        <span className="h-3.5 flex items-center">
          {saveState === 'saving' && <Loader2 size={8} className="animate-spin text-amber-400" />}
          {saveState === 'saved'  && <Check   size={8} className="text-green-500" />}
          {saveState === 'error'  && <span className="text-[9px] text-red-400 font-semibold">!</span>}
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        placeholder="Escribí algo..."
        className="flex-1 w-full px-3 pb-3 text-xs text-amber-900 placeholder:text-amber-300
                   dark:text-yellow-200 dark:placeholder:text-yellow-800
                   bg-transparent resize-none outline-none leading-relaxed min-h-[100px]"
        style={{ fontFamily: 'inherit' }}
      />
    </div>
  )
}

// ── QuickNotesWidget ──────────────────────────────────────────
export default function QuickNotesWidget() {
  const { businessId, userId } = useVertical()
  const supabase = createClient()

  const [notes,  setNotes]  = useState<Note[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newId,  setNewId]  = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('notes')
      .select('id, content')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .order('created_at')
      .then(({ data }) => {
        setNotes(data ?? [])
        setLoaded(true)
      })
  }, [businessId, userId])

  const addNote = async () => {
    if (adding) return
    setAdding(true)
    const { data, error } = await supabase
      .from('notes')
      .insert({ business_id: businessId, user_id: userId, title: '', content: '', tags: [] })
      .select('id, content')
      .single()
    if (!error && data) {
      setNewId(data.id)
      setNotes(prev => [...prev, data])
      setTimeout(() => {
        scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
      }, 60)
    }
    setAdding(false)
  }

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    if (newId === id) setNewId(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-900">Notas rápidas</p>
        {!loaded && <Loader2 size={12} className="animate-spin text-gray-300" />}
      </div>

      {loaded && notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <button
            onClick={addNote}
            disabled={adding}
            className="h-12 w-12 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center
                       text-gray-300 hover:border-amber-300 hover:text-amber-400 transition-all"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
          <p className="text-xs text-gray-400">Crear primera nota</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#fde68a transparent' }}
        >
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              isNew={note.id === newId}
              onDelete={deleteNote}
            />
          ))}

          <button
            onClick={addNote}
            disabled={adding}
            className="flex-shrink-0 w-10 self-stretch flex items-center justify-center
                       rounded-xl border-2 border-dashed border-gray-200 text-gray-300
                       hover:border-amber-300 hover:text-amber-400 transition-all duration-150"
            title="Agregar nota"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          </button>
        </div>
      )}
    </div>
  )
}
