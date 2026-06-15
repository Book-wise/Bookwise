import type { Client } from '@core/models';

/**
 * Minimal shape of the patient-creation panel's `newClient` form model,
 * sufficient for similarity matching against existing `Client` records.
 */
export interface MinimalNewClient {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/**
 * Normalizes text for name comparison: trims, lowercases and strips
 * diacritics (accent-folding), so "Ánä Tést" === "ana test".
 */
export function normalizeText(value: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Strips every non-digit character, e.g. "(56) 9-1234-5678" -> "56912345678". */
export function stripDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Exact, case-insensitive email match. Empty values never match. */
export function isEmailMatch(candidate: Client, newClient: MinimalNewClient): boolean {
  const a = (candidate.email ?? '').trim().toLowerCase();
  const b = (newClient.email ?? '').trim().toLowerCase();
  return !!a && a === b;
}

/** Phone match ignoring formatting/punctuation. Empty values never match. */
export function isPhoneMatch(candidate: Client, newClient: MinimalNewClient): boolean {
  const a = stripDigits(candidate.phone ?? '');
  const b = stripDigits(newClient.phone ?? '');
  return !!a && a === b;
}

/**
 * Normalized full-name match. Provided for completeness/future tie-break;
 * intentionally NOT used by `matchSimilarClients` — a name-only match
 * must never qualify a candidate on its own.
 */
export function isNameMatch(candidate: Client, newClient: MinimalNewClient): boolean {
  const a = normalizeText(`${candidate.first_name} ${candidate.last_name}`);
  const b = normalizeText(`${newClient.first_name} ${newClient.last_name}`);
  return !!a && a === b;
}

/**
 * Filters candidates down to those that qualify as "similar" to `newClient`.
 * A candidate qualifies if it matches by email OR by phone. A name-only
 * match never qualifies on its own.
 */
export function matchSimilarClients(candidates: Client[], newClient: MinimalNewClient): Client[] {
  return candidates.filter((c) => isEmailMatch(c, newClient) || isPhoneMatch(c, newClient));
}

/** De-duplicates a list of clients by `id`, keeping the first occurrence. */
export function dedupeById(list: Client[]): Client[] {
  const seen = new Set<number>();
  return list.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
