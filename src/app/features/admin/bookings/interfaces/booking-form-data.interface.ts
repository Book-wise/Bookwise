export interface BookingFormData {
  id?: number;
  client_id: number;
  service_id: number;
  service_pack_id?: number | null;
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
  // Business error key (e.g. 'conflict', 'invalid_input', 'slot_collision')
  error?: string;
  // Human-readable detail from the backend (Spanish)
  detail?: string;
  // Laravel field validation errors
  errors?: Record<string, string[]>;
  // Laravel/framework messages
  message?: string;
  // Conflict metadata for 409 responses
  conflicts_with?: {
    id: number;
    start_time: string;
    end_time: string;
    type?: 'blocked_slot' | 'booking';
  };
}

export interface BlockConflict {
  provider: { id: number; first_name: string; last_name: string };
  conflict: { id: number; start_time: string; end_time: string };
}

export interface BlockConflictResponse {
  blocked: number[];
  conflicts: BlockConflict[];
}
