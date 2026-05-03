// Modelos del sistema de agenda

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
  phone: string;
  active: boolean;
  locations?: Location[];
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
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
  price: number;
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
  phone: string;
  active: boolean;
  custom_attributes?: Record<string, any>;
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
  color?: string;          // populated from STATUS_COLOR_MAP on the frontend
  is_cancellation: boolean;
}

export interface Booking {
  id: number;
  client_id: number;
  client?: Client;
  service_id: number;
  service?: Service;
  provider_id: number;
  provider?: Provider;
  location_id: number;
  location?: Location;
  status_id: number;
  status?: BookingStatus;
  start_time: string;
  end_time: string;
  custom_duration_minutes?: number;
  price: number;
  notes?: string;
  wc_order_id?: number;
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

// Tipos para disponibilidad de profesionales
export interface ProviderAvailability {
  id: number;
  provider_id: number;
  location_id: number;
  day_of_week: number; // 0-6 (domingo-sábado)
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// Tipos para roles de usuario
export type UserRole = 'admin' | 'provider';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  provider_id?: number; // Si es provider, tiene ID de provider
  location_ids?: number[]; // Si es admin, puede ver varias locations
}

// Tipos para paginación
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