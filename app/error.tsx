'use client'
import { useEffect } from 'react'
import FypLogo from '@/components/ui/FypLogo'

export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center gap-2.5 mb-8">
          <FypLogo size={32} />
          <span className="font-bold text-lg tracking-tight">FYP.STUDIO</span>
        </div>
        <div className="h-14 w-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
        <p className="text-sm text-gray-500 mb-2">
          Ocurrió un error inesperado. Podés intentar recargar la página.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6 font-mono">ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset}
            className="rounded-xl bg-black px-6 py-3 text-sm font-medium text-white
                       hover:bg-gray-800 transition-colors">
            Reintentar
          </button>
          <a href="/admin"
            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium
                       text-gray-700 hover:bg-gray-50 transition-colors">
            Ir al panel
          </a>
        </div>
      </div>
    </div>
  )
}
