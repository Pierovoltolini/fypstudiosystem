export interface InventoryCategory {
  id: string; business_id: string; name: string
  color: string; icon: string; created_at: string
}

export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'devolucion'

export interface InventoryItem {
  id: string; business_id: string; category_id?: string | null; product_id?: string | null
  name: string; sku?: string | null; unit: string
  stock_current: number; stock_min: number; stock_max?: number | null
  cost_price?: number | null; supplier?: string | null; notes?: string | null
  talle?: string | null; modelo?: string | null; color_attr?: string | null
  active: boolean; created_at: string; updated_at: string
  category?: InventoryCategory | null
  product?: { name: string } | null
}

export interface InventoryMovement {
  id: string; business_id: string; item_id: string; order_id?: string | null
  type: MovementType; quantity: number; stock_before: number; stock_after: number
  reason?: string | null; created_by?: string | null; created_at: string
  item?: InventoryItem | null
}

export type StockStatus = 'ok' | 'low' | 'critical' | 'out'

export function getStockStatus(item: InventoryItem): StockStatus {
  if (item.stock_current <= 0)                         return 'out'
  if (item.stock_current <= item.stock_min * 0.5)      return 'critical'
  if (item.stock_current <= item.stock_min)             return 'low'
  return 'ok'
}

export interface Supplier {
  id: string; business_id: string; name: string; contact_name?: string | null
  phone?: string | null; email?: string | null; address?: string | null
  city?: string | null; notes?: string | null; active: boolean
  created_at: string; updated_at: string
  products?: SupplierProduct[]
}

export interface SupplierProduct {
  id: string; supplier_id: string; business_id: string
  inventory_item_id?: string | null; product_name: string
  sku_supplier?: string | null; unit: string; price?: number | null
  min_order?: number | null; lead_days?: number | null; notes?: string | null
  created_at: string; updated_at: string
  inventory_item?: { name: string } | null
  supplier?: Pick<Supplier, 'id' | 'name' | 'phone'> | null
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string; business_id: string; supplier_id?: string | null
  supplier_name: string; status: PurchaseOrderStatus
  notes?: string | null; expected_date?: string | null
  received_at?: string | null; created_at: string; updated_at: string
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string; order_id: string; business_id: string
  inventory_item_id?: string | null; item_name: string; unit: string
  quantity_ordered: number; quantity_received?: number | null
  unit_cost?: number | null; created_at: string
  inventory_item?: Pick<InventoryItem, 'id' | 'name' | 'stock_current' | 'unit'> | null
}

export interface BusinessCost {
  id: string; business_id: string; name: string
  type: string; amount: number; date: string
  notes?: string | null; created_at: string
}
