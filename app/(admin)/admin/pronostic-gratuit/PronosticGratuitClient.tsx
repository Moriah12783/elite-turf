"use client";

import { useState } from "react";
import { Star, CheckCircle2, XCircle, Loader2, RefreshCw, Send, Info } from "lucide-react";

interface Partant {
  id: string;
  numero: number;
  nom_cheval: string;
  jockey?: string;
  cote?: number | null;
}

interface Course {
  id: string;
  libelle: string;
  heure_depart: string;
  numero_reunion: number;
  numero_course: number;
  nb_partants: number;
  paris_disponibles: string[];
  categorie?: string;
  terrain?: string;
  distance_metres?: number;
  hippodrome?: { nom: string; pays: string };
}

interface Props {
  alreadyPublished: boolean;
  pronosticId?: string;
  course: Course | null;
  partants: Partant[];
  selection: number[];
  analyse: string;
  noCoursesToday: boolean;
}

const CONFIANCE_LABELS = ["", "Faible", "Moyen", "Élevé", "Très élevé", "Maximum"];

export default function PronosticGratuitClient({
  alreadyPublished,
  pronosticId,
  course,
  partants,
  selection: initialSelection,
  analyse: initialAnalyse,
  noCoursesToday,
}: Props) {
  const [selection,  setSelection]  = useState<number[]>(initialSelection);
  const [analyse,    setAnalyse]    = useState(initialAnalyse);
  const [confiance,  setConfiance]  = useState(3);
  const [status,     setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMsg,  setStatusMsg]  = useState("");

  function toggleHorse(numero: number) {
    setSelection(prev => {
      if (prev.includes(numero)) {
        return prev.filter(n => n !== numero).sort((a, b) => a - b);
      }
      if (prev.length >= 5) return prev; // max 5
      return [...prev, numero].sort((a, b) => a - b);
    });
  }

  async function handlePublish() {
    if (!course || selection.length < 3 || !analyse.trim()) return;
    setStatus("loading");
    setStatusMsg("");

    try {
      const res = await fetch("/api/admin/pronostic-gratuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id:     course.id,
          selection,
          analyse_courte: analyse.trim(),
          confiance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setStatusMsg(data.error || "Erreur lors de la publication");
        return;
      }
      setStatus("success");
      setStatusMsg(`Pronostic gratuit publié ! ID : ${data.pronostic_id}`);
    } catch {
      setStatus("error");
      setStatusMsg("Erreur réseau — réessayez");
    }
  }

  // ── État : déjà publié ──────────────────────────────────────────────────────
  if (alreadyPublished) {
    return (
      <div className="card-base p-8 text-center max-w-lg mx-auto">
        <CheckCircle2 className="w-12 h-12 text-status-win mx-auto mb-4" />
        <h2 className="font-serif text-lg font-bold text-text-primary mb-2">
          Pronostic gratuit publié aujourd&apos;hui
        </h2>
        <p className="text-text-secondary text-sm mb-4">
          Le pronostic gratuit du jour est déjà en ligne et visible par tous les visiteurs.
        </p>
        <a
          href={`/pronostics/${pronosticId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors"
        >
          <Star className="w-4 h-4" />
          Voir le pronostic publié
        </a>
      </div>
    );
  }

  // ── État : aucune course ────────────────────────────────────────────────────
  if (noCoursesToday || !course) {
    return (
      <div className="card-base p-8 text-center max-w-lg mx-auto">
        <Info className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <h2 className="font-serif text-lg font-bold text-text-primary mb-2">
          Aucune course Tiercé disponible aujourd&apos;hui
        </h2>
        <p className="text-text-secondary text-sm">
          Le programme du jour ne contient pas encore de course Tiercé avec suffisamment de partants.
          Revenez après la synchronisation PMU (7h–12h).
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-border text-text-secondary text-sm font-medium rounded-xl hover:border-gold-primary/40 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>
    );
  }

  // ── Formulaire principal ────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

      {/* Colonne gauche : course + partants */}
      <div className="space-y-6">

        {/* Course sélectionnée */}
        <div className="card-base p-5 border border-gold-primary/30">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="text-xs px-2.5 py-1 bg-status-win/10 text-status-win border border-status-win/20 rounded-full font-semibold">
                Course recommandée
              </span>
              <h3 className="font-serif font-bold text-text-primary text-lg mt-2 leading-snug">
                {course.libelle}
              </h3>
              <p className="text-text-secondary text-sm">
                {course.hippodrome?.nom} · R{course.numero_reunion}C{course.numero_course}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-gold-light font-bold text-lg">
                {(course.heure_depart || "").slice(0, 5)}
              </p>
              <p className="text-text-muted text-xs">{course.nb_partants} partants</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(course.paris_disponibles || []).map((p: string) => (
              <span key={p} className="text-xs px-2 py-0.5 bg-bg-elevated border border-border rounded text-text-secondary">
                {p}
              </span>
            ))}
            {course.distance_metres ? (
              <span className="text-xs px-2 py-0.5 bg-bg-elevated border border-border rounded text-text-secondary">
                {course.distance_metres}m
              </span>
            ) : null}
            {course.terrain && (
              <span className="text-xs px-2 py-0.5 bg-bg-elevated border border-border rounded text-text-secondary">
                {course.terrain}
              </span>
            )}
          </div>
        </div>

        {/* Sélection des chevaux */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-primary text-sm">
              Sélection — {selection.length}/5 chevaux
            </h3>
            <span className="text-text-muted text-xs">Cliquez pour sélectionner/désélectionner</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {partants.map((p: Partant) => {
              const isSelected = selection.includes(p.numero);
              const rank = selection.indexOf(p.numero) + 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleHorse(p.numero)}
                  disabled={!isSelected && selection.length >= 5}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-gold-faint border-gold-primary/50"
                      : selection.length >= 5
                      ? "bg-bg-elevated border-border/30 opacity-40 cursor-not-allowed"
                      : "bg-bg-elevated border-border hover:border-gold-primary/30"
                  }`}
                >
                  <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    isSelected
                      ? "border-gold-primary bg-gold-primary/20 text-gold-primary"
                      : "border-border bg-bg-card text-text-secondary"
                  }`}>
                    {p.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-gold-light" : "text-text-primary"}`}>
                      {p.nom_cheval}
                    </p>
                    {p.jockey && (
                      <p className="text-text-muted text-xs truncate">{p.jockey}</p>
                    )}
                  </div>
                  {p.cote && Number(p.cote) > 0 && (
                    <span className="text-xs font-bold text-gold-light flex-shrink-0">
                      {Number(p.cote).toFixed(1)}
                    </span>
                  )}
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-gold-primary text-bg-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {rank}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Colonne droite : analyse + confiance + publication */}
      <div className="space-y-6">

        {/* Analyse */}
        <div className="card-base p-5">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">
            Analyse courte <span className="text-text-muted normal-case font-normal">(visible par tous)</span>
          </label>
          <textarea
            value={analyse}
            onChange={e => setAnalyse(e.target.value.slice(0, 280))}
            rows={5}
            className="w-full px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none"
            placeholder="Brève analyse visible par tous les visiteurs…"
          />
          <p className="text-text-muted text-xs mt-1 text-right">{analyse.length}/280</p>
        </div>

        {/* Confiance */}
        <div className="card-base p-5">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-3">
            Niveau de confiance
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setConfiance(n)}
                className="flex-1"
              >
                <Star
                  className="w-6 h-6 mx-auto transition-colors"
                  fill={n <= confiance ? "#C9A84C" : "transparent"}
                  color={n <= confiance ? "#C9A84C" : "#3A3A50"}
                />
              </button>
            ))}
          </div>
          <p className="text-text-muted text-xs text-center mt-2">{CONFIANCE_LABELS[confiance]}</p>
        </div>

        {/* Aperçu */}
        <div className="card-base p-5 border border-border/50">
          <h3 className="font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-text-muted" />
            Aperçu visiteur
          </h3>
          <div className="p-3 bg-bg-elevated rounded-xl border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 bg-status-win/10 text-status-win border border-status-win/20 rounded-full font-semibold">✓ GRATUIT</span>
              <span className="text-xs px-2 py-0.5 bg-bg-card border border-border rounded text-text-secondary">TIERCÉ</span>
            </div>
            <p className="text-text-primary text-sm font-semibold mb-1">{course.libelle}</p>
            <p className="text-text-muted text-xs mb-2">{course.hippodrome?.nom} · {(course.heure_depart || "").slice(0, 5)}</p>
            <div className="flex gap-2 mb-2">
              {selection.map(n => (
                <span key={n} className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-sm">
                  {n}
                </span>
              ))}
            </div>
            <p className="text-text-secondary text-xs leading-relaxed italic">
              &ldquo;{analyse || "Analyse à rédiger…"}&rdquo;
            </p>
          </div>
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

        {/* Bouton publier */}
        <button
          type="button"
          disabled={status === "loading" || status === "success" || selection.length < 3 || !analyse.trim()}
          onClick={handlePublish}
          className="w-full py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-gold"
        >
          {status === "loading"
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Publication…</>
            : status === "success"
            ? <><CheckCircle2 className="w-4 h-4" /> Publié avec succès</>
            : <><Send className="w-4 h-4" /> Publier le pronostic gratuit du jour</>}
        </button>

        <p className="text-text-muted text-xs text-center">
          Visible immédiatement par tous les visiteurs · Vérifiable sur Geny
        </p>
      </div>
    </div>
  );
}
