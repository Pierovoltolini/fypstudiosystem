export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export interface FieldDef {
  key:      string
  label:    string
  type:     FieldType
  required: boolean
  options?: string[]  // solo para type='select'
}

export interface CustomModule {
  id:          string
  business_id: string
  name:        string
  icon:        string
  description?: string | null
  fields:      FieldDef[]
  is_paid:     boolean
  active:      boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
}

export interface CustomModuleEntry {
  id:          string
  module_id:   string
  business_id: string
  data:        Record<string, unknown>
  created_by?: string | null
  created_at:  string
  updated_at:  string
}
