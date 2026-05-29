// BLOCKED SLOTS

export interface CreateBlockedSlot {
  start_time: string;
  end_time: string;
  reason?: string;
  scope?: 'all';
  location_id?: number;
  provider_id?: number;
  repeat?: CreateBlockedSlotRepeat;
}

export interface CreateBlockedSlotRepeat {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  days?: number[];
  end_type: 'after' | 'until' | 'never';
  count?: number;
  until?: string;
}

// BOOKINGS

export interface CreateBooking {
  start_time: string;
  // Exactly one of these must be present (mutually exclusive).
  // Backend returns 422 { error: "invalid_input" } if both or neither are sent.
  service_id?: number;
  service_pack_id?: number;
  provider_id?: number;
  client_id: number;
  location_id: number;
  status_id: number;
  // price: required for service bookings, omitted for pack bookings (backend sets it)
  price?: number;
  // Optional custom duration — omit to use the service's canonical duration_minutes
  custom_duration_minutes?: number;
  notes?: string;
  wc_order_id?: number | null;
  repeat?: BookingRepeat;
}

export interface BookingRepeat {
  enabled?: boolean;
  type?: 'daily' | 'weekly' | 'monthly';
  days?: number[];
  interval?: number;
  end_type?: 'never' | 'after' | 'until';
  count?: number;
  until?: string;
}

export interface UpdateBooking {
  start_time?: string;
  end_time?: string;
  status_id?: number;
  price?: number;
  custom_duration_minutes?: number;
  notes?: string;
  provider_id?: number;
}

export interface CancelBooking {
  notes?: string;
}