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
  end_time: string;
  service_id: number;
  provider_id: number;
  client_id: number;
  location_id: number;
  status_id: number;
  price: number;
  notes?: string;
  duration_minutes?: number;
  wc_order_id?: number | null;
}

export interface UpdateBooking {
  start_time?: string;
  end_time?: string;
  status_id?: number;
  price?: number;
  notes?: string;
  provider_id?: number;
}

export interface CancelBooking {
  notes?: string;
}