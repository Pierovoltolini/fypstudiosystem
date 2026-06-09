'use client'
import { useState, useEffect } from 'react'
import FypLogo from '@/components/ui/FypLogo'

export default function SplashScreen({ businessName }: { businessName?: string }) {
  const [visible, setVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('fyp-splash')) return
    sessionStorage.setItem('fyp-splash', '1')
    setVisible(true)

    const t1 = setTimeout(() => setFadeOut(true),  600)
    const t2 = setTimeout(() => setVisible(false), 950)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none"
      style={{
        background: 'linear-gradient(135deg, #0A2472 0%, #1565FF 52%, #6366F1 100%)',
        opacity:    fadeOut ? 0 : 1,
        transition: 'opacity 0.35s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Glow detrás del logo */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -62%)',
        }}
      />

      {/* Logo + FYP Studio */}
      <div className="animate-splash-logo flex flex-col items-center gap-5">
        <div
          className="rounded-3xl flex items-center justify-center"
          style={{
            width: 88, height: 88,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 20px 60px rgba(0,0,0,0.25)',
          }}
        >
          <FypLogo size={56} />
        </div>
        <h1
          style={{
            color: '#ffffff',
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: 0,
            textShadow: '0 2px 24px rgba(0,0,0,0.2)',
          }}
        >
          FYP Studio
        </h1>
      </div>

      {/* Bienvenido + nombre */}
      <p
        className="animate-splash-slogan text-center px-8"
        style={{
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 500,
          marginTop: 12,
          letterSpacing: '-0.01em',
          opacity: 0,
        }}
      >
        {businessName ? `Bienvenido, ${businessName}` : 'Bienvenido'}
      </p>
    </div>
  )
}
