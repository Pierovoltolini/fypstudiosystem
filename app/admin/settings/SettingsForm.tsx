// app/admin/settings/SettingsForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, Upload, AlertCircle } from 'lucide-react'
import type { Business } from '@/types'
import VerticalSelector from './VerticalSelector'
import type { VerticalType } from '@/lib/verticals'

const CURRENCIES = [
  { value: 'UYU', label: 'UYU — Peso uruguayo' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
]

const F = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300 transition-all'
const L = 'block text-[10px] tracking-[0.15em] uppercase font-bold text-blue-600 mb-2'

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-7">
      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-sky-400 shrink-0" />
      <span className="text-[11px] tracking-[0.2em] uppercase font-black text-blue-700 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
    </div>
  )
}

export default function SettingsForm({ business }: { business: Business }) {
  const supabase = createClient()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  const [name,           setName]           = useState(business.name ?? '')
  const [whatsapp,       setWhatsapp]       = useState(business.whatsapp ?? '')
  const [address,        setAddress]        = useState(business.address ?? '')
  const [currency,       setCurrency]       = useState(business.currency ?? 'UYU')
  const [primaryColor,   setPrimaryColor]   = useState(business.primary_color ?? '#000000')
  const [secondaryColor, setSecondaryColor] = useState(business.secondary_color ?? '#ffffff')
  const [logoUrl,        setLogoUrl]        = useState(business.logo_url ?? '')
  const [bannerUrl,      setBannerUrl]      = useState(business.banner_url ?? '')
  const [instagram,      setInstagram]      = useState(business.instagram ?? '')
  const [tiktok,         setTiktok]         = useState(business.tiktok ?? '')
  const [website,        setWebsite]        = useState(business.website ?? '')

  const whatsappClean = whatsapp.replace(/[^\d]/g, '')

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') {
    const file = e.target.files?.[0]
    if (!file) return
    if (type === 'logo') setUploadingLogo(true)
    else setUploadingBanner(true)
    const ext = file.name.split('.').pop()
    const filePath = `${business.id}/${type}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path)
      if (type === 'logo') setLogoUrl(urlData.publicUrl)
      else setBannerUrl(urlData.publicUrl)
    }
    if (type === 'logo') setUploadingLogo(false)
    else setUploadingBanner(false)
    e.target.value = ''
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch('/api/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, whatsapp: whatsappClean, address,
          currency, primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl, banner_url: bannerUrl,
          instagram, tiktok, website,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 pb-4">

      {/* ── DATOS DEL NEGOCIO ── */}
      <div className="bg-gradient-to-br from-blue-50/80 to-sky-50/50 rounded-2xl p-6 border border-blue-100/80 animate-fade-up-1">
        <SectionTitle label="Datos del negocio" />
        <div className="space-y-5">

          <div>
            <label className={L}>Nombre del comercio <span className="text-red-400">*</span></label>
            <input type="text" required value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Burger House"
              className={F} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={L}>WhatsApp <span className="text-red-400">*</span></label>
              <input type="text" value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="59899123456"
                className={F} inputMode="numeric" />
              {whatsapp && (
                <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${
                  whatsappClean.length >= 8 ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {whatsappClean.length >= 8
                    ? <Check size={10} />
                    : <AlertCircle size={10} />}
                  {whatsappClean.length >= 8
                    ? `Se guardará: +${whatsappClean}`
                    : 'Incluí el código de país'}
                </div>
              )}
            </div>

            <div>
              <label className={L}>Moneda</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className={F + ' cursor-pointer'}>
                {CURRENCIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={L}>Dirección del local</label>
            <input type="text" value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Av. 18 de Julio 1234, Montevideo"
              className={F} />
          </div>
        </div>
      </div>

      {/* ── IDENTIDAD VISUAL ── */}
      <div className="bg-gradient-to-br from-sky-50/60 to-blue-50/40 rounded-2xl p-6 border border-blue-100/70 animate-fade-up-2">
        <SectionTitle label="Identidad visual" />
        <div className="space-y-7">

          {/* Logo */}
          <div>
            <label className={L}>Logo</label>
            <div className="flex items-start gap-5">
              <div className="h-20 w-20 rounded-xl border-2 border-blue-100 overflow-hidden bg-blue-50/50 shrink-0 flex items-center justify-center">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  : <span className="text-[10px] tracking-[0.1em] uppercase text-blue-200 font-bold">Logo</span>
                }
              </div>
              <div className="flex-1 space-y-3">
                <label className={`flex items-center gap-3 border border-blue-200 bg-blue-50/60 rounded-xl px-4 py-3
                                   cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all
                                   ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingLogo
                    ? <Loader2 size={13} className="animate-spin text-blue-400" />
                    : <Upload size={13} className="text-blue-400" />}
                  <span className="text-[11px] tracking-[0.08em] uppercase text-blue-500 font-bold">
                    {uploadingLogo ? 'Subiendo...' : 'Subir imagen'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => uploadFile(e, 'logo')} disabled={uploadingLogo} />
                </label>
                <input type="text" value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  className={F + ' text-xs'}
                  placeholder="O pegá una URL de imagen" />
              </div>
            </div>
          </div>

          {/* Banner */}
          <div>
            <label className={L}>Banner de la tienda</label>
            <div className="space-y-3">
              {bannerUrl && (
                <div className="h-28 rounded-xl border-2 border-blue-100 overflow-hidden">
                  <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                </div>
              )}
              <label className={`flex items-center gap-3 border border-blue-200 bg-blue-50/60 rounded-xl px-4 py-3
                                 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all
                                 ${uploadingBanner ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingBanner
                  ? <Loader2 size={13} className="animate-spin text-blue-400" />
                  : <Upload size={13} className="text-blue-400" />}
                <span className="text-[11px] tracking-[0.08em] uppercase text-blue-500 font-bold">
                  {uploadingBanner ? 'Subiendo...' : 'Subir banner'}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => uploadFile(e, 'banner')} disabled={uploadingBanner} />
              </label>
              <input type="text" value={bannerUrl}
                onChange={e => setBannerUrl(e.target.value)}
                className={F + ' text-xs'}
                placeholder="O pegá una URL de imagen" />
            </div>
          </div>

          {/* Colores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={L}>Color principal</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden
                              focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input type="color" value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-12 w-14 shrink-0 border-0 border-r border-gray-200 cursor-pointer p-1.5 bg-white" />
                <input type="text" value={primaryColor.toUpperCase()}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-gray-700 outline-none uppercase" />
              </div>
            </div>
            <div>
              <label className={L}>Color secundario</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden
                              focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input type="color" value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="h-12 w-14 shrink-0 border-0 border-r border-gray-200 cursor-pointer p-1.5 bg-white" />
                <input type="text" value={secondaryColor.toUpperCase()}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-gray-700 outline-none uppercase" />
              </div>
            </div>
          </div>

          {/* Vista previa */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50/70 to-sky-50/50 border border-blue-100 p-5">
            <p className={L + ' mb-4'}>Vista previa</p>
            <div className="flex items-center gap-4 flex-wrap">
              <button type="button"
                className="px-6 py-2.5 text-sm font-semibold transition-all rounded-xl shadow-md"
                style={{ background: primaryColor, color: secondaryColor }}>
                Agregar al carrito
              </button>
              <div className="h-10 w-10 rounded-lg shadow-md"
                style={{ background: primaryColor }} />
              <div className="h-10 w-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ background: secondaryColor }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── REDES SOCIALES ── */}
      <div className="bg-gradient-to-br from-blue-50/60 to-sky-50/40 rounded-2xl p-6 border border-blue-100/70 animate-fade-up-3">
        <SectionTitle label="Redes sociales" />
        <div className="space-y-5">
          <div>
            <label className={L}>Instagram</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden
                            focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <span className="px-4 py-3.5 text-sm font-bold text-blue-400 bg-blue-50 border-r border-blue-100 shrink-0 select-none">@</span>
              <input type="text" value={instagram}
                onChange={e => setInstagram(e.target.value)}
                className="flex-1 bg-white px-4 py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-300"
                placeholder="tucomercio" />
            </div>
          </div>
          <div>
            <label className={L}>TikTok</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden
                            focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <span className="px-4 py-3.5 text-sm font-bold text-blue-400 bg-blue-50 border-r border-blue-100 shrink-0 select-none">@</span>
              <input type="text" value={tiktok}
                onChange={e => setTiktok(e.target.value)}
                className="flex-1 bg-white px-4 py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-300"
                placeholder="tucomercio" />
            </div>
          </div>
          <div>
            <label className={L}>Sitio web</label>
            <input type="url" value={website}
              onChange={e => setWebsite(e.target.value)}
              className={F}
              placeholder="https://tucomercio.com" />
          </div>
        </div>
      </div>

      {/* ── TIPO DE NEGOCIO ── */}
      <div className="bg-gradient-to-br from-sky-50/50 to-blue-50/30 rounded-2xl p-6 border border-blue-100/60 animate-fade-up-4">
        <SectionTitle label="Tipo de negocio" />
        <VerticalSelector
          businessId={business.id}
          currentVertical={(business.vertical_type as VerticalType) ?? 'general'}
        />
      </div>

      {/* ── PLAN ── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 rounded-2xl p-6 shadow-xl shadow-blue-200/60 animate-fade-up-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-blue-200 mb-1">Plan activo</p>
            <p className="text-2xl font-black text-white capitalize">{business.plan}</p>
            <p className="text-xs text-blue-200 mt-1 capitalize">{business.subscription_status}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-blue-200 mb-2">Slug</p>
            <p className="text-xs font-mono text-white bg-white/15 px-3 py-1.5 rounded-lg border border-white/20">
              {business.slug}
            </p>
          </div>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── GUARDAR ── */}
      <div className="pt-2 pb-10 flex items-center gap-6">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-sky-500
                     text-white px-8 py-3.5 rounded-xl
                     text-[11px] font-black tracking-[0.15em] uppercase
                     shadow-lg shadow-blue-200/70 hover:shadow-xl hover:shadow-blue-300/60
                     hover:from-blue-700 hover:to-sky-600
                     transition-all active:scale-[0.98] disabled:opacity-40">
          {saving
            ? <Loader2 size={13} className="animate-spin" />
            : saved
              ? <Check size={13} />
              : null}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>

        {saved && (
          <p className="text-[11px] tracking-[0.08em] uppercase text-green-600 animate-fade-in font-bold">
            ✓ Configuración actualizada
          </p>
        )}
      </div>

    </form>
  )
}
