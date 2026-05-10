/**
 * Données pays pour les pages /pronostics-pmu-[pays] et la tarification locale.
 *
 * Stratégie : positionner Elite Turf comme LE site turf de l'Afrique
 * francophone. Concurrents européens (Geny, Zone-Turf, Paris-Turf)
 * ignorent ce marché — c'est un océan bleu de plusieurs millions de
 * parieurs francophones.
 *
 * Devises ISO 4217 :
 *  - XOF : Franc CFA Afrique de l'Ouest (CI, SN, ML, BF, BJ, NE, TG)
 *  - XAF : Franc CFA Afrique Centrale (CM, GA, CG, TD, CF, GQ)
 *  - MAD : Dirham marocain
 *  - EUR : Euro (default fallback)
 */

export interface PaymentMethod {
  nom:        string;
  description: string;
  icon:       string;       // emoji ou code
  /**
   * Si true, affiche un badge "Bientôt" sur la card.
   * Utilisé pour les pays où Paystack ne couvre pas encore le Mobile Money
   * (mais qu'on veut quand même montrer pour le SEO + perception).
   */
  bientot?:   boolean;
}

export interface Country {
  code:        string;        // ISO 3166-1 alpha-2 (uppercase)
  slug:        string;        // pour URL /pronostics-pmu-[slug]
  nom:         string;
  nomComplet:  string;        // "République de Côte d'Ivoire"
  drapeau:     string;        // emoji
  /**
   * Devise d'AFFICHAGE actuelle (utilisée par formatPrice et PriceDualCurrency).
   * Pour les pays où Paystack ne couvre pas encore le paiement local → on met
   * "EUR" pour ne pas tromper l'utilisateur sur la conversion automatique au
   * checkout. On activera la devise locale au cas par cas quand le paiement
   * local sera opérationnel (FedaPay, Hub2, CinetPay, etc.).
   */
  devise:      "XOF" | "XAF" | "MAD" | "EUR";
  /**
   * Devise NATIVE réelle du pays (informative, pour migration future).
   * Ex: Madagascar → "MGA", Burkina → "XOF". Quand le paiement local sera prêt,
   * on basculera `devise = deviseNative`.
   */
  deviseNative?: "XOF" | "XAF" | "MAD" | "EUR" | "MGA";
  capitale:    string;
  // Opérateur officiel local de courses (pour mention contextuelle)
  operateurOfficiel?: {
    nom:     string;
    site:    string;          // URL
    courte:  string;          // courte description
  };
  // Méthodes de paiement utilisées dans le pays
  paiements:   PaymentMethod[];
  // Mots-clés SEO ciblés pour ce pays
  motsCles:    string[];
  // Phrase d'accroche localisée (peut intégrer du pidgin/wolof/etc plus tard)
  accroche:    string;
  // Lien direct PMU local
  liensPMU?: Array<{ label: string; href: string }>;
}

export const COUNTRIES: Country[] = [
  {
    code:       "CI",
    slug:       "cote-d-ivoire",
    nom:        "Côte d'Ivoire",
    nomComplet: "République de Côte d'Ivoire",
    drapeau:    "🇨🇮",
    devise:     "XOF",
    capitale:   "Abidjan",
    operateurOfficiel: {
      nom:    "PMU-CI / LONACI",
      site:   "https://www.pmu.ci",
      courte: "Loterie Nationale de Côte d'Ivoire — opérateur officiel",
    },
    paiements: [
      { nom: "Orange Money CI", description: "Paiement instantané via mobile",      icon: "🟧" },
      { nom: "MTN MoMo",        description: "MTN Mobile Money — opérateur Telecel", icon: "🟨" },
      { nom: "Wave",            description: "Wave Money — frais réduits",          icon: "🌊" },
      { nom: "Moov Money",      description: "Moov Africa Mobile Money",            icon: "🟥" },
    ],
    motsCles: [
      "pronostic PMU Côte d'Ivoire",
      "pronostic Quinté+ Abidjan",
      "PMU-CI pronostic",
      "LONACI pronostic",
      "courses PMU Abidjan",
      "Quinté+ Côte d'Ivoire",
    ],
    accroche: "Pronostics PMU France et courses LONACI analysés depuis Paris pour les parieurs de Côte d'Ivoire.",
    liensPMU: [
      { label: "PMU-CI / LONACI",     href: "https://www.pmu.ci" },
      { label: "Hippodrome de la Riviera (Abidjan)", href: "https://www.lonaci.ci" },
    ],
  },
  {
    code:       "SN",
    slug:       "senegal",
    nom:        "Sénégal",
    nomComplet: "République du Sénégal",
    drapeau:    "🇸🇳",
    devise:     "XOF",
    capitale:   "Dakar",
    operateurOfficiel: {
      nom:    "LONASE",
      site:   "https://www.lonase.sn",
      courte: "Loterie Nationale Sénégalaise — opérateur officiel courses PMU",
    },
    paiements: [
      { nom: "Wave Sénégal",  description: "Wave Money — leader local",     icon: "🌊" },
      { nom: "Orange Money",  description: "Orange Money Sénégal",          icon: "🟧" },
      { nom: "Free Money",    description: "Free Sénégal Mobile Money",     icon: "🟦" },
      { nom: "Wari",          description: "Solution paiement Wari",         icon: "🟫" },
    ],
    motsCles: [
      "pronostic PMU Sénégal",
      "pronostic Quinté+ Dakar",
      "LONASE pronostic",
      "courses PMU Dakar",
      "Quinté+ Sénégal",
    ],
    accroche: "Pronostics PMU France pour les parieurs sénégalais — courses jouables via LONASE.",
    liensPMU: [
      { label: "LONASE", href: "https://www.lonase.sn" },
    ],
  },
  {
    code:       "CM",
    slug:       "cameroun",
    nom:        "Cameroun",
    nomComplet: "République du Cameroun",
    drapeau:    "🇨🇲",
    devise:     "XAF",
    capitale:   "Yaoundé",
    operateurOfficiel: {
      nom:    "PMUC",
      site:   "https://www.pmuc.cm",
      courte: "Pari Mutuel Urbain Camerounais — opérateur officiel",
    },
    paiements: [
      { nom: "Orange Money CM",  description: "Orange Money Cameroun",        icon: "🟧" },
      { nom: "MTN MoMo CM",      description: "MTN Mobile Money Cameroun",    icon: "🟨" },
      { nom: "Express Union",    description: "Solution paiement EU",          icon: "🟦" },
    ],
    motsCles: [
      "pronostic PMU Cameroun",
      "pronostic Quinté+ Yaoundé Douala",
      "PMUC pronostic",
      "courses PMU Cameroun",
    ],
    accroche: "Pronostics PMU France analysés pour les turfistes camerounais — Quinté+, Tiercé, Quarté+.",
    liensPMU: [
      { label: "PMUC Cameroun", href: "https://www.pmuc.cm" },
    ],
  },
  {
    code:       "MA",
    slug:       "maroc",
    nom:        "Maroc",
    nomComplet: "Royaume du Maroc",
    drapeau:    "🇲🇦",
    devise:     "MAD",
    capitale:   "Rabat",
    operateurOfficiel: {
      nom:    "MDJS / SOREC",
      site:   "https://www.mdjs.ma",
      courte: "Marocaine des Jeux et Sports + Société Royale d'Encouragement du Cheval",
    },
    paiements: [
      { nom: "Carte bancaire MA",  description: "CMI / paiement carte",   icon: "💳" },
      { nom: "Cash Plus",          description: "Solution paiement cash", icon: "💵" },
      { nom: "Wafacash",           description: "Wafacash transfert",     icon: "🟦" },
    ],
    motsCles: [
      "pronostic PMU Maroc",
      "pronostic Quinté+ Casablanca Rabat",
      "MDJS pronostic",
      "SOREC pronostic",
      "Hippodrome Casablanca Anfa",
    ],
    accroche: "Pronostics PMU France et courses marocaines (SOREC) pour les parieurs du Royaume.",
    liensPMU: [
      { label: "MDJS",  href: "https://www.mdjs.ma" },
      { label: "SOREC", href: "https://www.sorec.ma" },
    ],
  },
  {
    code:       "ML",
    slug:       "mali",
    nom:        "Mali",
    nomComplet: "République du Mali",
    drapeau:    "🇲🇱",
    devise:     "XOF",
    capitale:   "Bamako",
    operateurOfficiel: {
      nom:    "LONAB-Mali (réseau régional)",
      site:   "https://www.pmu.fr",
      courte: "Pas d'opérateur officiel courses au Mali — jeu via LONACI ou agences",
    },
    paiements: [
      { nom: "Orange Money ML",   description: "Orange Money Mali",     icon: "🟧" },
      { nom: "Moov Money",        description: "Moov Africa",           icon: "🟥" },
    ],
    motsCles: [
      "pronostic PMU Mali",
      "pronostic Quinté+ Bamako",
      "courses PMU Mali",
    ],
    accroche: "Pronostics PMU France pour les turfistes maliens — analyse experte des courses françaises.",
  },

  // ────────────────────────────────────────────────────────────────────
  // 🆕 Pays ajoutés (mai 2026) — devise EUR par défaut tant que les
  // moyens de paiement Mobile Money locaux ne sont pas opérationnels via
  // Paystack. La `deviseNative` est conservée pour migration future.
  // Les paiements Mobile Money sont listés avec `bientot: true` pour
  // signaler clairement que c'est en cours d'activation.
  // ────────────────────────────────────────────────────────────────────

  {
    code:         "BF",
    slug:         "burkina-faso",
    nom:          "Burkina Faso",
    nomComplet:   "Burkina Faso",
    drapeau:      "🇧🇫",
    devise:       "EUR",
    deviseNative: "XOF",
    capitale:     "Ouagadougou",
    operateurOfficiel: {
      nom:    "PMU'B / LONAB",
      site:   "https://www.lonab.bf",
      courte: "Loterie Nationale Burkinabè — opérateur officiel des courses PMU",
    },
    paiements: [
      { nom: "Orange Money BF", description: "Orange Money Burkina Faso", icon: "🟧", bientot: true },
      { nom: "Moov Money BF",   description: "Moov Africa Burkina",       icon: "🟥", bientot: true },
      { nom: "Carte bancaire",  description: "Visa / Mastercard",          icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Burkina Faso",
      "pronostic Quinté+ Ouagadougou",
      "PMU'B pronostic",
      "LONAB pronostic",
      "courses PMU Burkina",
    ],
    accroche: "Pronostics PMU France pour les parieurs burkinabè — analyses expertes accessibles depuis Ouagadougou et tout le Burkina.",
    liensPMU: [
      { label: "PMU'B / LONAB", href: "https://www.lonab.bf" },
    ],
  },

  {
    code:         "TD",
    slug:         "tchad",
    nom:          "Tchad",
    nomComplet:   "République du Tchad",
    drapeau:      "🇹🇩",
    devise:       "EUR",
    deviseNative: "XAF",
    capitale:     "N'Djamena",
    paiements: [
      { nom: "Airtel Money TD", description: "Airtel Money Tchad",  icon: "🟥", bientot: true },
      { nom: "Moov Money TD",   description: "Moov Africa Tchad",   icon: "🟧", bientot: true },
      { nom: "Carte bancaire",  description: "Visa / Mastercard",   icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Tchad",
      "pronostic Quinté+ N'Djamena",
      "courses PMU Tchad",
      "Quinté+ Tchad",
    ],
    accroche: "Pronostics PMU France pour les turfistes tchadiens — analyses expertes des courses françaises livrées chaque matin.",
  },

  {
    code:         "GA",
    slug:         "gabon",
    nom:          "Gabon",
    nomComplet:   "République Gabonaise",
    drapeau:      "🇬🇦",
    devise:       "EUR",
    deviseNative: "XAF",
    capitale:     "Libreville",
    paiements: [
      { nom: "Airtel Money GA", description: "Airtel Money Gabon",   icon: "🟥", bientot: true },
      { nom: "Mobicash",        description: "Mobicash Gabon",       icon: "🟦", bientot: true },
      { nom: "Carte bancaire",  description: "Visa / Mastercard",    icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Gabon",
      "pronostic Quinté+ Libreville",
      "courses PMU Gabon",
      "Quinté+ Gabon",
    ],
    accroche: "Pronostics PMU France pour les parieurs gabonais — décryptage Quinté+, Tiercé, Quarté+ par nos experts depuis Paris.",
  },

  {
    code:         "TG",
    slug:         "togo",
    nom:          "Togo",
    nomComplet:   "République Togolaise",
    drapeau:      "🇹🇬",
    devise:       "EUR",
    deviseNative: "XOF",
    capitale:     "Lomé",
    operateurOfficiel: {
      nom:    "LONATO",
      site:   "https://www.lonato.tg",
      courte: "Loterie Nationale Togolaise — opérateur officiel des paris hippiques",
    },
    paiements: [
      { nom: "TMoney (Togocom)", description: "Mobile Money Togocom", icon: "🟦", bientot: true },
      { nom: "Flooz (Moov)",     description: "Mobile Money Moov",    icon: "🟥", bientot: true },
      { nom: "Carte bancaire",   description: "Visa / Mastercard",    icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Togo",
      "pronostic Quinté+ Lomé",
      "LONATO pronostic",
      "courses PMU Togo",
    ],
    accroche: "Pronostics PMU France pour les turfistes togolais — courses jouables via LONATO ou agences agréées.",
    liensPMU: [
      { label: "LONATO", href: "https://www.lonato.tg" },
    ],
  },

  {
    code:         "CG",
    slug:         "congo-brazzaville",
    nom:          "Congo Brazzaville",
    nomComplet:   "République du Congo",
    drapeau:      "🇨🇬",
    devise:       "EUR",
    deviseNative: "XAF",
    capitale:     "Brazzaville",
    paiements: [
      { nom: "Airtel Money CG", description: "Airtel Money Congo",    icon: "🟥", bientot: true },
      { nom: "MTN MoMo CG",     description: "MTN Mobile Money Congo", icon: "🟨", bientot: true },
      { nom: "Carte bancaire",  description: "Visa / Mastercard",      icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Congo",
      "pronostic Quinté+ Brazzaville",
      "courses PMU Congo",
      "Quinté+ Congo Brazzaville",
    ],
    accroche: "Pronostics PMU France pour les parieurs congolais — analyses expertes depuis Paris pour Brazzaville et tout le Congo.",
  },

  {
    code:         "MG",
    slug:         "madagascar",
    nom:          "Madagascar",
    nomComplet:   "République de Madagascar",
    drapeau:      "🇲🇬",
    devise:       "EUR",
    deviseNative: "MGA",
    capitale:     "Antananarivo",
    paiements: [
      { nom: "Mvola (Telma)",     description: "Mobile Money Telma",    icon: "🟧", bientot: true },
      { nom: "Orange Money MG",   description: "Orange Money Madagascar", icon: "🟧", bientot: true },
      { nom: "Airtel Money MG",   description: "Airtel Money Madagascar", icon: "🟥", bientot: true },
      { nom: "Carte bancaire",    description: "Visa / Mastercard",     icon: "💳" },
    ],
    motsCles: [
      "pronostic PMU Madagascar",
      "pronostic Quinté+ Antananarivo",
      "tiercé Madagascar",
      "courses PMU Madagascar",
      "PMU Tana",
    ],
    accroche: "Pronostics PMU France pour les turfistes malgaches — analyses expertes accessibles depuis Antananarivo et toute la Grande Île.",
  },

  {
    code:         "RE",
    slug:         "reunion",
    nom:          "La Réunion",
    nomComplet:   "Département de La Réunion (974)",
    drapeau:      "🇷🇪",
    devise:       "EUR",
    deviseNative: "EUR",
    capitale:     "Saint-Denis",
    operateurOfficiel: {
      nom:    "PMU France",
      site:   "https://www.pmu.fr",
      courte: "PMU France — opérateur officiel (La Réunion = département français)",
    },
    paiements: [
      { nom: "Carte bancaire", description: "Visa / Mastercard / CB française", icon: "💳" },
      { nom: "Virement SEPA",  description: "Virement bancaire européen",       icon: "🏦" },
      { nom: "PayPal",         description: "Paiement sécurisé PayPal",         icon: "🟦" },
    ],
    motsCles: [
      "pronostic PMU Réunion",
      "pronostic Quinté+ Réunion 974",
      "turf Réunion",
      "PMU 974",
      "courses PMU département Réunion",
    ],
    accroche: "Pronostics PMU France pour les turfistes réunionnais — analyses expertes des courses du jour pour jouer depuis le 974.",
    liensPMU: [
      { label: "PMU France", href: "https://www.pmu.fr" },
    ],
  },
];

/** Map devise → conversion EUR (taux indicatif, à actualiser via API forex). */
export const FX_RATES: Record<Country["devise"], number> = {
  EUR: 1,
  XOF: 655.957,    // taux fixe BCEAO depuis 1999
  XAF: 655.957,    // taux fixe BEAC depuis 1999
  MAD: 10.95,      // taux moyen 2026 (variable, à actualiser)
};

/** Symbole/abréviation pour affichage prix. */
export const DEVISE_SYMBOL: Record<Country["devise"], string> = {
  EUR: "€",
  XOF: "FCFA",
  XAF: "FCFA",
  MAD: "DH",
};

/** Mapping ISO code → Country pour détection rapide via header CF-IPCountry. */
export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

/** Mapping slug URL → Country pour les routes. */
export const COUNTRY_BY_SLUG: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c]),
);

/** Liste des codes pays utilisant le franc CFA Ouest (BCEAO). */
export const XOF_COUNTRIES = ["CI", "SN", "ML", "BF", "BJ", "NE", "TG"];
/** Liste des codes pays utilisant le franc CFA Centre (BEAC). */
export const XAF_COUNTRIES = ["CM", "GA", "CG", "TD", "CF", "GQ"];

/** Détecte le pays via header CF-IPCountry envoyé par Cloudflare. */
export function getCountryFromCFHeader(header: string | null): Country | null {
  if (!header) return null;
  const code = header.toUpperCase();
  return COUNTRY_BY_CODE[code] ?? null;
}

/** Convertit prix EUR → devise locale, arrondi correctement. */
export function convertPrice(eur: number, devise: Country["devise"]): { value: number; symbol: string } {
  const rate = FX_RATES[devise];
  const raw = eur * rate;
  // FCFA arrondi à la centaine pour rendre les prix lisibles localement
  const value = devise === "XOF" || devise === "XAF"
    ? Math.round(raw / 500) * 500
    : Math.round(raw * 100) / 100;
  return { value, symbol: DEVISE_SYMBOL[devise] };
}

/** Format prix pour affichage UI (ex: "65 €", "42 500 FCFA", "120 DH"). */
export function formatPrice(eur: number, devise: Country["devise"]): string {
  const { value, symbol } = convertPrice(eur, devise);
  if (devise === "XOF" || devise === "XAF") {
    return `${value.toLocaleString("fr-FR")} ${symbol}`;
  }
  return `${value.toLocaleString("fr-FR")} ${symbol}`;
}
