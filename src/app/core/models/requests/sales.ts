// ── POST /api/v1/sales ────────────────────────────────────────────────────────
// Exactly one of booking_id or client_pack_id must be present.
// Backend returns 422 { error: "invalid_input" } if both or neither are sent.
// Backend returns 422 { error: "sale_already_exists" } if a sale already exists.

export interface CreateSaleRequest {
  booking_id?: number;
  client_pack_id?: number;
  // Optional overrides — backend derives from booking.price / service_pack.price
  total?: number;
  payment_method?: string;
}

// ── POST /api/v1/sales/:id/transactions ──────────────────────────────────────
// Backend returns 422 { error: "amount_exceeds_remaining", remaining: "..." }
// if amount > sale.remaining_amount.

export interface CreateTransactionRequest {
  amount: number;
  payment_method?: string;
  notes?: string;
  paid_at?: string;  // ISO date string — takes now() if omitted
}

// ── PATCH /api/v1/sales/:id ── admin only ─────────────────────────────────────

export interface UpdateSaleRequest {
  total?: number;
  payment_method?: string;
}

// ── POST /api/v1/sales/:id/receipt/send ───────────────────────────────────────

export interface SendReceiptRequest {
  email: string;
}

export interface SendReceiptResponse {
  message: string;
}
