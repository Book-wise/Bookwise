export interface BookingFormData {
  id?: number;
  client_id: number;
  service_id: number;
  provider_id: number | null;
  location_id: number;
  status_id: number;
  start_time: Date;
  duration_minutes: number;
  price: number;
  notes: string;
  internal_notes?: string;
  repeat_enabled?: boolean;
  repeat_type?: 'daily' | 'weekly' | 'monthly';
  repeat_days?: number[];
  repeat_interval?: number;
  repeat_end_type?: 'never' | 'after' | 'until';
  repeat_count?: number;
  repeat_until?: Date;
}

export interface ApiErrorResponse {
  error: string;
  detail: string;
  conflicts_with?: { id: number; start_time: string; end_time: string };
}
