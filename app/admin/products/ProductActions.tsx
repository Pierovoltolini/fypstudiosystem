// app/admin/products/ProductActions.tsx
// Client component — botones de acción por producto
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Pencil, Eye, EyeOff, MoreHorizontal } from 'lucide-react'

export default function ProductActions({ productId, isActive }: { productId: string; isActive: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    setOpen(false)
    await supabase.from('products').update({ active: !isActive }).eq('id', productId)
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                   hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-40"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-gray-200
                          bg-white py-1 shadow-lg">
            <Link href={`/admin/products/${productId}/edit`}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Pencil size={13} /> Editar
            </Link>
            <button onClick={toggle}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50
                         text-gray-700">
              {isActive ? <EyeOff size={13} /> : <Eye size={13} />}
              {isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
