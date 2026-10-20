import { LanguageService } from '@services/language.service';

/**
 * Nombre legible de un plan a partir de su slug, usando las claves i18n
 * `plans.slug.*`. Fallback al slug crudo cuando no existe la clave (nunca
 * muestra strings vacíos en los chips de plan).
 *
 * Slugs del catálogo real del backend: individual | basico | premium | pro.
 */
export function planLabel(lang: LanguageService, slug: string | null | undefined): string {
  if (!slug) return '';
  const key = `plans.slug.${slug}`;
  const translated = lang.t(key);
  return translated === key ? slug : translated;
}
