// components/admin/RoleGate.tsx
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import type { UserRole } from '@/types'

const ROLE_ORDER: UserRole[] = ['staff', 'owner', 'superadmin']

interface Props {
  required: UserRole
  current: UserRole | null | undefined
  children: React.ReactNode
}

export default function RoleGate({ required, current, children }: Props) {
  const currentIdx  = current ? ROLE_ORDER.indexOf(current) : 0
  const requiredIdx = ROLE_ORDER.indexOf(required)

  if (currentIdx >= requiredIdx) return <>{children}</>

  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-12 text-center">
      <ShieldAlert size={32} className="mx-auto text-gray-300 mb-3" />
      <p className="font-semibold text-gray-700 mb-1">Acceso restringido</p>
      <p className="text-sm text-gray-500 mb-5">Esta sección es solo para propietarios.</p>
      <Link href="/admin"
        className="inline-flex items-center gap-2 rounded-xl bg-gray-800 px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
        Volver al dashboard
      </Link>
    </div>
  )
}
