"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, ArrowRight, Loader2, Lock, TrendingUp, Users, BarChart2 } from "lucide-react";

const SECRETS = [
  { num: "01", titre: "Décrypter la Musique du Cheval", texte: "Au-delà des chiffres — comment lire un CV de cheval comme un pro." },
  { num: "02", titre: "Le Coefficient Jockey/Entraîneur", texte: "Au turf, 1+1=3. Comment repérer les associations gagnantes avant les autres." },
  { num: "03", titre: "Le Déferrage : Le Turbo du Trotteur", texte: "Le facteur le plus sous-estimé par les débutants. D4 première fois = signal fort." },
  { num: "04", titre: "La Règle des 5% de Bankroll", texte: "Le secret pour ne jamais tout perdre. La méthode de gestion des pros." },
  { num: "05", titre: "L'Analyse de la Dernière Minute", texte: "Comment les mouvements de cotes révèlent l'argent intelligent 15 min avant le départ." },
];

export default function GuideInitiePage() {
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guide/telechargement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nom }),
      });

      if (!res.ok) throw new Error("Erreur serveur");
      setDone(true);
    } catch {
      setError("Une erreur est survenue. Réessayez ou contactez-nous.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1526094633853-031707a44819?w=1400&q=80"
            alt="Guide PMU EliteTurf"
            className="w-full h-full object-cover opacity-8"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/85 to-bg-primary" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/60 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/40 rounded-full mb-6">
            <BookOpen className="w-4 h-4 text-gold-primary" />
            <span className="text-gold-light text-xs font-bold uppercase tracking-wide">
              Guide Gratuit — 8 pages
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-text-primary mb-4 leading-tight">
            5 Secrets d&apos;Experts pour Détecter<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)" }}
            >
              les Outsiders Gagnants
            </span>
          </h1>

          <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-4">
            Le PMU n&apos;est pas un jeu de hasard, c&apos;est une bataille d&apos;informations.
          </p>
          <p className="text-text-muted text-sm mb-10">
            Par <span className="text-gold-light font-medium">Stéphane Y.</span> — Fondateur EliteTurf · Paris
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {[
              { icon: Users, label: "847+ parieurs formés" },
              { icon: TrendingUp, label: "73% de taux de réussite" },
              { icon: BarChart2, label: "100% gratuit" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-text-muted text-sm">
                <s.icon className="w-4 h-4 text-gold-primary" />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* ── CONTENU DU GUIDE ── */}
          <div>
            <h2 className="font-serif text-xl font-bold text-text-primary mb-6">
              Ce que vous allez apprendre
            </h2>
            <div className="space-y-4">
              {SECRETS.map((s, i) => (
                <div key={i} className="flex items-start gap-4 p-4 card-base">
                  <span className="text-gold-primary font-bold font-serif text-lg flex-shrink-0 w-8">
                    {s.num}
                  </span>
                  <div>
                    <p className="font-semibold text-text-primary text-sm mb-1">{s.titre}</p>
                    <p className="text-text-muted text-xs leading-relaxed">{s.texte}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gold-faint border border-gold-primary/20 rounded-xl">
              <p className="text-text-secondary text-sm leading-relaxed">
                <span className="text-gold-light font-semibold">+ Bonus :</span>{" "}
                Offre exclusive EliteTurf réservée aux téléchargeurs du guide.
                Accès à nos pronostics quotidiens dès la réception.
              </p>
            </div>
          </div>

          {/* ── FORMULAIRE ── */}
          <div className="lg:sticky lg:top-24">
            {done ? (
              <div className="card-base p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-status-win/10 border border-status-win/30 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-status-win" />
                </div>
                <h3 className="font-serif text-xl font-bold text-text-primary mb-3">
                  Guide envoyé !
                </h3>
                <p className="text-text-secondary text-sm mb-6">
                  Vérifiez votre boîte email (et vos spams). Le guide arrive dans quelques secondes.
                </p>
                <Link
                  href="/pronostics"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
                >
                  Voir les pronostics du jour
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="card-base p-7">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-gold-primary" />
                  <span className="text-gold-light text-xs font-semibold uppercase tracking-wide">
                    Accès immédiat — 100% gratuit
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-text-primary mb-1">
                  Recevoir le guide
                </h3>
                <p className="text-text-muted text-sm mb-6">
                  Entrez votre email pour recevoir les 5 secrets en PDF.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Prénom
                    </label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Votre prénom"
                      required
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:border-gold-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm font-medium mb-2">
                      Adresse email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      required
                      className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:border-gold-primary/50 focus:outline-none transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-status-loss text-xs">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <BookOpen className="w-5 h-5" />
                        Recevoir mon guide gratuit
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-text-muted text-xs text-center leading-relaxed">
                    En m&apos;inscrivant, j&apos;accepte les{" "}
                    <Link href="/cgu" className="text-gold-primary hover:underline">CGU</Link>{" "}
                    et la{" "}
                    <Link href="/confidentialite" className="text-gold-primary hover:underline">
                      Politique de confidentialité
                    </Link>.
                    Désabonnement en 1 clic.
                  </p>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
