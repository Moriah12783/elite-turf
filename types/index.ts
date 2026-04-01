export type UserRole = "USER" | "ADMIN" | "MODERATEUR";
export type SubscriptionStatus = "GRATUIT" | "PREMIUM" | "VIP" | "EXPIRE";
export type PlanName = "Starter" | "Pro" | "Elite";
export type PaymentMethod = "ORANGE_MONEY" | "MTN_MOMO" | "WAVE" | "STRIPE" | "PAYPAL";
export type PaymentStatus = "EN_ATTENTE" | "SUCCES" | "ECHEC" | "REMBOURSE";
export type PronosticLevel = "GRATUIT" | "PREMIUM" | "VIP";
export type BetType = "SIMPLE" | "COUPLE" | "TRIO" | "TIERCE" | "QUARTE" | "QUINTE_PLUS";
export type Confidence = "FAIBLE" | "MOYEN" | "ELEVE" | "TRES_ELEVE";
export type PronosticResult = "GAGNANT" | "PERDANT" | "PARTIEL" | "EN_ATTENTE";
export type CourseStatus = "PROGRAMME" | "EN_COURS" | "TERMINE" | "ANNULE";
export type CourseCategory = "PLAT" | "TROT" | "OBSTACLE";
export type Terrain = "BON" | "BON_SOUPLE" | "SOUPLE" | "LOURD" | "TRES_LOURD";

export interface User {
  id: string;
  email: string;
  phone?: string;
  nom_complet?: string;
  pays?: string;
  ville?: string;
  avatar_url?: string;
  role: UserRole;
  statut_abonnement: SubscriptionStatus;
  date_inscription: string;
  actif: boolean;
}

export interface Plan {
  id: string;
  nom: PlanName;
  prix_fcfa: number;
  prix_eur: number;
  duree_jours: number;
  acces_premium: boolean;
  acces_vip: boolean;
  nb_alertes: number;
  description: string;
  features: string[];
  actif: boolean;
  populaire?: boolean;
}

export interface Abonnement {
  id: string;
  user_id: string;
  plan_id: string;
  date_debut: string;
  date_fin: string;
  statut: "ACTIF" | "EXPIRE" | "SUSPENDU" | "OFFERT";
  auto_renouvellement: boolean;
  plan?: Plan;
}

export interface Transaction {
  id: string;
  user_id: string;
  abonnement_id?: string;
  montant_fcfa: number;
  devise: string;
  methode: PaymentMethod;
  reference_operateur?: string;
  statut: PaymentStatus;
  date_transaction: string;
}

export interface Hippodrome {
  id: string;
  nom: string;
  pays: string;
  ville: string;
  fuseau_horaire: string;
  actif: boolean;
}

export interface Course {
  id: string;
  hippodrome_id: string;
  date_course: string;
  heure_depart: string;
  numero_reunion: number;
  numero_course: number;
  libelle: string;
  distance_metres: number;
  categorie: CourseCategory;
  terrain?: Terrain;
  nb_partants: number;
  statut: CourseStatus;
  arrivee_officielle?: number[];
  hippodrome?: Hippodrome;
  partants?: Partant[];
  pronostics?: Pronostic[];
}

export interface Cheval {
  id: string;
  nom: string;
  age: number;
  sexe: "MALE" | "FEMELLE" | "HONGRE";
  robe?: string;
  nb_victoires: number;
  nb_courses: number;
  photo_url?: string;
}

export interface Jockey {
  id: string;
  nom_complet: string;
  nationalite?: string;
  nb_victoires_saison: number;
  taux_victoire_pct: number;
  photo_url?: string;
}

export interface Partant {
  id: string;
  course_id: string;
  cheval_id: string;
  jockey_id?: string;
  numero_partant: number;
  cote_depart?: number;
  cote_derniere?: number;
  poids_kg?: number;
  classement_final?: number;
  non_partant: boolean;
  cheval?: Cheval;
  jockey?: Jockey;
}

export interface Pronostic {
  id: string;
  course_id: string;
  auteur_id: string;
  niveau_acces: PronosticLevel;
  type_pari: BetType;
  selection: number[];
  confiance: Confidence;
  analyse_texte?: string;
  analyse_courte: string;
  publie: boolean;
  date_publication?: string;
  resultat: PronosticResult;
  nb_vues: number;
  nb_likes: number;
  course?: Course;
}

export interface StatsGlobales {
  total_pronostics: number;
  taux_reussite: number;
  taux_reussite_semaine: number;
  taux_reussite_mois: number;
  total_membres: number;
  total_premium: number;
}

// UI helpers
export const CONFIDENCE_CONFIG: Record<Confidence, { label: string; stars: number; color: string }> = {
  FAIBLE: { label: "Faible", stars: 1, color: "text-status-pending" },
  MOYEN: { label: "Moyen", stars: 2, color: "text-status-partial" },
  ELEVE: { label: "Élevé", stars: 3, color: "text-gold-primary" },
  TRES_ELEVE: { label: "Très élevé", stars: 4, color: "text-status-win" },
};

export const BET_TYPE_LABELS: Record<BetType, string> = {
  SIMPLE: "Simple Gagnant",
  COUPLE: "Couplé",
  TRIO: "Trio",
  TIERCE: "Tiercé",
  QUARTE: "Quarté+",
  QUINTE_PLUS: "Quinté+",
};

export const PLAN_CONFIG: Plan[] = [
  {
    id: "starter",
    nom: "Starter",
    prix_fcfa: 42637,  // 65€ × 655.957 XOF
    prix_eur: 65,      // PACK DÉCOUVERTE
    duree_jours: 7,
    acces_premium: true,
    acces_vip: false,
    nb_alertes: 5,
    description: "7 jours pour tester l'excellence",
    features: [
      "🎁 Essai 7 jours — accès immédiat",
      "~70% de réussite sur nos sélections",
      "3 pronostics Tiercé / Quarté par semaine",
      "Analyse courte incluse",
      "5 alertes SMS/Push",
      "Résiliable à tout moment",
    ],
    actif: true,
  },
  {
    id: "pro",
    nom: "Pro",
    prix_fcfa: 99705,  // 152€ × 655.957 XOF
    prix_eur: 152,     // PACK PERFORMANCE
    duree_jours: 30,
    acces_premium: true,
    acces_vip: false,
    nb_alertes: 20,
    description: "Le choix des gagnants réguliers",
    features: [
      "~82% de réussite sur Quarté & Quinté+",
      "Pronostics illimités (Tiercé, Quarté+, Quinté+)",
      "Fiches d'analyse détaillées",
      "Alerte Dernière Minute par Email",
      "20 alertes SMS/Push par mois",
      "Statistiques complètes",
      "Support WhatsApp 48h",
      "Résiliable à tout moment",
    ],
    actif: true,
    populaire: true,
  },
  {
    id: "elite",
    nom: "Elite",
    prix_fcfa: 136439, // 208€ × 655.957 XOF
    prix_eur: 208,     // PACK ELITE
    duree_jours: 90,
    acces_premium: true,
    acces_vip: true,
    nb_alertes: -1,
    description: "L'excellence sans compromis",
    features: [
      "+92% de précision sur nos sélections VIP",
      "Tout Pack Performance inclus",
      "Pronostics VIP exclusifs (sélection réduite)",
      "Tuyaux WhatsApp Dernière Minute",
      "Gestion de mise personnalisée",
      "Alertes illimitées",
      "Export statistiques (Excel/PDF)",
      "Support WhatsApp prioritaire",
      "💰 Économisez 30% vs abonnement mensuel",
    ],
    actif: true,
  },
];
