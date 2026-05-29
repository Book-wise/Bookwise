// ── Sale transaction ──────────────────────────────────────────────────────────

export interface SaleTransaction {
  id: number;
  amount: string;
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
}

export interface SaleBooking {
  id: number;
  start_time: string;
  end_time: string;
  price: string;
  service:  { id: number; name: string };
  provider: { id: number; first_name: string; last_name: string };
  status:   { id: number; name: string; color: string };
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
    price: string;
  };
}

// ── Sale summary — returned inside transaction responses ──────────────────────

export interface SaleSummary {
  total: string;
  paid_amount: string;
  remaining_amount: string;
  payment_status: 'paid' | 'partial' | 'unpaid';
}

// ── Full Sale — GET /sales/:id ────────────────────────────────────────────────

export interface Sale {
  id: number;
  wc_order_id?: number | null;
  // Amounts are decimal strings ("35000.00")
  total: string;
  paid_amount: string;
  remaining_amount: string;
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
