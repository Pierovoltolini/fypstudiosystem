export type Plan               = 'basic' | 'pro' | 'premium'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended'
export type UserRole           = 'owner' | 'staff' | 'superadmin'

export interface DeliveryZone {
  id:   string
  name: string
  fee:  number
}

export interface Business {
  id: string; name: string; slug: string; description?: string | null
  logo_url?: string | null; banner_url?: string | null; whatsapp?: string | null
  address?: string | null; currency: string; primary_color: string
  secondary_color: string; plan: Plan; active: boolean
  subscription_status: SubscriptionStatus; subscription_expires_at?: string | null
  instagram?: string | null; facebook?: string | null; tiktok?: string | null
  website?: string | null; vertical_type?: string | null; vertical_sub?: string | null
  enabled_modules?: string[] | null; created_at: string; updated_at: string
  delivery_fee?: number | null
  delivery_enabled?: boolean | null
  pickup_enabled?: boolean | null
  min_order?: number | null
  estimated_time?: string | null
  delivery_zones?: DeliveryZone[] | null
  page_config?: Record<string, unknown> | null
}

export interface Profile {
  id: string; user_id: string; business_id: string
  role: UserRole; email?: string | null; display_name?: string | null
  phone?: string | null; avatar_url?: string | null
  last_seen_at?: string | null; onboarded_at?: string | null
  created_at: string; updated_at?: string
  business?: Business
  permissions?: import('./bookings').StaffPermission | null
}

export interface Invitation {
  id: string; business_id: string; email: string; role: 'staff'
  token: string; invited_by?: string | null
  initial_permissions?: Record<string, boolean> | null
  expires_at: string; accepted_at?: string | null; accepted_by?: string | null
  revoked_at?: string | null; revoked_by?: string | null
  resend_count: number; last_sent_at?: string | null; created_at: string
}

export type InvitationAuditEvent = 'created' | 'resent' | 'accepted' | 'revoked' | 'expired'

export interface InvitationAuditLog {
  id: string; invitation_id: string; business_id: string
  event: InvitationAuditEvent; actor_id?: string | null
  metadata?: Record<string, unknown> | null; created_at: string
}

export interface PageConfig {
  theme: {
    primaryColor: string; secondaryColor: string; bgColor: string
    textColor: string; font: string
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full'
    style: 'modern' | 'minimal' | 'bold' | 'elegant'
  }
  hero: {
    enabled: boolean; title: string; subtitle: string; ctaText: string
    ctaAction: 'book' | 'whatsapp' | 'scroll'
    backgroundType: 'color' | 'image' | 'gradient'; backgroundValue: string
  }
  sections: PageSection[]
}

export interface PageSection {
  id: string
  type: 'services' | 'team' | 'gallery' | 'testimonials' | 'contact' | 'hours' | 'promo'
  enabled: boolean; title: string; order: number
}
