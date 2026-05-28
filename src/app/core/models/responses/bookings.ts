// BLOCKED SLOTS

export interface BlockedSlot {
  id: number;
  start_time: string;
  end_time: string;
  reason?: string;
  provider_id?: number;
  location_id?: number;
  repeat_group_id?: string;
}

export interface BlockedSlotListResponse {
  data: BlockedSlot[];
}

// BOOKINGS

export interface Booking {
  id: number;
  start_time: string;
  end_time: string;
  effective_duration_minutes: number;
  custom_duration_minutes?: number | null;
  price: number;
  notes?: string;
  wc_order_id?: number | null;
  created_at?: string;
  // Status — both id and object returned
  status_id: number;
  status: BookingStatus;
  // Nested objects
  client: BookingClient;
  service: BookingService;
  provider: BookingProvider;
  location: BookingLocation;
  // Financials — payment_status is never null
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment?: BookingPayment | null;
  // Pack
  pack_session?: BookingPackSession | null;
}

export interface BookingClient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  rut?: string;
  gender?: string;
  active?: boolean;
}

export interface BookingService {
  id: number;
  name: string;
  duration_minutes?: number;
  price: number;
}

export interface BookingProvider {
  id: number;
  first_name: string;
  last_name: string;
}

export interface BookingLocation {
  id: number;
  name: string;
}

export interface BookingStatus {
  id: number;
  name: string;
  color: string;
  is_cancellation?: boolean;
}

export interface BookingPayment {
  id: number;
  booking_id?: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
}

export interface BookingPackSession {
  session_number: number;
  total_sessions: number;
  client_pack_id: number;
  service_pack_id: number;
  status: string;
}

export interface BookingListResponse {
  data: Booking[];
}

export interface BookingDetailResponse {
  data: Booking;
}
