// Input inventory domain — seeds, fertilizers, PPP, fuel, other inputs

export type InputCategory = 'SEED' | 'FERTILIZER' | 'PPP' | 'FUEL' | 'OTHER'
export type StockMovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'

export interface Supplier {
  id: string
  user_id: string
  name: string
  cui: string | null
  address: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface InputLot {
  id: string
  user_id: string
  supplier_id: string | null
  category: InputCategory
  product_name: string
  unit: string               // kg, L, t, buc
  quantity: number           // received quantity
  quantity_available: number // current stock (auto-updated via trigger)
  unit_price: number | null
  batch_number: string | null
  expiry_date: string | null
  received_date: string
  invoice_ref: string | null
  notes: string | null
  created_at: string
  // Joined fields
  suppliers?: { name: string } | null
}

export interface Warehouse {
  id: string
  user_id: string
  name: string
  location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  user_id: string
  lot_id: string
  warehouse_id: string | null
  work_order_id: string | null
  parcel_id: string | null
  campaign_id: string | null
  mvt_type: StockMovementType
  quantity: number
  mvt_date: string
  notes: string | null
  created_at: string
  // Joined fields
  input_lots?: { product_name: string; unit: string; category: InputCategory } | null
  warehouses?: { name: string } | null
}

export const INPUT_CATEGORY_LABELS: Record<InputCategory, string> = {
  SEED:       'Samanta',
  FERTILIZER: 'Ingrasamant',
  PPP:        'Produs fitosanitar',
  FUEL:       'Combustibil',
  OTHER:      'Altele',
}

export const INPUT_CATEGORY_COLORS: Record<InputCategory, string> = {
  SEED:       'bg-green-100 text-green-700',
  FERTILIZER: 'bg-blue-100 text-blue-700',
  PPP:        'bg-orange-100 text-orange-700',
  FUEL:       'bg-yellow-100 text-yellow-700',
  OTHER:      'bg-gray-100 text-gray-600',
}

export const MVT_TYPE_LABELS: Record<StockMovementType, string> = {
  IN:         'Intrare',
  OUT:        'Iesire',
  TRANSFER:   'Transfer',
  ADJUSTMENT: 'Ajustare',
}
