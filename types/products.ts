import type { InventoryItem } from './inventory'

export interface Category {
  id: string; business_id: string; name: string; slug: string
  sort_order: number; active: boolean; created_at: string
}

export type ProductType = 'simple' | 'composite' | 'service'

export interface ProductIngredient {
  id: string; business_id: string; product_id: string
  inventory_item_id: string; quantity: number; unit?: string | null; created_at: string
  inventory_item?: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'unit' | 'cost_price' | 'stock_current'> | null
}

export interface ProductVariant {
  id: string; product_id: string; business_id: string; name: string
  sku?: string | null; price_modifier: number; stock: number
  active: boolean; sort_order: number; created_at: string
  size?: string | null; color?: string | null
}

export interface Product {
  id: string; business_id: string; category_id?: string | null
  name: string; slug: string; description?: string | null; price: number
  images: string[]; tags: string[]; stock?: number | null; featured: boolean
  active: boolean; seo_title?: string | null; seo_desc?: string | null
  created_at: string; updated_at: string; category?: Category | null
  product_type: ProductType; cost_price?: number | null; margin_pct?: number | null
  inventory_item_id?: string | null
  inventory_item?: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'stock_current'> | null
  ingredients?: ProductIngredient[]; variants?: ProductVariant[]
}
