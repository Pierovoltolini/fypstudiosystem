export interface LoyaltySettings {
  business_id: string; enabled: boolean; points_per_unit: number
  redeem_ratio: number; min_redeem: number; welcome_points: number
  created_at: string; updated_at: string
}

export interface LoyaltyPoint {
  id: string; business_id: string; customer_id: string; order_id?: string | null
  points: number; reason: 'earned' | 'redeemed' | 'manual' | 'welcome'
  note?: string | null; created_at: string
}

export interface CustomerLoyalty {
  customer_id: string; customer_name: string
  total_points: number; redeem_value: number
}

export interface CashRegister {
  id: string; business_id: string
  opened_by?: string | null; closed_by?: string | null
  opened_at: string; closed_at?: string | null
  opening_amount: number; closing_amount?: number | null
  expected_amount?: number | null; difference?: number | null
  status: 'open' | 'closed'; notes?: string | null; created_at: string
}

export interface CashMovement {
  id: string; business_id: string; register_id?: string | null
  profile_id?: string | null; type: 'ingreso' | 'extraccion'
  amount: number; reason?: string | null; created_at: string
}

export interface AIProductOutput {
  name: string; description: string; category: string; tags: string[]
  instagram_copy: string; whatsapp_copy: string; hashtags: string[]
  seo_title: string; seo_description: string
}

export interface AIPromoOutput {
  title: string; body: string; instagram_story: string
  whatsapp_message: string; cta: string
}

export type AIGenerationType = 'product' | 'promo' | 'insights'
