// ── POST /api/v1/sales ────────────────────────────────────────────────────────
// Exactly one of booking_id or client_pack_id must be present.
// total is optional — backend defaults to the service/pack price.

export interface CreateSaleRequest {
  booking_id?: number;
  client_pack_id?: number;
  total?: number;
}

// ── POST /api/v1/sales/:id/transactions ──────────────────────────────────────

export interface CreateTransactionRequest {
  amount: number;
  payment_method: string;
  notes?: string;
}

// ── PATCH /api/v1/sales/:id ── admin only ─────────────────────────────────────

export interface UpdateSaleRequest {
  total?: number;
  payment_method?: string;
}
