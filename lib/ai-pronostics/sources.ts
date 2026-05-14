/**
 * lib/ai-pronostics/sources.ts
 *
 * Whitelist statique des sources autorisées pour Elite-Turf IA.
 *
 * 📜 Conforme cahier des charges §5 (Sources autorisées et interdites)
 * et §21 (Table whitelist interne recommandée).
 *
 * 🚨 RÈGLE ABSOLUE :
 *   Une course ne peut être validée Afrique QUE si elle est confirmée
 *   par une source dont can_validate_africa_availability = true.
 *
 *   Les sources SECONDARY peuvent ENRICHIR l'analyse mais ne suffisent
 *   JAMAIS seules à valider une disponibilité Afrique.
 *
 *   Les sources FORBIDDEN (Telegram, WhatsApp, forums) bloquent
 *   automatiquement le pronostic.
 *
 * 📅 À terme (Session 2), cette whitelist sera migrée dans la table
 *   Supabase `source_whitelist` pour permettre :
 *     - Mise à jour à chaud (sans redéploiement)
 *     - Audit centralisé
 *     - Désactivation rapide d'une source compromise
 *
 *   En attendant, cette liste statique sert de source of truth.
 */

import type { SourceTier, SourceRole } from "./types";

export interface SourceWhitelistEntry {
  name:                           string;
  domain:                         string;
  country?:                       string;
  source_tier:                    SourceTier;
  source_role:                    SourceRole;
  is_official:                    boolean;
  is_africa_operator:             boolean;
  can_validate_africa_availability: boolean;
  can_confirm_discipline:         boolean;
  can_enrich_analysis:            boolean;
  is_forbidden:                   boolean;
  enabled:                        boolean;
  notes?:                         string;
}

// ─────────────────────────────────────────────────────────────────────────
// SOURCES AUTORISÉES
// ─────────────────────────────────────────────────────────────────────────

export const SOURCES_WHITELIST: SourceWhitelistEntry[] = [
  // ── PRIMAIRES (validation forte) ─────────────────────────────────────
  {
    name:                             "LONACI",
    domain:                           "pmu.lonacionline.ci",
    country:                          "CI",
    source_tier:                      "PRIMARY",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Source primaire de validation Afrique directe. Côte d'Ivoire (90% audience).",
  },
  {
    name:                             "lonaci.ci",
    domain:                           "lonaci.ci",
    country:                          "CI",
    source_tier:                      "PRIMARY",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
  },
  {
    name:                             "PMU.fr",
    domain:                           "pmu.fr",
    country:                          "FR",
    source_tier:                      "PRIMARY",
    source_role:                      "CENTRAL_PROGRAM",
    is_official:                      true,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           true,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Programme central PMU France. Confirme la course mais NE valide PAS la disponibilité Afrique.",
  },
  {
    // Source VIRTUELLE (pas d'API distincte) — émise par le crawler
    // source-evidence-collector quand une course PMU.fr remplit AU MOINS UN
    // critère de redistribution internationale :
    //   A. Pari premium : QUINTE_PLUS / QUARTE / TIERCE (paris_disponibles)
    //   B. Co-localisation : autre course du même (date, hippodrome, R) est
    //      VALIDATION_LONACI_DIRECTE
    //   C. Réunion 1 : numero_reunion === 1 (réunion vedette du jour)
    //
    // 📜 Décision PO 2026-05-14 — débloque ~30 courses/jour qui n'étaient
    //    pas dans LONACI mais sont effectivement jouables via les apps
    //    nationales (LONASE/LONAB/PMUC/PMUG/PMU Mali/PMUB/SOREC...) qui
    //    redistribuent les programmes premium PMU France.
    //
    // 🔒 Cette source ne peut être citée QUE par le collector officiel
    //    (lib/ai-pronostics/source-crawlers/index.ts). Toute autre tentative
    //    d'injection est traitée comme une source non whitelistée.
    name:                             "PMU.fr-International",
    domain:                           "pmu.fr",
    country:                          "FR",
    source_tier:                      "PRIMARY",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               false,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Validation indirecte de redistribution Afrique (Quinté+/R1/co-LONACI). Source virtuelle générée par le collector. Confidence 65-80 selon critères.",
  },

  // ── DISCIPLINES OFFICIELLES ──────────────────────────────────────────
  {
    name:                             "LeTROT",
    domain:                           "letrot.com",
    country:                          "FR",
    source_tier:                      "DISCIPLINE_OFFICIAL",
    source_role:                      "DISCIPLINE_CONFIRMATION",
    is_official:                      true,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           true,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Confirme TROT_ATTELE et TROT_MONTE.",
  },
  {
    name:                             "France Galop",
    domain:                           "france-galop.com",
    country:                          "FR",
    source_tier:                      "DISCIPLINE_OFFICIAL",
    source_role:                      "DISCIPLINE_CONFIRMATION",
    is_official:                      true,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           true,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Confirme PLAT, HAIES, STEEPLE.",
  },
  {
    name:                             "SOREC",
    domain:                           "sorec.ma",
    country:                          "MA",
    source_tier:                      "PRIMARY",
    source_role:                      "MAROC_COURSES_AND_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           true,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Source officielle Maroc — courses ET validation Afrique pour le Maroc.",
  },
  {
    name:                             "e-SOREC",
    domain:                           "e-sorec.ma",
    country:                          "MA",
    source_tier:                      "PRIMARY",
    source_role:                      "MAROC_COURSES_AND_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           true,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
  },

  // ── CORROBORATION AFRIQUE (opérateurs nationaux) ─────────────────────
  {
    name:                             "LONASE",
    domain:                           "lonase.bet",
    country:                          "SN",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Loterie Nationale Sénégalaise.",
  },
  {
    name:                             "LONAB",
    domain:                           "lonab.bf",
    country:                          "BF",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "PMU'B Burkina Faso.",
  },
  {
    name:                             "PMUB",
    domain:                           "pmub.bj",
    country:                          "BJ",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "PMU Bénin / Loterie Nationale du Bénin.",
  },
  {
    name:                             "PMUC",
    domain:                           "pmuc.cm",
    country:                          "CM",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "PMU Cameroun.",
  },
  {
    name:                             "PMUG",
    domain:                           "pmug.ga",
    country:                          "GA",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "PMU Gabon.",
  },
  {
    name:                             "PMU Mali",
    domain:                           "pmu.ml",
    country:                          "ML",
    source_tier:                      "AFRICA_CORROBORATION",
    source_role:                      "AFRICA_AVAILABILITY",
    is_official:                      true,
    is_africa_operator:               true,
    can_validate_africa_availability: true,
    can_confirm_discipline:           false,
    can_enrich_analysis:              false,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "PMU Mali officiel.",
  },

  // ── SECONDAIRES (enrichissement seul) ────────────────────────────────
  {
    name:                             "Geny",
    domain:                           "geny.com",
    country:                          "FR",
    source_tier:                      "SECONDARY",
    source_role:                      "DATA_ENRICHMENT",
    is_official:                      false,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           false,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
    notes: "Site non-officiel mais bon scraper pour musique, cotes probables. NE VALIDE PAS Afrique seul.",
  },
  {
    name:                             "Genybet",
    domain:                           "genybet.fr",
    country:                          "FR",
    source_tier:                      "SECONDARY",
    source_role:                      "DATA_ENRICHMENT",
    is_official:                      false,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           false,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
  },
  {
    name:                             "Geny Courses",
    domain:                           "geny-courses.com",
    country:                          "FR",
    source_tier:                      "SECONDARY",
    source_role:                      "DATA_ENRICHMENT",
    is_official:                      false,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           false,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
  },
  {
    name:                             "Turf-FR",
    domain:                           "turf-fr.com",
    country:                          "FR",
    source_tier:                      "SECONDARY",
    source_role:                      "DATA_ENRICHMENT",
    is_official:                      false,
    is_africa_operator:               false,
    can_validate_africa_availability: false,
    can_confirm_discipline:           false,
    can_enrich_analysis:              true,
    is_forbidden:                     false,
    enabled:                          true,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// SOURCES INTERDITES (patterns de domaine)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Patterns de domaines/noms qui DOIVENT être rejetés automatiquement.
 * Conforme cahier des charges §5.4 (sources interdites).
 */
export const FORBIDDEN_SOURCE_PATTERNS: RegExp[] = [
  /telegram\.(me|org)/i,
  /^t\.me/i,
  /whatsapp\.com/i,
  /facebook\.com\/groups/i,           // groupes Facebook (≠ pages officielles)
  /forum/i,
  /blog\.spot/i,                       // blogspot
  /wordpress\.com/i,                   // sauf si whitelist explicite
  /\.medium\.com$/i,                   // sauf comptes officiels
  /substack\.com/i,
  /reddit\.com/i,
  /discord\./i,
];

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vérifie qu'une source identifiée par son nom est dans la whitelist
 * et qu'elle est `enabled`.
 */
export function isSourceAllowed(sourceName: string): boolean {
  const entry = findSourceByName(sourceName);
  if (!entry) return false;
  if (entry.is_forbidden) return false;
  return entry.enabled;
}

/**
 * Vérifie qu'une URL/domain n'est pas dans la liste des patterns interdits.
 * À combiner avec isSourceAllowed() : on REJETTE si interdit OU si pas dans whitelist.
 */
export function isSourceForbidden(domainOrUrl: string): boolean {
  return FORBIDDEN_SOURCE_PATTERNS.some((rx) => rx.test(domainOrUrl));
}

/** Retourne la source whitelist matching le nom (case-insensitive). */
export function findSourceByName(sourceName: string): SourceWhitelistEntry | null {
  const lower = sourceName.toLowerCase().trim();
  return SOURCES_WHITELIST.find((s) => s.name.toLowerCase() === lower) ?? null;
}

/** Toutes les sources capable de valider la disponibilité Afrique. */
export function getAfricaValidatorSources(): SourceWhitelistEntry[] {
  return SOURCES_WHITELIST.filter(
    (s) => s.can_validate_africa_availability && s.enabled,
  );
}

/** Toutes les sources capables de confirmer une discipline. */
export function getDisciplineConfirmerSources(): SourceWhitelistEntry[] {
  return SOURCES_WHITELIST.filter(
    (s) => s.can_confirm_discipline && s.enabled,
  );
}

/** Vérifie si une source peut valider la disponibilité Afrique. */
export function canValidateAfrica(sourceName: string): boolean {
  const entry = findSourceByName(sourceName);
  return entry?.can_validate_africa_availability === true && entry.enabled;
}

/** Vérifie si une source peut confirmer une discipline. */
export function canConfirmDiscipline(sourceName: string): boolean {
  const entry = findSourceByName(sourceName);
  return entry?.can_confirm_discipline === true && entry.enabled;
}
