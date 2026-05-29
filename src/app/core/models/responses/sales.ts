// ── Monetary value — API returns strings for some fields, numbers for others ──

type Amount = string | number;

// ── Sale transaction ──────────────────────────────────────────────────────────

export interface SaleTransaction {
  id: number;
  amount: Amount;
  payment_method: string;
  notes?: string | null;
  paid_at: string;
  created_at: string;
}

// ── Nested objects inside Sale ─────────────────────────────────────────────────

export interface SaleClient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  rut?: string | null;
  gender?: string | null;
  wc_customer_id?: number | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
  created_at?: string;
}

export interface SaleBookingPackSessionItem {
  session_number: number;
  status: 'attended' | 'scheduled' | 'pending';
  booking: { start_time: string } | null;
}

export interface SaleBookingPackSession {
  session_number: number;
  total_sessions: number;
  client_pack_id: number;
  service_pack_id: number;
  effective_price: number;
  all_sessions: SaleBookingPackSessionItem[];
}

export interface SaleBooking {
  id: number;
  start_time: string;
  end_time: string;
  effective_duration_minutes?: number;
  custom_duration_minutes?: number | null;
  price: Amount;
  notes?: string | null;
  wc_order_id?: number | null;
  created_at?: string;
  payment_status?: string | null;
  status_id?: number;
  service:  { id: number; name: string; duration_minutes?: number; price?: Amount };
  provider: { id: number; first_name: string; last_name: string };
  location?: { id: number; name: string; address?: string; city?: string };
  status:   { id: number; name: string; color: string; is_cancellation?: boolean };
  client?:  SaleClient;
  pack_session?: SaleBookingPackSession | null;
}

export interface SalePackSession {
  id: number;
  session_number: number;
  status: 'attended' | 'scheduled' | 'pending';
  effective_price: number;
  price: number | null;
  notes: string | null;
  booking: {
    start_time: string;
    provider: { id: number; first_name: string; last_name: string };
    location: { id: number; name: string };
  } | null;
}

export interface SaleClientPack {
  id: number;
  total_sessions: number;
  used_sessions: number;
  status: string;
  service_pack: {
    id: number;
    name: string;
    total_sessions: number;
    price: Amount;
    service?: { id: number; name: string; price: Amount };
  };
  sessions: SalePackSession[];
}

// ── Sale summary — returned inside transaction responses ──────────────────────

export interface SaleSummary {
  total: Amount;
  paid_amount: Amount;
  remaining_amount: Amount;
  payment_status: 'paid' | 'partial' | 'unpaid';
}

// ── Full Sale — GET /sales/:id ────────────────────────────────────────────────

export interface Sale {
  id: number;
  wc_order_id?: number | null;
  total: Amount;
  paid_amount: Amount;
  remaining_amount: Amount;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method?: string | null;
  paid_at?: string | null;
  created_at?: string;
  // Relationships
  client?: SaleClient;
  // Exactly one of booking or client_pack will be non-null
  booking?: SaleBooking | null;
  client_pack?: SaleClientPack | null;
  transactions: SaleTransaction[];
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface SaleDetailResponse {
  data: Sale;
}

export interface SaleListResponse {
  data: Sale[];
}

/** POST /sales/:id/transactions → 201 */
export interface CreateTransactionResponse {
  data: SaleTransaction;
  sale: SaleSummary;
}

/** GET /sales/:id/transactions */
export interface TransactionListResponse {
  data: SaleTransaction[];
  sale: SaleSummary;
}

/** DELETE /sales/:id/transactions/:tid → 200 */
export interface DeleteTransactionResponse {
  message: string;
  sale: SaleSummary;
}
