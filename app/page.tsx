import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="font-semibold tracking-tight text-lg">FYP.STUDIO</span>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/auth/login" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
            Empezar gratis
          </Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Sistema operativo para comercios modernos
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 mb-6 leading-[1.1]">
          Tu comercio,{' '}<span className="text-gray-400">vendiendo solo.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Tienda online, pedidos por WhatsApp, panel de gestión e IA integrada. Todo en un sistema hecho para comercios reales.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/auth/login" className="rounded-xl bg-black px-7 py-3.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors w-full sm:w-auto">
            Crear mi tienda gratis
          </Link>
          <Link href="/admin" className="rounded-xl border border-gray-200 px-7 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full sm:w-auto">
            Ver demo en vivo →
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { icon: '🛍️', title: 'Tienda online', desc: 'Tu catálogo con tu marca. Listo para compartir.' },
          { icon: '📲', title: 'Pedidos por WhatsApp', desc: 'El cliente arma el pedido y lo envía directo. Sin fricción.' },
          { icon: '🤖', title: 'IA integrada', desc: 'Crea productos, genera promos e insights con un clic.' },
        ].map(f => (
          <div key={f.title} className="rounded-2xl border border-gray-100 p-6 bg-gray-50">
            <span className="text-3xl block mb-3">{f.icon}</span>
            <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        FYP.STUDIO — {new Date().getFullYear()}
      </footer>
    </main>
    
  )
}
