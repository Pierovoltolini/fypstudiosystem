import Link from 'next/link'
import FypLogo from '@/components/ui/FypLogo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center gap-2.5 mb-8">
          <FypLogo size={32} />
          <span className="font-bold text-lg tracking-tight">FYP.STUDIO</span>
        </div>
        <p className="text-7xl font-black text-gray-100 mb-4 leading-none">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Página no encontrada</h1>
        <p className="text-sm text-gray-500 mb-8">
          La página que buscás no existe o fue movida.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/admin"
            className="rounded-xl bg-black px-6 py-3 text-sm font-medium text-white
                       hover:bg-gray-800 transition-colors">
            Ir al panel
          </Link>
          <Link href="/"
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium
                       text-gray-700 hover:bg-gray-50 transition-colors">
            Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
