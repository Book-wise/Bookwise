/**
 * Flat paginated response for client-specific endpoints.
 *
 * Backend endpoints like /clients/{id}/bookings and /clients/{id}/payments
 * return pagination metadata at the top level (not nested under `meta`).
 */
export interface ClientPaginatedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}
