/**
 * Slugs SEO pour pages programmatiques (/hippodromes/[slug], /chevaux/[slug], etc.)
 *
 * Pas de colonne `slug` en DB → on dérive on-the-fly depuis le `nom`.
 * Pour la résolution slug → entité, on récupère tous les noms et matche le slug.
 *
 * Strict ASCII : pas d'accents, pas de caractères spéciaux, lowercase, dashes.
 */

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugify(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")  // strip diacritics (NFD-decomposed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")        // non-alphanum → dash
    .replace(/^-+|-+$/g, "")            // trim leading/trailing dashes
    .replace(/-{2,}/g, "-");            // collapse multiple dashes
}

/** Match strict slug (pas de fuzzy matching pour éviter collisions). */
export function findBySlug<T extends { nom: string }>(
  list: T[],
  slug: string,
): T | null {
  const s = slug.toLowerCase();
  return list.find((item) => slugify(item.nom) === s) ?? null;
}
