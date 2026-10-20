// Modelos del sistema de agenda

// Re-export requests
export * from './requests/blocked-slots';
export * from './requests/sales';

// Re-export responses
export * from './responses/bookings';
export * from './responses/sales';

export interface Locality {
  id: number;
  name: string;
}

export interface Region extends Locality {
  timezone: string;
}

export interface LocationComuna extends Locality {}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region_id?: number;
  region?: Region;
  comuna_id?: number;
  comuna?: LocationComuna;
  timezone: string;
  codigo_postal?: string;
  opening_time?: string;
  closing_time?: string;
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
  location?: Location | null;
  services?: Service[];
  roles?: Role[];
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

/**
 * Per-client notification preferences — 1:1 with the backend contract (5 flags).
 * Sending is handled by the backend (carlitox + cron); the frontend only reads/writes.
 */
export interface NotificationPrefs {
  email_new_booking: boolean;
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  whatsapp_reminder: boolean;
  whatsapp_cancellation_confirmation: boolean;
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
  notifications_enabled?: boolean;
  notification_prefs?: NotificationPrefs;
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
  status: 'active' | 'used' | 'expired' | 'completed' | 'abandoned';
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
  total_amount: number;
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
  payment_status?: PaymentStatus | null;
  payment?: Payment | Record<string, never>;   // {} when no payment
  pack_session?: PackSession | null;
  // Meta
  notes?: string | null;
  internal_notes?: string | null;
  wc_order_id?: number | null;
  created_via?: 'admin_calendar' | 'agent' | 'online_webhook' | null;
  last_modified_via?: 'admin_calendar' | 'agent' | null;
  created_at?: string;
  updated_at?: string;
}

// Sale interface is defined in responses/sales.ts and re-exported via the barrel

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
  avatar_url?: string | null;
  role: UserRole;
  provider_id?: number | null;
  tenant_id?: number | null;
  email_verified_at?: string | null;
  onboarding_complete?: boolean;
  business?: Business | null;
  location_ids?: number[];
}

export interface AuthResponse {
  token: string;
  user: User;
  /** Top-level abilities granted by the backend (A1) — outside `user`. */
  abilities?: string[];
  /** Effective permission keys of the active tenant (editable matrix). */
  permissions?: string[];
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

/** POST /auth/register → 201 { message, user } (sin token: el login queda bloqueado hasta verificar email) */
export interface RegisterResponse {
  message: string;
  user: User;
}

/** POST /auth/password (Bearer) → 200 { message } — cambio de contraseña del usuario autenticado. */
export interface ChangePasswordData {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** POST /auth/reset-password (público) { token, password, password_confirmation }
 *  → 200 { message } | 400 { error: 'invalid_token' | 'token_expired' | 'token_already_used' } | 422 { message, errors }. */
export interface ResetPasswordData {
  token: string;
  password: string;
  password_confirmation: string;
}

// Business onboarding / profile / roles
/** Plan de negocio. El contrato confirma valores tipo 'starter' | 'professional' | 'enterprise'. */
export type BusinessPlan = string;

export interface Business {
  id: number;
  name: string;
  rut: string;
  email: string;
  address: string;
  phone?: string | null;
  plan: BusinessPlan;
  /** Cantidad de profesionales que atienden (onboarding). */
  professional_count?: number | null;
  /** Slug del tipo de negocio (catálogo: centro-estetica, spa, ..., yoga-studio, other). */
  business_type?: string | null;
  /** Texto libre cuando business_type === 'other'. */
  business_type_other?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** GET /auth/me (Bearer) → { user: AuthMeData }. El email del negocio no es editable. */
export interface AuthMeData {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  /** Provider id when the authenticated user is provider-scoped; null otherwise. */
  provider_id?: number | null;
  tenant_id: number | null;
  email_verified_at: string | null;
  onboarding_complete: boolean;
  business: Business | null;
  /** Negocios a los que puede alternar (multi-tenant; admin_general ve todos). */
  businesses?: Business[];
  /** Roles de NEGOCIO (distintos del rol técnico `role`). */
  is_admin_general?: boolean;
  is_admin_local?: boolean;
  is_admin_location?: boolean;
}

export interface AuthMeResponse {
  user: AuthMeData;
  /** Top-level abilities on /auth/me (A1) — outside `user`. */
  abilities?: string[];
  /** Effective permission keys of the active tenant (editable matrix), fail-closed. */
  permissions?: string[];
}

/** POST /auth/switch-tenant | /auth/switch-account (Bearer) → { token, user, abilities }.
 *  The backend ROTATES the token on every switch and revokes the previous one,
 *  so callers MUST adopt `token`. `abilities` and `permissions` are TOP-LEVEL,
 *  never inside `user`. */
export interface AuthSwitchResponse {
  token: string;
  user: AuthMeData;
  abilities: string[];
  permissions: string[];
}

/**
 * Business role (a layer separate from `UserRole`). `slug` is the identity used
 * by every consumer: admin_general | admin_local | recepcionista |
 * recepcionista_readonly | staff | staff_readonly. `name` is display-only and
 * acts as the fallback label when no i18n key exists for the slug.
 */
export interface Role {
  id: number;
  slug: string;
  name: string;
  permissions: string[];
}

/** Single entry of the tenantless permission catalog (GET /v1/roles/permissions). */
export interface PermissionItem {
  key: string;
  label: string;
}

/** Grouped permission catalog entry. */
export interface PermissionGroup {
  group: string;
  items: PermissionItem[];
}

/** PATCH /v1/roles/{id}/permissions response body. */
export interface RolePermissionsResponse {
  message?: string;
  data: {
    role_id: number;
    slug: string;
    permissions: string[];
  };
}

/** POST /businesses (Bearer) → cuerpo que SIEMPRE se valida en el front. */
export interface CreateBusinessData {
  name: string;
  rut: string;
  email: string;
  address: string;
  phone: string;
  plan: BusinessPlan;
  /** Logo opcional del negocio (aparece en recibos/email). */
  logo?: File | null;
  /** Cantidad de profesionales que atienden (onboarding). */
  professional_count?: number | null;
  /** Slug del tipo de negocio (catálogo: centro-estetica, spa, ..., yoga-studio, other). */
  business_type?: string | null;
  /** Texto libre cuando business_type === 'other'. */
  business_type_other?: string | null;
}

/** POST /businesses → 200 (completa el tenant pending) o 201 (crea tenant nuevo)
 *  { data: Business, message?, warnings? }. `data` ES el Business (plano); la
 *  respuesta ya NO incluye `user`. */
export interface CreateBusinessResponse {
  data: Business;
  message?: string;
  warnings?: string[];
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

// Client-paginated response (flat structure from /clients/{id}/bookings, etc.)
export type { ClientPaginatedResponse } from './responses/client-paginated-response';

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// ── Subscription usage (GET /subscription/usage) ──────────────────────────────
/** Cuota plana del plan: `limit` es el máximo permitido y `current` el consumo actual. */
export interface Quota {
  limit: number;
  current: number;
}

/** Uso por negocio. NO trae `name` — el front mapea `tenant_id` → nombre desde
 *  `AuthService.me().businesses`. */
export interface BusinessUsage {
  tenant_id: number;
  professionals: Quota;
  locations: Quota;
}

/** Desglose por negocio del consumo de confirmaciones (bucket compartido de la cuenta). */
export interface ConfirmationUsageByTenant {
  tenant_id: number;
  name: string;
  consumed: number;
}

/** Consumo de confirmaciones de un canal. `consumed` es el TOTAL de la cuenta
 *  (bucket compartido); `by_tenant` es el desglose por negocio.
 *  `remaining = limit - consumed`. */
export interface ConfirmationUsage {
  limit: number;
  consumed: number;
  remaining: number;
  period_start: string;
  period_end: string;
  pack_credit: number;
  by_tenant: ConfirmationUsageByTenant[];
}

/** Payload de `GET /subscription/usage` (dentro del envoltorio `data`). */
export interface UsageData {
  account_id: number;
  /** Referencia pública corta de la cuenta (BW-XXXXXX), no secuencial. */
  account_reference?: string;
  plan: {
    slug: string;
    billing_interval: string;
  };
  tenants: Quota;
  users: Quota;
  businesses: BusinessUsage[];
  confirmations: {
    email: ConfirmationUsage;
    whatsapp: ConfirmationUsage;
  };
}

/** Respuesta completa de `GET /subscription/usage`. */
export interface UsageResponse {
  data: UsageData;
}

// ── Plan catalog & subscription (GET /v1/plans · GET /v1/subscription) ────────
/** Límites de entitlement de un plan (eje-b). `null` = cupo sin definir aún. */
export interface PlanLimits {
  max_tenants: number;
  max_profesionales: number;
  max_locations: number | null;
  max_users: number | null;
  email_monthly_limit: number | null;
  whatsapp_monthly_limit: number | null;
}

/** Fila completa de un plan (PlanResource) — tal como la expone el backend. */
export interface Plan extends PlanLimits {
  id: number;
  slug: string;
  name: string;
  billing_interval: 'month' | 'year';
  price_clp: number;
}

/** Intervalo de un plan dentro del catálogo agrupado (GET /v1/plans). */
export interface PlanCatalogEntry extends PlanLimits {
  billing_interval: 'month' | 'year';
  price_clp: number;
}

/** Grupo del catálogo público: un slug con sus intervalos month/year. */
export interface PlanCatalogGroup {
  slug: string;
  name: string;
  display_order: number;
  plans: PlanCatalogEntry[];
}

/** Respuesta de `GET /v1/plans` (catálogo público, sin auth). */
export interface PlansCatalogResponse {
  data: PlanCatalogGroup[];
}

/** Add-on (pack de confirmaciones) contratado por la cuenta. */
export interface SubscriptionAddon {
  type: 'email' | 'whatsapp';
  quantity: number;
  credits_per_pack: number;
  /** Costo del add-on para el período (unitario × quantity). */
  price_clp: number;
}

/** Pack de confirmaciones ofrecido (catálogo de add-ons). */
export interface AddonCatalogItem {
  type: 'email' | 'whatsapp';
  credits_per_pack: number;
  price_clp: number;
}

/** Suscripción de la cuenta activa (GET /v1/subscription). */
export interface Subscription {
  id: number;
  status: string;
  plan: Plan | null;
  scheduled_plan: Plan | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_at: string | null;
  activated_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  /** Packs de confirmaciones contratados (aditivo). */
  addons?: SubscriptionAddon[];
  /** Costo total de los add-ons del período. */
  addons_total_clp?: number;
  /** Precio del plan + add-ons del período. */
  total_price_clp?: number;
  /** Catálogo de packs disponibles para contratar (aditivo). */
  addon_catalog?: AddonCatalogItem[];
}

/** Respuesta de `GET /v1/subscription` (dentro del envoltorio `data`). */
export interface SubscriptionResponse {
  data: Subscription | null;
}
