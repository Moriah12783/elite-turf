import Link from "next/link";
import { Lock, Star, ChevronRight, Eye, Trophy, Flame, MapPin, Clock, TrendingUp, Zap } from "lucide-react";

// ── Vedette du jour ──────────────────────────────────────────────
const vedette = {
  cheval:       "Star Kingdom",
  numero:        3,
  hippodrome:   "Longchamp",
  course:       "Prix de la Forêt — R1C4",
  heure:        "14:30",
  cote:         "4.20",
  type:         "Quinté+",
  confiance:    5,
  analyse:
    "Star Kingdom sort d'une victoire convaincante à 1 400 m et affiche la meilleure forme de sa carrière. Conditions de piste idéales, jockey en feu sur 5 sorties.",
  gain_potentiel: "+380%",
};

// Mock data — sera remplacé par les données Supabase
const pronostics = [
  {
    id: "1",
    course: "R1C4 — Prix de la Forêt — Longchamp",
    heure: "14:30",
    type: "Tiercé",
    niveau: "GRATUIT",
    selection: [3, 7, 1],
    nbEtoiles: 4,
    analyseCourteg:
      "Le 3 (Star Kingdom) sort d'une victoire convaincante à 1400m. Le 7 présente une montée en forme notable. Tiercé conseillé dans l'ordre.",
    nb_vues: 1243,
  },
  {
    id: "2",
    course: "R2C6 — Grand Prix de Vincennes — Vincennes",
    heure: "16:00",
    type: "Quarté+",
    niveau: "PREMIUM",
    selection: [4, 11, 2, 8],
    nbEtoiles: 3,
    analyseCourteg:
      "Analyse complète réservée aux abonnés Pro et Elite. Sélection experte avec ratio gain/risque optimisé.",
    nb_vues: 876,
  },
  {
    id: "3",
    course: "R3C2 — Prix de la Méditerranée — Cagnes",
    heure: "17:15",
    type: "Simple Gagnant",
    niveau: "GRATUIT",
    selection: [6],
    nbEtoiles: 3,
    analyseCourteg:
      "Le 6 (Mistral d'Azur) domine largement cette catégorie. Cote actuelle intéressante à 4.5. Valeur sûre du jour.",
    nb_vues: 654,
  },
];

export default function PronosticsSection() {
  return (
    <section className="py-16 sm:py-20 bg-bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── CARTE VEDETTE DU JOUR ── */}
        <div className="relative rounded-2xl overflow-hidden mb-10 border border-gold-primary/40 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card shadow-gold">

          {/* Image de fond subtile */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1200&q=80"
              alt="Cheval vedette"
              className="w-full h-full object-cover opacity-15"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-card/95 via-bg-card/80 to-bg-card/95" />
          </div>

          {/* Ligne dorée haut */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />

          <div className="relative z-10 p-6 sm:p-8">
            {/* Badge VEDETTE DU JOUR */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-primary text-bg-primary rounded-full font-bold text-xs uppercase tracking-widest shadow-gold">
                <Zap className="w-3.5 h-3.5" fill="currentColor" />
                Vedette du Jour
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-status-win/10 border border-status-win/25 text-status-win text-xs font-semibold rounded-full">
                <TrendingUp className="w-3 h-3" />
                {vedette.gain_potentiel} potentiel
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                {vedette.type}
              </span>
            </div>

            <div className="sm:flex sm:items-start sm:gap-8">

              {/* Numéro dossard + nom cheval */}
              <div className="flex items-center gap-4 mb-5 sm:mb-0 sm:flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gold-faint border-2 border-gold-primary/60 flex flex-col items-center justify-center shadow-gold">
                  <span className="text-xs text-gold-light/70 uppercase tracking-wider leading-none mb-0.5">N°</span>
                  <span className="text-3xl font-bold font-serif text-gold-primary leading-none">
                    {vedette.numero}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary leading-tight">
                    {vedette.cheval}
                  </h3>
                  {/* Étoiles de confiance */}
                  <div className="flex items-center gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3.5 h-3.5"
                        fill={i < vedette.confiance ? "#C9A84C" : "transparent"}
                        color={i < vedette.confiance ? "#C9A84C" : "#3A3A50"}
                      />
                    ))}
                    <span className="text-gold-light text-xs ml-1 font-medium">Confiance max</span>
                  </div>
                </div>
              </div>

              {/* Infos course + analyse */}
              <div className="flex-1">
                {/* Hippodrome / heure / cote */}
                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <MapPin className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    {vedette.hippodrome} — {vedette.course}
                  </div>
                  <div className="flex items-center gap-1.5 text-gold-light font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {vedette.heure}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-elevated border border-border rounded-lg">
                    <span className="text-text-muted text-xs">Cote</span>
                    <span className="text-text-primary font-bold text-sm">{vedette.cote}</span>
                  </div>
                </div>

                {/* Analyse courte */}
                <p className="text-text-secondary text-sm leading-relaxed mb-5 italic border-l-2 border-gold-primary/40 pl-3">
                  &ldquo;{vedette.analyse}&rdquo;
                </p>

                {/* CTA */}
                <Link
                  href="/pronostics"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
                >
                  <Trophy className="w-4 h-4" />
                  Voir l&apos;analyse complète
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Ligne dorée bas */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
        </div>

        {/* ── BANNIÈRE VISUELLE avec cheval en action ── */}
        <div className="relative rounded-2xl overflow-hidden mb-12">
          {/* Image principale */}
          <img
            src="https://images.unsplash.com/photo-1526094633853-031707a44819?w=1200&q=80"
            alt="Chevaux au galop"
            className="w-full h-48 object-cover rounded-xl mb-0"
          />
          {/* Overlay foncé */}
          <div className="absolute inset-0 bg-bg-primary/65" />
          {/* Gradient latéral */}
          <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/80 via-transparent to-bg-primary/80" />

          {/* Contenu par-dessus la bannière */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-gold-primary" fill="currentColor" />
              <span className="text-gold-light text-sm font-medium uppercase tracking-widest">
                Nos Experts
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-text-primary drop-shadow-lg mb-2">
              Pronostics du Jour
            </h2>
            <p className="text-text-secondary text-sm sm:text-base max-w-lg">
              Analyses approfondies par nos spécialistes hippiques.{" "}
              <span className="text-gold-light">73% de réussite ce mois.</span>
            </p>

            {/* Badges stats */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/70 backdrop-blur-sm border border-gold-primary/30 rounded-full">
                <Flame className="w-3.5 h-3.5 text-gold-primary" />
                <span className="text-gold-light text-xs font-semibold">3 pronostics ce jour</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-status-win/20 backdrop-blur-sm border border-status-win/30 rounded-full">
                <Trophy className="w-3.5 h-3.5 text-status-win" />
                <span className="text-status-win text-xs font-semibold">Hier : 2/3 gagnants</span>
              </div>
            </div>
          </div>
        </div>

        {/* En-tête section + lien "tout voir" */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-text-secondary text-sm">
            Pronostics disponibles aujourd&apos;hui
          </p>
          <Link
            href="/pronostics"
            className="hidden sm:flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors"
          >
            Tous les pronostics <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Liste des pronostics ── */}
        <div className="space-y-4">
          {pronostics.map((p) => (
            <div
              key={p.id}
              className="card-base p-5 sm:p-6 relative overflow-hidden"
            >
              {/* Shimmer premium */}
              {p.niveau === "PREMIUM" && (
                <div className="absolute inset-0 shimmer-bg pointer-events-none" />
              )}

              <div className="relative z-10">
                {/* Badges + étoiles */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                      p.niveau === "GRATUIT"
                        ? "bg-status-win/10 text-status-win border-status-win/20"
                        : "bg-gold-faint text-gold-light border-gold-primary/30"
                    }`}
                  >
                    {p.niveau === "GRATUIT" ? "GRATUIT" : "★ PREMIUM"}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                    {p.type}
                  </span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {[...Array(4)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3.5 h-3.5"
                        fill={i < p.nbEtoiles ? "#C9A84C" : "transparent"}
                        color={i < p.nbEtoiles ? "#C9A84C" : "#3A3A50"}
                      />
                    ))}
                    <span className="text-text-muted text-xs ml-1.5">Confiance</span>
                  </div>
                </div>

                {/* Course */}
                <p className="text-text-secondary text-sm mb-3 font-medium">
                  📍 {p.course} —{" "}
                  <span className="text-gold-light">{p.heure}</span>
                </p>

                {/* Sélection */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-text-muted text-xs uppercase tracking-wider">
                    Sélection :
                  </span>
                  {p.niveau === "GRATUIT" ? (
                    <div className="flex items-center gap-2">
                      {p.selection.map((n) => (
                        <span
                          key={n}
                          className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-sm"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {p.selection.map((n, i) => (
                        <span
                          key={i}
                          className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted font-bold text-sm paywall-blur"
                        >
                          {n}
                        </span>
                      ))}
                      <Lock className="w-4 h-4 text-gold-primary ml-1" />
                    </div>
                  )}
                </div>

                {/* Analyse */}
                {p.niveau === "GRATUIT" ? (
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">
                    {p.analyseCourteg}
                  </p>
                ) : (
                  <div className="relative mb-4">
                    <p className="text-text-secondary text-sm leading-relaxed paywall-blur select-none">
                      {p.analyseCourteg}
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link
                        href="/abonnements"
                        className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-lg transition-colors shadow-gold"
                      >
                        <Lock className="w-4 h-4" />
                        Débloquer l&apos;analyse
                      </Link>
                    </div>
                  </div>
                )}

                {/* Pied de carte */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1 text-text-muted text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    {p.nb_vues.toLocaleString("fr-CI")} vues
                  </div>
                  <Link
                    href={`/pronostics/${p.id}`}
                    className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-medium transition-colors"
                  >
                    Détail complet <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA abonnement */}
        <div className="mt-10 text-center">
          <Link
            href="/abonnements"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold"
          >
            <Star className="w-5 h-5" fill="currentColor" />
            Accéder à tous les pronostics Premium
          </Link>
          <p className="mt-3 text-text-muted text-xs">
            Paiement par Orange Money, MTN MoMo, Wave · Accès immédiat
          </p>
        </div>
      </div>
    </section>
  );
}
