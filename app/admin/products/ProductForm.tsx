// app/admin/products/ProductForm.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import { Upload, X, Loader2, Check, Plus, Trash2, ChevronRight, Search } from 'lucide-react'
import type { Product, Category, InventoryItem, ProductType } from '@/types'
import { useVertical } from '@/lib/vertical-context'

interface Ingredient {
  tempId: string
  inventory_item_id: string
  item_name: string
  item_sku: string
  quantity: string
  unit: string
}

interface VariantRow {
  tempId:         string
  id?:            string
  name:           string
  size:           string
  color:          string
  sku:            string
  priceModifier:  string
  stock:          string
  active:         boolean
}

const PRESET_SIZES  = ['XS','S','M','L','XL','XXL','XXXL','36','37','38','39','40','41','42','43','44','45','Único']
const PRESET_COLORS = ['Negro','Blanco','Gris','Rojo','Azul','Verde','Amarillo','Rosa','Naranja','Violeta','Marrón','Beige','Celeste','Bordó','Dorado','Plateado']

interface Props {
  categories: Category[]
  product?:   Product
}

const F = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300 transition-all'
const L = 'block text-xs font-semibold text-gray-600 mb-1.5'

const TYPE_OPTIONS: { value: ProductType; label: string; desc: string }[] = [
  { value: 'simple',    label: 'Venta directa',  desc: 'Un producto = un ítem de inventario' },
  { value: 'composite', label: 'Con receta',      desc: 'Combina varios insumos (gastronomía, producción)' },
  { value: 'service',   label: 'Servicio',        desc: 'Sin descuento de inventario' },
]

export default function ProductForm({ categories, product }: Props) {
  const { businessId, currency, vertical } = useVertical()
  const hasVariants = vertical.features.hasVariants
  const router = useRouter()
  const supabase = createClient()

  // ── UI state ──────────────────────────────────────────────
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [loadingInv,   setLoadingInv]   = useState(true)
  const [showItemDrop, setShowItemDrop] = useState(false)
  const [showIngDrop,  setShowIngDrop]  = useState(false)

  // ── Core product fields ────────────────────────────────────
  const [name,        setName]        = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price,       setPrice]       = useState(product?.price?.toString() ?? '')
  const [categoryId,  setCategoryId]  = useState(product?.category_id ?? '')
  const [featured,    setFeatured]    = useState(product?.featured ?? false)
  const [active,      setActive]      = useState(product?.active ?? true)
  const [stock,       setStock]       = useState(product?.stock?.toString() ?? '')
  const [images,      setImages]      = useState<string[]>(product?.images ?? [])
  const [tags,        setTags]        = useState(product?.tags?.join(', ') ?? '')

  // ── Cost / inventory fields ────────────────────────────────
  const [productType,      setProductType]      = useState<ProductType>(product?.product_type ?? 'simple')
  const [inventoryItemId,  setInventoryItemId]  = useState<string>(product?.inventory_item_id ?? '')
  const [linkedItem,       setLinkedItem]       = useState<InventoryItem | null>(null)
  const [costPrice,        setCostPrice]        = useState<string>(product?.cost_price?.toString() ?? '')
  const [marginPct,        setMarginPct]        = useState<string>(product?.margin_pct?.toString() ?? '30')
  const [ingredients,      setIngredients]      = useState<Ingredient[]>([])
  const [inventoryItems,   setInventoryItems]   = useState<InventoryItem[]>([])
  // ── Variantes ──────────────────────────────────────────────
  const [variants, setVariants] = useState<VariantRow[]>([])

  // ── Search strings ─────────────────────────────────────────
  const [itemSearch,       setItemSearch]       = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')

  // ── Load inventory items + existing ingredients on mount ──
  useEffect(() => {
    async function load() {
      setLoadingInv(true)
      const [{ data: items }, { data: ings }, { data: varRows }] = await Promise.all([
        supabase.from('inventory_items')
          .select('id,name,sku,unit,cost_price,stock_current')
          .eq('business_id', businessId)
          .eq('active', true)
          .order('name'),
        product
          ? supabase.from('product_ingredients')
              .select('inventory_item_id, quantity, unit')
              .eq('product_id', product.id)
          : Promise.resolve({ data: [] as { inventory_item_id: string; quantity: number; unit: string | null }[] }),
        hasVariants && product
          ? supabase.from('product_variants')
              .select('*')
              .eq('product_id', product.id)
              .order('sort_order')
          : Promise.resolve({ data: [] as { id: string; name: string; size: string | null; color: string | null; sku: string | null; price_modifier: number; stock: number; active: boolean; sort_order: number }[] }),
      ])

      if (varRows && varRows.length > 0) {
        setVariants(varRows.map(v => ({
          tempId:        v.id,
          id:            v.id,
          name:          v.name,
          size:          v.size ?? '',
          color:         v.color ?? '',
          sku:           v.sku ?? '',
          priceModifier: v.price_modifier.toString(),
          stock:         v.stock.toString(),
          active:        v.active,
        })))
      }

      const itemList = (items ?? []) as InventoryItem[]
      setInventoryItems(itemList)

      if (ings && ings.length > 0) {
        setIngredients(ings.map(ing => {
          const item = itemList.find(i => i.id === ing.inventory_item_id)
          return {
            tempId: ing.inventory_item_id,
            inventory_item_id: ing.inventory_item_id,
            item_name: item?.name ?? '',
            item_sku:  item?.sku  ?? '',
            quantity:  ing.quantity.toString(),
            unit:      ing.unit ?? item?.unit ?? '',
          }
        }))
      }

      setLoadingInv(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, product?.id])

  // ── Sync linkedItem when inventoryItems loads (edit mode) ──
  useEffect(() => {
    if (inventoryItems.length > 0 && inventoryItemId) {
      const found = inventoryItems.find(i => i.id === inventoryItemId) ?? null
      setLinkedItem(found)
      if (found && !costPrice) setCostPrice(found.cost_price?.toString() ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryItems, inventoryItemId])

  // ── Auto-calculate cost for composite products ─────────────
  useEffect(() => {
    if (productType !== 'composite') return
    const total = ingredients.reduce((sum, ing) => {
      const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
      return sum + (item?.cost_price ?? 0) * (parseFloat(ing.quantity) || 0)
    }, 0)
    setCostPrice(total.toFixed(2))
  }, [ingredients, inventoryItems, productType])

  // ── Computed values ────────────────────────────────────────
  const costNum   = parseFloat(costPrice)  || 0
  const marginNum = Math.min(parseFloat(marginPct) || 0, 99)
  const suggestedPrice = costNum > 0 && marginNum > 0
    ? +(costNum * (1 + marginNum / 100)).toFixed(2)
    : costNum > 0 ? costNum : 0

  const itemSearchResults = useMemo(() => {
    if (!itemSearch.trim()) return []
    const q = itemSearch.toLowerCase()
    return inventoryItems
      .filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q))
      .slice(0, 6)
  }, [itemSearch, inventoryItems])

  const ingredientSearchResults = useMemo(() => {
    if (!ingredientSearch.trim()) return []
    const q = ingredientSearch.toLowerCase()
    const addedIds = new Set(ingredients.map(i => i.inventory_item_id))
    return inventoryItems
      .filter(i => !addedIds.has(i.id) && (i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q)))
      .slice(0, 6)
  }, [ingredientSearch, inventoryItems, ingredients])

  // ── Handlers ───────────────────────────────────────────────
  function selectSimpleItem(item: InventoryItem) {
    setLinkedItem(item)
    setInventoryItemId(item.id)
    setCostPrice(item.cost_price?.toString() ?? '')
    if (!name.trim()) setName(item.name)
    setItemSearch('')
    setShowItemDrop(false)
  }

  function clearSimpleItem() {
    setLinkedItem(null)
    setInventoryItemId('')
    setItemSearch('')
    setCostPrice('')
  }

  function addIngredient(item: InventoryItem) {
    setIngredients(prev => [...prev, {
      tempId:            item.id,
      inventory_item_id: item.id,
      item_name:         item.name,
      item_sku:          item.sku ?? '',
      quantity:          '1',
      unit:              item.unit,
    }])
    setIngredientSearch('')
    setShowIngDrop(false)
  }

  function updateIngredientQty(tempId: string, qty: string) {
    setIngredients(prev => prev.map(i => i.tempId === tempId ? { ...i, quantity: qty } : i))
  }

  function removeIngredient(tempId: string) {
    setIngredients(prev => prev.filter(i => i.tempId !== tempId))
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    const ext  = file.name.split('.').pop()
    const path = `${businessId}/${Date.now()}.${ext}`
    const { error, data } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: url } = supabase.storage.from('product-images').getPublicUrl(data.path)
      setImages(prev => [...prev, url.publicUrl])
    }
    setUploadingImg(false)
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !price) return
    setLoading(true); setError(null)

    try {
      const slug    = product?.slug ?? `${slugify(name)}-${Math.random().toString(36).slice(2, 5)}`
      const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean)

      // Core fields: always exist (original schema)
      const corePayload = {
        business_id: businessId,
        name:        name.trim(),
        slug,
        description: description.trim() || null,
        price:       parseFloat(price),
        category_id: categoryId || null,
        featured,
        active,
        stock:       productType === 'service' && stock ? parseInt(stock) : null,
        images,
        tags:        tagsArr,
      }

      let productId: string
      if (product) {
        const { error } = await supabase.from('products').update(corePayload).eq('id', product.id)
        if (error) throw error
        productId = product.id
      } else {
        const { data: newProd, error } = await supabase.from('products').insert(corePayload).select('id').single()
        if (error) throw error
        productId = newProd.id
      }

      // Extended fields (migration 009): saved as a separate update, ignored if columns don't exist yet
      await supabase.from('products').update({
        product_type:      productType,
        cost_price:        costPrice ? parseFloat(costPrice) : null,
        margin_pct:        marginPct ? parseFloat(marginPct) : null,
        inventory_item_id: productType === 'simple' ? (inventoryItemId || null) : null,
      }).eq('id', productId)

      // Save recipe for composite products (migration 009 required)
      if (productType === 'composite') {
        await supabase.from('product_ingredients').delete().eq('product_id', productId)
        if (ingredients.length > 0) {
          await supabase.from('product_ingredients').insert(
            ingredients.map(ing => ({
              business_id:       businessId,
              product_id:        productId,
              inventory_item_id: ing.inventory_item_id,
              quantity:          parseFloat(ing.quantity) || 1,
              unit:              ing.unit || null,
            }))
          )
        }
      }

      // ── Save variants (migration 011 required) ─────────────
      if (hasVariants && variants.length > 0) {
        const existing = variants.filter(v => v.id)
        const newOnes  = variants.filter(v => !v.id)

        const variantName = (v: VariantRow) => {
          const parts = [v.size, v.color].filter(Boolean)
          return parts.length > 0 ? parts.join(' / ') : (v.name || 'Variante')
        }

        // Upsert existing
        if (existing.length > 0) {
          await Promise.all(existing.map(v =>
            supabase.from('product_variants').update({
              name:           variantName(v),
              size:           v.size || null,
              color:          v.color || null,
              sku:            v.sku || null,
              price_modifier: parseFloat(v.priceModifier) || 0,
              stock:          parseInt(v.stock) || 0,
              active:         v.active,
            }).eq('id', v.id!)
          ))
        }

        // Insert new
        if (newOnes.length > 0) {
          await supabase.from('product_variants').insert(
            newOnes.map((v, i) => ({
              product_id:     productId,
              business_id:    businessId,
              name:           variantName(v),
              size:           v.size || null,
              color:          v.color || null,
              sku:            v.sku || null,
              price_modifier: parseFloat(v.priceModifier) || 0,
              stock:          parseInt(v.stock) || 0,
              active:         v.active,
              sort_order:     existing.length + i,
            }))
          )
        }

        // Delete removed (existing ones not in current variants list)
        const keptIds = existing.map(v => v.id!)
        if (product && keptIds.length < (variants.filter(v => v.id).length + 1)) {
          await supabase.from('product_variants')
            .delete()
            .eq('product_id', productId)
            .not('id', 'in', `(${keptIds.join(',')})`)
        }
      } else if (hasVariants && product) {
        // Removed all variants — delete them
        await supabase.from('product_variants').delete().eq('product_id', productId)
      }

      // Hard navigation so the server always re-fetches the product list fresh
      window.location.href = '/admin/products'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // ── Ingredient cost (per unit of product) ──────────────────
  const recipeTotalCost = ingredients.reduce((sum, ing) => {
    const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
    return sum + (item?.cost_price ?? 0) * (parseFloat(ing.quantity) || 0)
  }, 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-7 max-w-2xl pb-10">

      {/* ── TIPO DE PRODUCTO ───────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-3">Tipo de producto</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setProductType(opt.value)}
              className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                productType === opt.value
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <p className={`text-sm font-bold leading-tight ${productType === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                {opt.label}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── NOMBRE ─────────────────────────────────────────── */}
      <div>
        <label className={L}>Nombre <span className="text-red-400">*</span></label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)}
          placeholder="Ej: Hamburguesa doble cheddar" className={F} />
      </div>

      {/* ── DESCRIPCIÓN ────────────────────────────────────── */}
      <div>
        <label className={L}>Descripción</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Describe tu producto..." rows={3}
          className={F + ' resize-none'} />
      </div>

      {/* ── INVENTARIO: simple ─────────────────────────────── */}
      {productType === 'simple' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-[0.12em]">
            Ítem de inventario vinculado
          </p>
          {loadingInv ? (
            <p className="text-xs text-gray-400 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Cargando inventario...
            </p>
          ) : !linkedItem ? (
            <div className="relative">
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setShowItemDrop(true) }}
                  onFocus={() => setShowItemDrop(true)}
                  onBlur={() => setTimeout(() => setShowItemDrop(false), 180)}
                  placeholder="Buscar por nombre o SKU..."
                  className={F + ' pl-9'}
                />
              </div>
              {showItemDrop && itemSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  {itemSearchResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={() => selectSimpleItem(item)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        {item.sku && <p className="text-[11px] text-gray-400">SKU: {item.sku}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-[11px] text-blue-500 font-semibold">Stock: {item.stock_current} {item.unit}</p>
                        {item.cost_price != null && (
                          <p className="text-[11px] text-gray-500">{currency} {item.cost_price}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {itemSearch.trim() && itemSearchResults.length === 0 && !loadingInv && (
                <p className="text-xs text-gray-400 mt-2">
                  Sin resultados. <a href="/admin/inventory" className="text-blue-500 underline">Agregar ítem al inventario</a>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <Check size={15} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-900 truncate">{linkedItem.name}</p>
                <p className="text-[11px] text-blue-500">
                  {linkedItem.sku && `SKU: ${linkedItem.sku} · `}
                  Stock disponible: <span className="font-bold">{linkedItem.stock_current} {linkedItem.unit}</span>
                </p>
              </div>
              {linkedItem.cost_price != null && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wide">Costo</p>
                  <p className="text-sm font-black text-blue-700">{currency} {linkedItem.cost_price}</p>
                </div>
              )}
              <button type="button" onClick={clearSimpleItem} className="text-blue-300 hover:text-blue-600 transition-colors shrink-0">
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── INVENTARIO: composite / receta ─────────────────── */}
      {productType === 'composite' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-[0.12em]">
            Receta / Ingredientes
          </p>

          {/* Ingredient rows */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              {ingredients.map(ing => {
                const item = inventoryItems.find(i => i.id === ing.inventory_item_id)
                const lineCost = (item?.cost_price ?? 0) * (parseFloat(ing.quantity) || 0)
                return (
                  <div key={ing.tempId} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ing.item_name}</p>
                      {ing.item_sku && <p className="text-[10px] text-gray-400">SKU: {ing.item_sku}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={ing.quantity}
                        min="0.001"
                        step="any"
                        onChange={e => updateIngredientQty(ing.tempId, e.target.value)}
                        className="w-20 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                      />
                      <span className="text-xs text-gray-400 w-8">{ing.unit}</span>
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <p className="text-[10px] text-gray-400">Costo</p>
                      <p className="text-sm font-bold text-gray-700">{currency} {lineCost.toFixed(2)}</p>
                    </div>
                    <button type="button" onClick={() => removeIngredient(ing.tempId)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
              <div className="flex justify-end pt-1">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm">
                  <span className="text-blue-500 font-medium">Costo total receta: </span>
                  <span className="font-black text-blue-700">{currency} {recipeTotalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Add ingredient search */}
          <div className="relative">
            <div className="relative">
              <Plus size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={ingredientSearch}
                onChange={e => { setIngredientSearch(e.target.value); setShowIngDrop(true) }}
                onFocus={() => setShowIngDrop(true)}
                onBlur={() => setTimeout(() => setShowIngDrop(false), 180)}
                placeholder="Agregar ingrediente por nombre o SKU..."
                className={F + ' pl-9'}
              />
            </div>
            {showIngDrop && ingredientSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {ingredientSearchResults.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={() => addIngredient(item)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {item.sku && <p className="text-[11px] text-gray-400">SKU: {item.sku}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[11px] text-blue-500 font-semibold">Stock: {item.stock_current} {item.unit}</p>
                      {item.cost_price != null && (
                        <p className="text-[11px] text-gray-500">{currency} {item.cost_price}/{item.unit}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {inventoryItems.length === 0 && !loadingInv && (
            <p className="text-xs text-gray-400">
              No hay ítems en inventario.{' '}
              <a href="/admin/inventory" className="text-blue-500 underline">Agregar insumos</a>
            </p>
          )}
        </div>
      )}

      {/* ── COSTO Y MARGEN ─────────────────────────────────── */}
      {productType !== 'service' && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-[0.12em] mb-4">
            Costo y margen
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={L}>
                Costo ({currency})
                {productType === 'composite' && (
                  <span className="ml-1 font-normal text-gray-400 normal-case">(calculado)</span>
                )}
              </label>
              <input
                type="number" min="0" step="0.01"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                readOnly={productType === 'composite'}
                placeholder="0"
                className={F + (productType === 'composite' ? ' bg-gray-100 text-gray-500 cursor-not-allowed' : '')}
              />
            </div>
            <div>
              <label className={L}>Margen (%)</label>
              <input
                type="number" min="0" max="99" step="1"
                value={marginPct}
                onChange={e => setMarginPct(e.target.value)}
                placeholder="30"
                className={F}
              />
            </div>
            <div>
              <label className={L}>Precio sugerido</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-3 text-sm font-mono font-black text-blue-700 select-none">
                  {suggestedPrice > 0 ? `${currency} ${suggestedPrice.toFixed(2)}` : '—'}
                </div>
                {suggestedPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrice(suggestedPrice.toFixed(2))}
                    title="Usar precio sugerido"
                    className="shrink-0 h-11 w-11 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRECIO FINAL + CATEGORÍA ───────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={L}>
            Precio de venta ({currency}) <span className="text-red-400">*</span>
          </label>
          <input type="number" required min="0" step="0.01" value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0" className={F} />
        </div>
        <div>
          <label className={L}>Categoría</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={F}>
            <option value="">Sin categoría</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── STOCK MANUAL (solo para servicios o legacy) ──────── */}
      {productType === 'service' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={L}>Stock <span className="text-gray-400 font-normal text-xs">(opcional)</span></label>
            <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
              placeholder="Sin límite" className={F} />
          </div>
          <div>
            <label className={L}>Tags <span className="text-gray-400 font-normal text-xs">(por coma)</span></label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              placeholder="vegano, sin gluten..." className={F} />
          </div>
        </div>
      )}

      {/* ── TAGS (para non-service) ────────────────────────── */}
      {productType !== 'service' && (
        <div>
          <label className={L}>Tags <span className="text-gray-400 font-normal text-xs">(separados por coma)</span></label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="vegano, sin gluten, picante..." className={F} />
        </div>
      )}

      {/* ── IMÁGENES ───────────────────────────────────────── */}
      <div>
        <label className={L}>Imágenes</label>
        <div className="flex flex-wrap gap-3">
          {images.map(url => (
            <div key={url} className="relative group">
              <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-gray-200" />
              <button type="button" onClick={() => setImages(prev => prev.filter(i => i !== url))}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center
                           rounded-full bg-gray-900 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </div>
          ))}
          <label className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center
                            rounded-xl border-2 border-dashed border-gray-200 text-gray-400
                            hover:border-blue-300 hover:text-blue-400 transition-colors
                            ${uploadingImg ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploadingImg ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            <span className="text-[10px] mt-1">{uploadingImg ? 'Subiendo...' : 'Subir'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploadingImg} />
          </label>
        </div>
      </div>

      {/* ── VARIANTES (comercio/mercados) ─────────────────── */}
      {hasVariants && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-[0.12em]">Variantes</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Talle, color, presentación… El precio base{price ? ` ($${price})` : ''} se suma al delta de cada variante.
              </p>
            </div>
            <button type="button"
              onClick={() => setVariants(prev => [...prev, {
                tempId: `new-${Date.now()}`, name: '', size: '', color: '', sku: '',
                priceModifier: '0', stock: '0', active: true,
              }])}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold
                         text-white transition-all active:scale-[0.97]"
              style={{ background: '#6366F1' }}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {variants.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              Sin variantes — el producto se vende como unidad única.
            </p>
          ) : (
            <div className="space-y-2">
              {/* datalists for autocomplete */}
              <datalist id="sizes-list">
                {PRESET_SIZES.map(s => <option key={s} value={s} />)}
              </datalist>
              <datalist id="colors-list">
                {PRESET_COLORS.map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Headers */}
              <div className="grid grid-cols-12 gap-2 px-1">
                <p className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Talle</p>
                <p className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Color</p>
                <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Δ Precio</p>
                <p className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Stock</p>
                <p className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Act.</p>
                <p className="col-span-1" />
              </div>
              {variants.map((v, i) => (
                <div key={v.tempId} className="grid grid-cols-12 gap-2 bg-white border border-gray-200 rounded-xl p-2.5">
                  <input
                    list="sizes-list"
                    value={v.size}
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, size: e.target.value } : x))}
                    placeholder="Ej: M, 40…"
                    className="col-span-3 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white"
                  />
                  <input
                    list="colors-list"
                    value={v.color}
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}
                    placeholder="Ej: Rojo…"
                    className="col-span-3 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white"
                  />
                  <input
                    type="number" step="0.01"
                    value={v.priceModifier}
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, priceModifier: e.target.value } : x))}
                    placeholder="0"
                    className="col-span-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white text-center"
                  />
                  <input
                    type="number" min="0"
                    value={v.stock}
                    onChange={e => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))}
                    placeholder="0"
                    className="col-span-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white text-center"
                  />
                  <button type="button"
                    onClick={() => setVariants(prev => prev.map((x, j) => j === i ? { ...x, active: !x.active } : x))}
                    className={`col-span-1 flex items-center justify-center rounded-lg h-7 w-7 transition-colors ${
                      v.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                    <Check size={11} />
                  </button>
                  <button type="button"
                    onClick={() => setVariants(prev => prev.filter((_, j) => j !== i))}
                    className="col-span-1 flex items-center justify-center rounded-lg h-7 w-7 bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 pt-1">
                Δ Precio: positivo (+10) o negativo (−5). Precio final = base + Δ. Talle y Color son opcionales.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── ESTADO ─────────────────────────────────────────── */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <button type="button" onClick={() => setActive(v => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${active ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700">Activo</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <button type="button" onClick={() => setFeatured(v => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${featured ? 'bg-amber-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${featured ? 'left-4' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-gray-700">Destacado</span>
        </label>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── ACCIONES ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading || !name.trim() || !price}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-500
                     text-white px-6 py-2.5 rounded-xl text-sm font-bold
                     shadow-lg shadow-blue-200/60 hover:from-blue-700 hover:to-sky-600
                     transition-all disabled:opacity-40 active:scale-[0.98]">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Guardando...' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600
                     hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
