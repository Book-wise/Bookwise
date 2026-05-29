// Modelos del sistema de agenda

// Re-export requests
export * from './requests/blocked-slots';

// Re-export responses
export * from './responses/bookings';

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  timezone: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Provider {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  active: boolean;
  locations?: Location[];
  services?: Service[];
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  slot_interval_minutes?: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  price: string | number;
  active: boolean;
  slot_config?: {
    interval_minutes: number;
    buffer_minutes: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ServicePack {
  id: number;
  service_id: number;
  service?: Service;
  name: string;
  total_sessions: number;
  price: string | number;
  active: boolean;
  duration_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  rut?: string | null;
  gender?: string | null;
  wc_customer_id?: number | null;
  active: boolean;
  custom_attributes?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ClientPack {
  id: number;
  client_id: number;
  client?: Client;
  service_pack_id: number;
  service_pack?: ServicePack;
  wc_order_id?: number;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  status: 'active' | 'used' | 'expired';
  created_at?: string;
  updated_at?: string;
}

export interface BookingStatus {
  id: number;
  name: string;
  color?: string;          // returned by API; fallback to STATUS_COLOR_MAP
  is_cancellation: boolean;
}

export interface PackSession {
  session_number: number;
  total_sessions: number;
  client_pack_id: number;
  service_pack_id: number;
  status: string;
}

export * from './requests/blocked-slots';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Payment {
  id?: number;
  booking_id?: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: PaymentStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: number;
  // IDs (used when sending to API)
  client_id?: number;
  service_id?: number;
  provider_id?: number;
  location_id?: number;
  status_id: number;
  // Nested objects (returned by API)
  client?: Client;
  service?: Service;
  provider?: Provider;
  location?: Location;
  status?: BookingStatus;
  // Timing
  start_time: string;
  end_time: string;
  effective_duration_minutes?: number;
  custom_duration_minutes?: number | null;
  // Financials
  price: string | number;
  payment_status?: PaymentStatus;
  payment?: Payment | Record<string, never>;   // {} when no payment
  pack_session?: PackSession | null;
  // Meta
  notes?: string | null;
  wc_order_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id: number;
  client_id: number;
  client?: Client;
  booking_id?: number;
  booking?: Booking;
  amount: number;
  payment_method?: string;
  wc_order_id?: number;
  created_at?: string;
}

export interface AvailableSlot {
  location_id: number;
  provider_id: number;
  service_id: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export interface ProviderAvailability {
  id: number;
  provider_id: number;
  location_id: number;
  day_of_week: number; // 0-6 (domingo-sábado)
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// Auth
export type UserRole = 'admin' | 'provider';

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  provider_id?: number | null;
  location_ids?: number[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone: string;
  role?: UserRole;
}

// Paginación
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
