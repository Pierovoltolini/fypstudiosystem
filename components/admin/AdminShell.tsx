// components/admin/AdminShell.tsx
// Layout principal con soporte completo mobile + desktop + verticales
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  Sparkles, LogOut, Tag, ExternalLink, Crown, Layers, Truck,
  Menu, X, ChevronRight, MoreHorizontal, Target, LayoutGrid, CreditCard, UserCog,
  CalendarDays, ChefHat, CalendarCheck, TrendingDown, Scan, BarChart2, ShieldAlert, Wallet, Bike,
  Gift, Send, Search, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVertical, getNavItemsBySub, type VerticalType } from '@/lib/verticals'
import type { Business, UserRole } from '@/types'
import NotificationBell from './NotificationBell'
import GlobalSearch from './GlobalSearch'
import AIChat from './AIChat'
import CustomModulesNav from './CustomModulesNav'
import FypLogo from '@/components/ui/FypLogo'
import ThemeToggle from '@/components/admin/ThemeToggle'

// Mapa de icon name → componente
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  Sparkles, Tag, Layers, Truck, Target, Scan, BarChart2, LayoutGrid,
  CalendarDays, ChefHat, CalendarCheck, TrendingDown, Wallet, Bike,
  Gift, Send, BookOpen,
}

function NavItem({
  href, label, icon: iconName, exact, onClick, verticalColor, tooltipId,
}: {
  href: string; label: string; icon: string; exact?: boolean
  onClick?: () => void; verticalColor: string; tooltipId?: string
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)
  const Icon = ICON_MAP[iconName] ?? Package

  return (
    <Link href={href} onClick={onClick} data-tooltip-id={tooltipId}
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
      <Icon size={15} style={isActive ? { color: verticalColor } : {}} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight size={12} style={{ color: verticalColor, opacity: 0.6 }} />}
    </Link>
  )
}

const OWNER_ONLY_HREFS = ['/admin/settings', '/admin/billing', '/admin/staff-accounts']

// ── Shared footer (usado en Sidebar y MobileDrawer) ──────────
function SidebarFooter({ business, userEmail, role, onLinkClick, onAIOpen }: {
  business: Business | null; userEmail: string
  role: UserRole; onLinkClick?: () => void; onAIOpen?: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="space-y-0.5">
      {/* AI Assistant button */}
      <button onClick={() => { onAIOpen?.(); onLinkClick?.() }}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                   text-gray-400 hover:text-white hover:bg-white/5 transition-all">
        <Sparkles size={14} /> Asistente IA
      </button>
      {business?.slug && (
        <Link href={`/store/${business.slug}`} target="_blank" onClick={onLinkClick}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400
                     hover:text-white hover:bg-white/5 transition-all">
          <ExternalLink size={14} /> Ver tienda
        </Link>
      )}
      {role === 'owner' && (
        <>
          <Link href="/admin/staff-accounts" onClick={onLinkClick}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400
                       hover:text-white hover:bg-white/5 transition-all">
            <UserCog size={14} /> Equipo
          </Link>
          <Link href="/admin/billing" onClick={onLinkClick}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400
                       hover:text-white hover:bg-white/5 transition-all">
            <CreditCard size={14} /> Planes
          </Link>
        </>
      )}
      {role === 'superadmin' && (
        <Link href="/admin/superadmin" onClick={onLinkClick}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-yellow-400
                     hover:text-yellow-300 hover:bg-yellow-500/10 transition-all">
          <ShieldAlert size={14} /> Superadmin
        </Link>
      )}
      <ThemeToggle
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400
                   hover:text-white hover:bg-white/5 transition-all"
      />
      <button onClick={handleLogout}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400
                   hover:text-red-400 hover:bg-red-500/10 transition-all">
        <LogOut size={14} /> Salir
      </button>
      <p className="px-3 pt-1 text-xs truncate" style={{ color: '#374151' }}>{userEmail}</p>
    </div>
  )
}

// ── Sidebar Desktop ───────────────────────────────────────────
function Sidebar({ business, userEmail, verticalColor, navItems, role, onAIOpen }: {
  business: Business | null; userEmail: string
  verticalColor: string; navItems: ReturnType<typeof getNavItemsBySub>
  role: UserRole; onAIOpen: () => void
}) {
  const vertical = getVertical(business?.vertical_type)

  return (
    <aside
      data-tooltip-id="sidebar-nav"
      className="hidden lg:flex w-[220px] flex-col h-full shrink-0"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo + vertical */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <FypLogo size={34} />
          <div>
            <p className="text-white font-bold text-sm tracking-tight">FyP Studio</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm">{vertical.emoji}</span>
              <p className="text-[11px] truncate max-w-[100px]" style={{ color: verticalColor }}>
                {business?.name ?? vertical.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard link — fijo, separado del scroll de abajo */}
      <div className="px-3 pt-3 pb-2 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <NavItem href="/admin" label="Dashboard" icon="LayoutDashboard"
          exact verticalColor={verticalColor} />
      </div>

      {/* Nav items del vertical */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5 overflow-y-auto pb-2">
        {navItems
          .filter(item => role === 'owner' || !OWNER_ONLY_HREFS.includes(item.href))
          .map(item => (
            <NavItem key={item.href} href={item.href} label={item.label}
              icon={item.icon} exact={item.exact} verticalColor={verticalColor}
              tooltipId={item.href === '/admin/settings' ? 'settings-nav' : undefined} />
          ))}

        {/* Custom modules separator */}
        <div className="pt-3 pb-1">
          <p className="px-3 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
            Mis módulos
          </p>
        </div>
        <CustomModulesNav verticalColor={verticalColor} />
      </nav>

      {/* Plan badge */}
      {(business?.plan === 'pro' || business?.plan === 'premium') && (
        <div className="mx-3 mb-3 rounded-xl p-3"
          style={{ background: `${verticalColor}18`, border: `1px solid ${verticalColor}33` }}>
          <div className="flex items-center gap-2 mb-0.5">
            <Crown size={12} className="text-yellow-400" />
            <span className="text-xs font-bold text-white capitalize">{business.plan}</span>
          </div>
          <p className="text-[10px] text-gray-400">Más funciones activas</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <SidebarFooter business={business} userEmail={userEmail} role={role} onAIOpen={onAIOpen} />
      </div>
    </aside>
  )
}

// ── Mobile Drawer ─────────────────────────────────────────────
function MobileDrawer({ open, onClose, business, userEmail, verticalColor, navItems, role, onAIOpen }: {
  open: boolean; onClose: () => void; business: Business | null
  userEmail: string; verticalColor: string; navItems: ReturnType<typeof getNavItemsBySub>
  role: UserRole; onAIOpen: () => void
}) {
  const vertical = getVertical(business?.vertical_type)

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col transition-transform duration-300 ease-out lg:hidden"
        style={{
          background: 'var(--sidebar-bg)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: open ? '4px 0 32px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <FypLogo size={32} />
            <div>
              <p className="text-white font-bold text-sm">FyP Studio</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs">{vertical.emoji}</span>
                <p className="text-[10px]" style={{ color: verticalColor }}>
                  {business?.name ?? vertical.label}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                       hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Dashboard link — fijo, separado del scroll de abajo */}
        <div className="px-3 pt-4 pb-2 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <NavItem href="/admin" label="Dashboard" icon="LayoutDashboard"
            exact onClick={onClose} verticalColor={verticalColor} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 space-y-0.5 overflow-y-auto pb-4">
          {navItems
            .filter(item => role === 'owner' || !OWNER_ONLY_HREFS.includes(item.href))
            .map(({ href, label, icon, exact }) => (
              <NavItem key={href} href={href} label={label} icon={icon} exact={exact}
                onClick={onClose} verticalColor={verticalColor} />
            ))}

          {/* Custom modules */}
          <div className="pt-3 pb-1">
            <p className="px-3 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
              Mis módulos
            </p>
          </div>
          <CustomModulesNav verticalColor={verticalColor} onClick={onClose} />
        </nav>

        {/* Plan */}
        {(business?.plan === 'pro' || business?.plan === 'premium') && (
          <div className="mx-3 mb-3 rounded-xl p-3"
            style={{ background: `${verticalColor}18`, border: `1px solid ${verticalColor}33` }}>
            <div className="flex items-center gap-2 mb-0.5">
              <Crown size={12} className="text-yellow-400" />
              <span className="text-xs font-bold text-white capitalize">{business.plan}</span>
            </div>
            <p className="text-[10px] text-gray-400">Más funciones activas</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 pb-8 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <SidebarFooter business={business} userEmail={userEmail} role={role}
            onLinkClick={onClose} onAIOpen={onAIOpen} />
        </div>
      </div>
    </>
  )
}

// ── Mobile Top Bar ────────────────────────────────────────────
function MobileTopBar({ business, userEmail, onMenuOpen, onSearchOpen, verticalColor }: {
  business: Business | null; userEmail: string
  onMenuOpen: () => void; onSearchOpen: () => void; verticalColor: string
}) {
  return (
    <header className="lg:hidden h-14 shrink-0 flex items-center justify-between px-4 border-b"
      style={{ background: 'var(--sidebar-bg)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <button onClick={onMenuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400
                   hover:bg-white/10 hover:text-white transition-all">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <FypLogo size={26} />
        <span className="text-white font-bold text-sm">FyP Studio</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onSearchOpen}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400
                     hover:bg-white/10 hover:text-white transition-all">
          <Search size={18} />
        </button>
        <div className="[&_button]:text-gray-400 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
          <NotificationBell business={business} />
        </div>
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: `linear-gradient(135deg,${verticalColor},${verticalColor}99)` }}>
          {userEmail.slice(0, 1).toUpperCase()}
        </div>
      </div>
    </header>
  )
}

// ── Bottom Nav Mobile ─────────────────────────────────────────
function BottomNav({ onMoreOpen, navItems, verticalColor }: {
  onMoreOpen: () => void
  navItems: ReturnType<typeof getNavItemsBySub>
  verticalColor: string
}) {
  const pathname = usePathname()
  const mainItems = [
    { href: '/admin', label: 'Inicio', icon: 'LayoutDashboard', exact: true },
    ...navItems.slice(0, 3),
  ].slice(0, 4)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center border-t"
      style={{
        background: 'var(--sidebar-bg)',
        borderColor: 'rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      {mainItems.map(({ href, label, icon: iconName, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        const Icon = ICON_MAP[iconName] ?? Package
        return (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center gap-1 py-3 min-h-[56px] justify-center transition-all">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl transition-all"
              style={isActive ? { background: verticalColor + '28' } : {}}>
              <Icon size={18} style={isActive ? { color: verticalColor } : { color: '#6B7280' }} />
            </div>
            <span className="text-xs font-medium"
              style={{ color: isActive ? verticalColor : '#6B7280' }}>
              {label.length > 11 ? label.slice(0, 10) + '…' : label}
            </span>
          </Link>
        )
      })}

      {/* Más */}
      <button onClick={onMoreOpen}
        className="flex-1 flex flex-col items-center gap-1 py-3 min-h-[56px] justify-center">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl">
          <MoreHorizontal size={18} style={{ color: '#6B7280' }} />
        </div>
        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Más</span>
      </button>
    </nav>
  )
}

// ── Desktop Top Bar ───────────────────────────────────────────
function DesktopTopBar({ userEmail, verticalColor, business, onSearchOpen }: {
  userEmail: string; verticalColor: string; business: Business | null
  onSearchOpen: () => void
}) {
  return (
    <header className="hidden lg:flex h-14 shrink-0 items-center justify-end gap-2 px-6
                       bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      {/* Search trigger */}
      <button onClick={onSearchOpen}
        className="flex items-center gap-2.5 rounded-xl border border-gray-200 pl-3 pr-2.5 py-1.5
                   text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50
                   transition-all mr-2">
        <Search size={13} />
        <span className="text-xs">Buscar...</span>
        <div className="flex items-center gap-0.5">
          <kbd className="h-4 rounded border border-gray-200 px-1 text-[9px] bg-gray-50 font-mono leading-none flex items-center">
            ⌘
          </kbd>
          <kbd className="h-4 rounded border border-gray-200 px-1 text-[9px] bg-gray-50 font-mono leading-none flex items-center">
            K
          </kbd>
        </div>
      </button>
      <NotificationBell business={business} />
      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ background: `linear-gradient(135deg,${verticalColor},${verticalColor}99)` }}>
        {userEmail.slice(0, 1).toUpperCase()}
      </div>
    </header>
  )
}

// ── SHELL PRINCIPAL ───────────────────────────────────────────
export default function AdminShell({ children, business, userEmail, suspended, role = 'owner' }: {
  children: React.ReactNode; business: Business | null
  userEmail: string; suspended: boolean; role?: UserRole
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiOpen,     setAIOpen]     = useState(false)

  const plan     = (business?.plan ?? 'basic') as import('@/types').Plan
  const aiAllowed = plan === 'pro' || plan === 'premium' || plan === 'basic'

  const vertical = getVertical(business?.vertical_type)
  const verticalColor = business?.primary_color ?? vertical.color
  const navItems = getNavItemsBySub(
    (business?.vertical_type as VerticalType) ?? 'general',
    business?.vertical_sub ?? business?.vertical_type ?? undefined,
  )

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC] dark:bg-gray-950">

      {/* Global search */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* AI Chat panel — slides in from right on desktop, full screen on mobile */}
      {aiOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white flex flex-col"
          style={{ boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', borderLeft: '1px solid rgba(0,0,0,0.07)' }}>
          <AIChat open={aiOpen} onClose={() => setAIOpen(false)} />
        </div>
      )}
      {aiOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setAIOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <Sidebar business={business} userEmail={userEmail}
        verticalColor={verticalColor} navItems={navItems} role={role}
        onAIOpen={() => setAIOpen(true)} />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        business={business} userEmail={userEmail}
        verticalColor={verticalColor} navItems={navItems} role={role}
        onAIOpen={() => setAIOpen(true)} />

      {/* Contenido */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileTopBar business={business} userEmail={userEmail}
          onMenuOpen={() => setDrawerOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
          verticalColor={verticalColor} />
        <DesktopTopBar userEmail={userEmail} verticalColor={verticalColor}
          business={business} onSearchOpen={() => setSearchOpen(true)} />

        {suspended && (
          <div className="bg-red-500 text-white text-xs text-center py-2 px-4 font-medium shrink-0">
            ⚠️ Suscripción suspendida — contactá soporte
          </div>
        )}

        <main className="flex-1 overflow-y-auto dark:bg-gray-950">
          <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>

        {/* Floating AI button — visible para todos los planes */}
        <button
          onClick={() => setAIOpen(true)}
          data-tooltip-id="ai-chat-btn"
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30
                     h-12 w-12 rounded-2xl text-white shadow-lg
                     flex items-center justify-center
                     hover:scale-105 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, #3B82F6, #6366F1)` }}
          title="Asistente IA"
        >
          <Sparkles size={20} />
        </button>

        <BottomNav onMoreOpen={() => setDrawerOpen(true)}
          navItems={navItems} verticalColor={verticalColor} />
      </div>
    </div>
  )
}
