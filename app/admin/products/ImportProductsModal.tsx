// app/admin/products/ImportProductsModal.tsx
'use client'
import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, AlertCircle, Check, Loader2,
  FileSpreadsheet, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParsedRow {
  name:          string
  description:   string
  price:         number
  category_name: string
  featured:      boolean
  active:        boolean
  tags:          string[]
  _error?:       string
}

interface Props {
  businessId:   string
  productLabel: string
  onClose:      () => void
  onImported:   (count: number) => void
}

const TEMPLATE_ROWS = [
  ['nombre', 'descripcion', 'precio', 'categoria', 'destacado', 'activo', 'tags'],
  ['Hamburguesa clásica', 'Con queso, lechuga y tomate', '350', 'Hamburguesas', 'si', 'si', 'popular veggie'],
  ['Pizza mozzarella', '', '280', 'Pizzas', 'no', 'si', ''],
  ['Coca-Cola 500ml', '', '120', 'Bebidas', 'no', 'si', 'bebida fria'],
]

function downloadTemplate() {
  const csv = TEMPLATE_ROWS
    .map(r => r.map(v => `"${v}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = 'plantilla_productos.csv'
  a.click(); URL.revokeObjectURL(url)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cols: string[] = []
    let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cols.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur)
    rows.push(cols)
  }
  return rows
}

function parseRows(raw: string[][]): ParsedRow[] {
  if (raw.length < 2) return []
  const header = raw[0].map(h => h.toLowerCase().trim())
  const idxOf  = (keys: string[]) => keys.map(k => header.indexOf(k)).find(i => i >= 0) ?? -1

  const iName  = idxOf(['nombre', 'name', 'producto'])
  const iDesc  = idxOf(['descripcion', 'description', 'descripción'])
  const iPrice = idxOf(['precio', 'price', 'monto'])
  const iCat   = idxOf(['categoria', 'categoría', 'category'])
  const iFeat  = idxOf(['destacado', 'featured', 'star'])
  const iAct   = idxOf(['activo', 'active', 'habilitado'])
  const iTags  = idxOf(['tags', 'etiquetas', 'labels'])

  return raw.slice(1).map(row => {
    const get = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
    const name = get(iName)
    const priceRaw = get(iPrice).replace(',', '.')
    const price = parseFloat(priceRaw)

    let _error: string | undefined
    if (!name)           _error = 'Falta el nombre'
    else if (isNaN(price)) _error = 'Precio inválido'
    else if (price < 0)   _error = 'Precio negativo'

    const boolField = (s: string) => !['no', 'false', '0', ''].includes(s.toLowerCase())

    return {
      name,
      description:   get(iDesc),
      price:         isNaN(price) ? 0 : price,
      category_name: get(iCat),
      featured:      iFeat >= 0 ? boolField(get(iFeat)) : false,
      active:        iAct >= 0  ? boolField(get(iAct))  : true,
      tags:          get(iTags).split(/[\s,]+/).map(t => t.trim()).filter(Boolean),
      _error,
    }
  })
}

type Step = 'upload' | 'preview' | 'done'

export default function ImportProductsModal({ businessId, productLabel, onClose, onImported }: Props) {
  const [step,       setStep]       = useState<Step>('upload')
  const [rows,       setRows]       = useState<ParsedRow[]>([])
  const [dragging,   setDragging]   = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [importedN,  setImportedN]  = useState(0)
  const [apiError,   setApiError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validRows   = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => !!r._error)

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const raw  = parseCSV(text)
      const parsed = parseRows(raw)
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function doImport() {
    if (validRows.length === 0) return
    setImporting(true); setApiError(null)
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          rows: validRows.map(r => ({
            name:          r.name,
            description:   r.description || undefined,
            price:         r.price,
            category_name: r.category_name || undefined,
            featured:      r.featured,
            active:        r.active,
            tags:          r.tags.length > 0 ? r.tags : undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al importar')
      setImportedN(data.imported)
      setStep('done')
      onImported(data.imported)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden
                      max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <FileSpreadsheet size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Importar {productLabel.toLowerCase()}s</p>
              <p className="text-xs text-gray-400">Desde archivo CSV</p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                       hover:bg-gray-100 hover:text-gray-600 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 shrink-0">
          {(['upload', 'preview', 'done'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { upload: 'Subir CSV', preview: 'Revisar', done: 'Listo' }
            const active = step === s
            const past   = ['upload', 'preview', 'done'].indexOf(step) > i
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full transition-all',
                  active ? 'bg-blue-100 text-blue-700' :
                  past   ? 'bg-green-100 text-green-700' :
                           'bg-gray-100 text-gray-400'
                )}>
                  {labels[s]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="p-6 space-y-5">
              {/* Template download */}
              <div className="flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <FileSpreadsheet size={20} className="text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">Usá nuestra plantilla</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Descargá el CSV, completalo y volvé a subirlo
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold
                             text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors shrink-0">
                  <Download size={13} /> Descargar
                </button>
              </div>

              {/* Columnas */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Columnas del CSV</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { col: 'nombre',      req: true,  desc: 'Nombre del producto' },
                    { col: 'precio',      req: true,  desc: 'Precio de venta' },
                    { col: 'descripcion', req: false, desc: 'Descripción' },
                    { col: 'categoria',   req: false, desc: 'Se crea si no existe' },
                    { col: 'destacado',   req: false, desc: 'si / no' },
                    { col: 'activo',      req: false, desc: 'si / no (default: si)' },
                    { col: 'tags',        req: false, desc: 'separados por espacio' },
                  ].map(({ col, req, desc }) => (
                    <div key={col} className="flex items-start gap-2">
                      <code className="text-[11px] font-mono bg-white border border-gray-200
                                       rounded px-1.5 py-0.5 text-gray-700 shrink-0">{col}</code>
                      <div>
                        {req && <span className="text-[9px] font-bold text-red-400 uppercase">req · </span>}
                        <span className="text-[11px] text-gray-500">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <Upload size={28} className={cn('mx-auto mb-3', dragging ? 'text-blue-500' : 'text-gray-300')} />
                <p className="text-sm font-semibold text-gray-600">
                  {dragging ? 'Soltá el archivo aquí' : 'Arrastrá tu CSV o hacé click para elegir'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Solo archivos .csv</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{rows.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Filas detectadas</p>
                </div>
                <div className="rounded-2xl bg-green-50 p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{validRows.length}</p>
                  <p className="text-xs text-green-600 mt-0.5">Para importar</p>
                </div>
                <div className={cn('rounded-2xl p-3 text-center', invalidRows.length > 0 ? 'bg-red-50' : 'bg-gray-50')}>
                  <p className={cn('text-lg font-bold', invalidRows.length > 0 ? 'text-red-600' : 'text-gray-400')}>
                    {invalidRows.length}
                  </p>
                  <p className={cn('text-xs mt-0.5', invalidRows.length > 0 ? 'text-red-500' : 'text-gray-400')}>
                    Con errores
                  </p>
                </div>
              </div>

              {/* Error rows */}
              {invalidRows.length > 0 && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 space-y-1.5">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Filas con errores (se omitirán)
                  </p>
                  {invalidRows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                      <span className="font-mono shrink-0">Fila {rows.indexOf(r) + 2}</span>
                      <span className="font-medium truncate">{r.name || '(vacía)'}</span>
                      <span className="text-red-400">— {r._error}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {validRows.length > 0 ? (
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600">Vista previa</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Nombre</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Precio</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Categoría</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden sm:table-cell">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {validRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-900 truncate max-w-[180px]">{r.name}</p>
                              {r.description && (
                                <p className="text-[11px] text-gray-400 truncate max-w-[180px]">{r.description}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{r.price}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{r.category_name || '—'}</td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <div className="flex gap-1 flex-wrap">
                                {r.tags.map(t => (
                                  <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{t}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validRows.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-2.5">
                        ... y {validRows.length - 10} más
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
                  <AlertCircle size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No hay filas válidas para importar</p>
                </div>
              )}

              {apiError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" /> {apiError}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="p-10 text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Check size={28} className="text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{importedN} {productLabel.toLowerCase()}s importados</p>
                <p className="text-sm text-gray-500 mt-1">Ya están disponibles en tu catálogo</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          {step === 'upload' && (
            <>
              <button onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500
                           bg-white border border-gray-200 hover:bg-gray-50 transition-all">
                Cancelar
              </button>
              <p className="text-xs text-gray-400">Subí tu CSV para continuar</p>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]) }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500
                           bg-white border border-gray-200 hover:bg-gray-50 transition-all">
                Volver
              </button>
              <button
                onClick={doImport}
                disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold
                           text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
                  : <><Upload size={14} /> Importar {validRows.length} {productLabel.toLowerCase()}s</>}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white
                         bg-green-600 hover:bg-green-700 transition-all">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
