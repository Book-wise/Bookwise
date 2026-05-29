// ── Sale transaction ──────────────────────────────────────────────────────────

export interface SaleTransaction {
  id: number;
  amount: string | number;
  payment_method: string;
  notes?: string | null;
  paid_at: string;
}

// ── Sale ──────────────────────────────────────────────────────────────────────

export interface Sale {
  id: number;
  total: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  // Set when sale is linked to a booking
  booking_id?: number | null;
  // Set when sale is linked to a client pack
  client_pack_id?: number | null;
  transactions: SaleTransaction[];
  created_at?: string;
  updated_at?: string;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface SaleDetailResponse {
  data: Sale;
}

export interface SaleListResponse {
  data: Sale[];
}

/** Response from POST /sales/:id/transactions */
export interface CreateTransactionResponse {
  data: SaleTransaction;
  // Updated sale totals after the transaction
  sale: Pick<Sale, 'total' | 'paid_amount' | 'remaining_amount' | 'payment_status'>;
}
