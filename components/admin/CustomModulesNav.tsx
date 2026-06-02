'use client'
// Carga y muestra los módulos personalizados del negocio en el sidebar
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import { Plus, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Module { id: string; name: string; icon: string }

interface Props { verticalColor: string; onClick?: () => void }

export default function CustomModulesNav({ verticalColor, onClick }: Props) {
  const { businessId } = useVertical()
  const supabase  = createClient()
  const pathname  = usePathname()
  const [modules, setModules] = useState<Module[]>([])

  useEffect(() => {
    supabase
      .from('custom_modules')
      .select('id, name, icon')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setModules(data ?? []))
  }, [businessId])

  if (modules.length === 0) {
    return (
      <Link href="/admin/custom-modules/new" onClick={onClick}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-gray-500
                   hover:text-white hover:bg-white/5 transition-all">
        <Plus size={13} />
        <span>Crear módulo</span>
      </Link>
    )
  }

  return (
    <div className="space-y-0.5">
      {modules.map(m => {
        const href     = `/admin/custom-modules/${m.id}`
        const isActive = pathname === href
        return (
          <Link key={m.id} href={href} onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              isActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
            style={isActive ? {
              background: `linear-gradient(90deg,${verticalColor}22,${verticalColor}0a)`,
              borderLeft: `3px solid ${verticalColor}`,
              paddingLeft: '9px',
            } : {}}
          >
            <LayoutGrid size={14} style={isActive ? { color: verticalColor } : {}} />
            <span className="flex-1 truncate">{m.name}</span>
          </Link>
        )
      })}
      <Link href="/admin/custom-modules" onClick={onClick}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-gray-500
                   hover:text-white hover:bg-white/5 transition-all">
        <Plus size={12} />
        <span>Gestionar módulos</span>
      </Link>
    </div>
  )
}
