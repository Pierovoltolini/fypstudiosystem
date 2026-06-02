// app/store/[slug]/not-found.tsx
import Link from 'next/link'

export default function StoreNotFound() {
  return (
    <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">🏪</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Tienda no encontrada</h1>
        <p className="text-sm text-gray-500 mb-6">
          Esta tienda no existe o no está disponible en este momento.
        </p>
        <Link href="/"
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
