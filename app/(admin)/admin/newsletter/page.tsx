"use client";

import { useState, useEffect } from "react";
import {
  Mail, Send, Users, Star, Crown, Loader2,
  CheckCircle2, XCircle, Eye, ChevronDown, ChevronUp, Newspaper,
} from "lucide-react";

// ── Contenu par défaut de la première édition ───────────────────────────────

const DEFAULT_EDITO = `Le Quinté+ n'est pas une loterie, c'est une bataille d'informations. Ce mois-ci, nos algorithmes ont détecté une anomalie de cote majeure sur les courses de trot attelé à Vincennes. Pendant que la masse suivait les noms célèbres, l'Élite regardait les chiffres. Résultat ? Un outsider à 18/1 validé par notre indice de confiance.`;

const DEFAULT_SECRET_TITRE = `Le "Da" (Disqualification cachée) : Votre meilleure opportunité`;

const DEFAULT_SECRET_TEXTE = `Saviez-vous qu'un cheval disqualifié (Da) peut être votre meilleure opportunité ? Si un trotteur commet une faute alors qu'il affichait une vitesse de pointe supérieure à la moyenne, sa cote monte artificiellement pour la course suivante. C'est ce "Signal Faible" que nous traquons pour vous chaque matin avant 8h. La semaine dernière, ce signal a permis d'identifier un cheval à 14/1 qui a terminé 2ème — un Quarté+ validé.`;

const DEFAULT_BILAN = `Ces 15 derniers jours, l'alliance de l'expertise hippique et de la précision digitale a permis à nos membres de sécuriser des placements stratégiques sur Vincennes et Longchamp.\n\n• Taux de détection des outsiders : +40% par rapport aux pronostics officiels.\n• Meilleure cote détectée : 22/1.\n• 3 Quinté+ placés sur les 5 dernières semaines.`;

// ── Types ───────────────────────────────────────────────────────────────────

type Segment = "prospects" | "actifs" | "elite" | "tous";

type Counts = {
  prospects: number | null;
  actifs: number | null;
  elite: number | null;
  tous: number | null;
};

const SEGMENTS: { value: Segment; label: string; sublabel: string; icon: typeof Users; color: string; bg: string }[] = [
  {
    value: "prospects", label: "Prospects", sublabel: "Guide gratuit téléchargé",
    icon: Users, color: "text-blue-400", bg: "border-blue-400/40 bg-blue-400/5",
  },
  {
    value: "actifs", label: "Membres Actifs", sublabel: "Découverte + Performance",
    icon: Star, color: "text-gold-primary", bg: "border-gold-primary/40 bg-gold-faint",
  },
  {
    value: "elite", label: "Elite", sublabel: "Pack Elite 208€",
    icon: Crown, color: "text-purple-400", bg: "border-purple-400/40 bg-purple-400/5",
  },
  {
    value: "tous", label: "Tous", sublabel: "Prospects + Actifs + Elite",
    icon: Mail, color: "text-text-primary", bg: "border-border bg-bg-elevated",
  },
];

// ── Composant principal ──────────────────────────────────────────────────────

export default function NewsletterPage() {
  const [segment,       setSegment]       = useState<Segment>("tous");
  const [editoTexte,    setEditoTexte]    = useState(DEFAULT_EDITO);
  const [secretTitre,   setSecretTitre]   = useState(DEFAULT_SECRET_TITRE);
  const [secretTexte,   setSecretTexte]   = useState(DEFAULT_SECRET_TEXTE);
  const [bilanTexte,    setBilanTexte]    = useState(DEFAULT_BILAN);
  const [numeroEdition, setNumeroEdition] = useState(1);
  const [counts,        setCounts]        = useState<Counts>({ prospects: null, actifs: null, elite: null, tous: null });
  const [status,        setStatus]        = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMsg,     setStatusMsg]     = useState("");
  const [preview,       setPreview]       = useState(false);

  useEffect(() => {
    fetch("/api/newsletter/counts")
      .then(r => r.json())
      .then(d => setCounts({ prospects: d.prospects ?? 0, actifs: d.actifs ?? 0, elite: d.elite ?? 0, tous: d.tous ?? 0 }))
      .catch(() => {});
  }, []);

  const currentCount = counts[segment];

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!editoTexte.trim() || !secretTitre.trim() || !secretTexte.trim() || !bilanTexte.trim()) return;

    const confirmed = window.confirm(
      `Vous allez envoyer la newsletter à ${currentCount ?? "?"} destinataire(s) (segment : ${segment}).\n\nConfirmer l'envoi ?`
    );
    if (!confirmed) return;

    setStatus("loading");
    setStatusMsg("");

    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, editoTexte, secretTitre, secretTexte, bilanTexte, numeroEdition }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("error"); setStatusMsg(data.error || "Erreur"); return; }
      setStatus("success");
      setStatusMsg(`✓ Newsletter envoyée à ${data.envoyes} destinataire(s) ! ${data.echecs > 0 ? `(${data.echecs} échec(s))` : ""}`);
    } catch {
      setStatus("error");
      setStatusMsg("Erreur réseau — réessayez");
    }
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-gold-primary" />
            L'Œil de l'Élite
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Newsletter bimensuelle · Résend · 3 segments personnalisés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-xs font-semibold">Édition N°</label>
          <input
            type="number" min={1} value={numeroEdition}
            onChange={e => setNumeroEdition(Number(e.target.value))}
            className="w-16 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg text-center focus:border-gold-primary/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Colonne gauche : formulaire ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sélecteur segment */}
          <div className="card-base p-5">
            <h2 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-gold-primary" />
              Destinataires
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEGMENTS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.value} type="button" onClick={() => setSegment(s.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      segment === s.value ? s.bg + " " + s.color.replace("text-", "border-") : "bg-bg-elevated border-border"
                    }`}>
                    <Icon className={`w-4 h-4 mb-1.5 ${segment === s.value ? s.color : "text-text-muted"}`} />
                    <p className={`text-xs font-bold mb-0.5 ${segment === s.value ? s.color : "text-text-primary"}`}>
                      {s.label}
                    </p>
                    <p className="text-text-muted text-xs leading-tight">{s.sublabel}</p>
                    <p className={`text-lg font-bold mt-1 ${s.color}`}>
                      {counts[s.value] === null ? "—" : counts[s.value]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulaire contenu */}
          <form onSubmit={handleSend} className="space-y-5">

            {/* Édito */}
            <div className="card-base p-5">
              <label className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-xs flex items-center justify-center font-bold">1</span>
                Édito de Stéphane
              </label>
              <textarea value={editoTexte} onChange={e => setEditoTexte(e.target.value)} rows={4}
                placeholder="Votre regard sur l'actualité des grands hippodromes..."
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none" />
              <p className="text-text-muted text-xs mt-1 text-right">{editoTexte.length} car.</p>
            </div>

            {/* Secret du mois */}
            <div className="card-base p-5">
              <label className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                <span className="w-5 h-5 rounded-full bg-gold-primary/20 text-gold-primary text-xs flex items-center justify-center font-bold">2</span>
                Le Secret du Mois
              </label>
              <input value={secretTitre} onChange={e => setSecretTitre(e.target.value)}
                placeholder="Titre du secret..."
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted mb-3" />
              <textarea value={secretTexte} onChange={e => setSecretTexte(e.target.value)} rows={4}
                placeholder="Explication approfondie du secret..."
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none" />
              <p className="text-text-muted text-xs mt-1 text-right">{secretTexte.length} car.</p>
            </div>

            {/* Bilan IA */}
            <div className="card-base p-5">
              <label className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
                <span className="w-5 h-5 rounded-full bg-status-win/20 text-status-win text-xs flex items-center justify-center font-bold">3</span>
                Bilan des 15 derniers jours
              </label>
              <textarea value={bilanTexte} onChange={e => setBilanTexte(e.target.value)} rows={4}
                placeholder="Récapitulatif des plus beaux coups détectés par l'algorithme..."
                className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none" />
              <p className="text-text-muted text-xs mt-1 text-right">{bilanTexte.length} car.</p>
            </div>

            {/* Feedback */}
            {status === "success" && (
              <div className="p-3 bg-status-win/10 border border-status-win/20 rounded-xl flex items-center gap-2 text-status-win text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{statusMsg}
              </div>
            )}
            {status === "error" && (
              <div className="p-3 bg-status-loss/10 border border-status-loss/20 rounded-xl flex items-center gap-2 text-status-loss text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />{statusMsg}
              </div>
            )}

            {/* Bouton envoi */}
            <button type="submit"
              disabled={status === "loading" || !editoTexte.trim() || !secretTitre.trim() || !bilanTexte.trim()}
              className="w-full py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {status === "loading"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                : <><Send className="w-4 h-4" /> Envoyer à {currentCount ?? "—"} destinataire{(currentCount ?? 0) > 1 ? "s" : ""}</>}
            </button>
          </form>
        </div>

        {/* ── Colonne droite : aperçu + infos ── */}
        <div className="space-y-5">

          {/* Aperçu structure */}
          <div className="card-base p-5">
            <button onClick={() => setPreview(!preview)}
              className="w-full flex items-center justify-between text-text-primary font-semibold text-sm mb-3">
              <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-gold-primary" /> Aperçu structure</span>
              {preview ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>
            {preview && (
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-bg-elevated rounded-lg border border-gold-primary/20">
                  <p className="text-gold-primary font-bold mb-0.5">✦ Logo Elite Turf</p>
                  <p className="text-text-muted">MAISON DE PRONOSTICS · L'Œil de l'Élite N°{numeroEdition}</p>
                </div>
                <div className="p-2 bg-bg-elevated rounded-lg border border-border">
                  <p className="text-text-secondary font-semibold mb-0.5">Édito</p>
                  <p className="text-text-muted line-clamp-2">{editoTexte || "—"}</p>
                </div>
                <div className="p-2 bg-bg-elevated rounded-lg border-l-2 border-gold-primary">
                  <p className="text-gold-primary font-semibold mb-0.5">🔑 Secret du Mois</p>
                  <p className="text-text-muted line-clamp-1">{secretTitre || "—"}</p>
                </div>
                <div className="p-2 bg-status-win/5 rounded-lg border border-status-win/20">
                  <p className="text-status-win font-semibold mb-0.5">📊 Bilan 15 jours</p>
                  <p className="text-text-muted line-clamp-2">{bilanTexte || "—"}</p>
                </div>
                <div className="p-2 bg-gold-faint rounded-lg border border-gold-primary/30">
                  <p className="text-gold-primary font-semibold">⚡ CTA personnalisé</p>
                  <p className="text-text-muted text-xs">Offre adaptée au segment : <span className="font-semibold">{segment}</span></p>
                </div>
                <div className="p-2 bg-bg-elevated rounded-lg border border-border text-center">
                  <p className="text-text-muted">📍 Footer · Adresse · Socials</p>
                </div>
              </div>
            )}
          </div>

          {/* Infos techniques */}
          <div className="card-base p-5 space-y-3">
            <h3 className="font-semibold text-text-primary text-sm">ℹ️ Informations</h3>
            {[
              { icon: "📧", text: "Envoi via Resend avec tracking ouvertures/clics" },
              { icon: "👤", text: "Prénom personnalisé dans chaque email" },
              { icon: "🎯", text: "CTA adapté au segment (Prospects / Actifs / Elite)" },
              { icon: "⏱️", text: "Délai de 200ms entre chaque envoi (anti-spam)" },
              { icon: "📅", text: "Rythme recommandé : tous les 15 jours" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 text-sm">{item.icon}</span>
                <p className="text-text-secondary text-xs leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Rappel segments */}
          <div className="card-base p-5">
            <h3 className="font-semibold text-text-primary text-sm mb-3">🎯 Stratégie segments</h3>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-blue-400/5 border border-blue-400/20 rounded-lg">
                <p className="text-blue-400 font-bold">Prospects</p>
                <p className="text-text-muted">CTA agressif : 3 offres 65€/152€/208€</p>
              </div>
              <div className="p-2 bg-gold-faint border border-gold-primary/20 rounded-lg">
                <p className="text-gold-primary font-bold">Membres Actifs</p>
                <p className="text-text-muted">Upsell vers Performance ou Elite</p>
              </div>
              <div className="p-2 bg-purple-400/5 border border-purple-400/20 rounded-lg">
                <p className="text-purple-400 font-bold">Elite</p>
                <p className="text-text-muted">Message VIP exclusif, fidélisation</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
