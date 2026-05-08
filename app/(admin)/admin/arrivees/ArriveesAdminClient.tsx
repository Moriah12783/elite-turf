"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Edit2, Save, X, Loader2, Sparkles, Trash2,
  ChevronDown, ChevronRight, Check, AlertCircle,
} from "lucide-react";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

interface CourseRow {
  id:                 string;
  numero_reunion:     number;
  numero_course:      number;
  libelle:            string;
  heure_depart:       string | null;
  hippodrome_nom:     string;
  paris_disponibles:  string[];
  arrivee_officielle: number[] | null;
  has_arrivee:        boolean;
  rapports_pmu:       RapportsPMU | null;
  commentaire:        string | null;
  geny_url:           string | null;
}

interface Props {
  course: CourseRow;
}

// ── Helpers de parsing/formatting ────────────────────────────────────────────

function parseArriveeInput(s: string): number[] | null {
  const tokens = s.split(/[\s\-,;\/|]+/).map((t) => t.trim()).filter(Boolean);
  const nums = tokens.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) return null;
  if (nums.length < 3 || nums.length > 20) return null;
  if (new Set(nums).size !== nums.length) return null;
  return nums;
}

function formatArrivee(arr: number[] | null): string {
  if (!arr) return "";
  return arr.join("-");
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function ArriveesAdminClient({ course }: Props) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isFetchingGeny, setIsFetchingGeny] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Form state (initialisé depuis course existante) ─────────────────────
  const [arriveeText, setArriveeText] = useState(formatArrivee(course.arrivee_officielle));
  const [rapports, setRapports] = useState<RapportsPMU>(course.rapports_pmu ?? {});
  const [commentaire, setCommentaire] = useState(course.commentaire ?? "");

  const reference = `R${course.numero_reunion}C${course.numero_course}`;
  const isQuinte = course.paris_disponibles?.includes("QUINTE_PLUS");
  const isQuarte = course.paris_disponibles?.includes("QUARTE_PLUS");
  const isTierce = course.paris_disponibles?.includes("TIERCE");

  // ── Helper update du state rapports (immutable) ─────────────────────────
  function updateRapport<K extends keyof RapportsPMU>(
    key: K,
    value: RapportsPMU[K] | null,
  ) {
    setRapports((prev) => {
      const next = { ...prev };
      if (value == null || (typeof value === "object" && Object.keys(value).length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  // ── Action : Pré-remplir depuis Geny ────────────────────────────────────
  async function handlePrefillGeny() {
    setError(null);
    setSuccess(null);
    setIsFetchingGeny(true);
    try {
      const res = await fetch("/api/admin/arrivees/prefill-from-geny", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ course_id: course.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur Geny");
        return;
      }
      // Pré-remplit les champs du formulaire (sans sauver)
      if (data.arrivee) setArriveeText(formatArrivee(data.arrivee));
      if (data.rapports) setRapports(data.rapports);
      if (data.commentaire) setCommentaire(data.commentaire);
      setSuccess("✓ Données Geny récupérées — vérifie puis enregistre");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setIsFetchingGeny(false);
    }
  }

  // ── Action : Sauvegarder ────────────────────────────────────────────────
  async function handleSave() {
    setError(null);
    setSuccess(null);
    const arrivee = parseArriveeInput(arriveeText);
    if (!arrivee) {
      setError("Ordre d'arrivée invalide (3-20 numéros uniques séparés par - ou espace)");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/arrivees", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id:     course.id,
            ordre_arrivee: arrivee,
            rapports_pmu:  Object.keys(rapports).length > 0 ? rapports : null,
            commentaire:   commentaire.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erreur sauvegarde");
          return;
        }
        setSuccess("✓ Arrivée enregistrée");
        // Rafraîchir le Server Component pour montrer le nouveau statut
        router.refresh();
        // Ferme l'éditeur après 1s pour laisser le toast visible
        setTimeout(() => {
          setIsExpanded(false);
          setSuccess(null);
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur réseau");
      }
    });
  }

  // ── Action : Supprimer l'arrivée ────────────────────────────────────────
  async function handleDelete() {
    if (!confirm(`Supprimer l'arrivée de ${reference} ${course.libelle} ?`)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/arrivees?course_id=${course.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Erreur suppression");
          return;
        }
        setSuccess("✓ Arrivée supprimée");
        router.refresh();
        setTimeout(() => {
          setIsExpanded(false);
          setSuccess(null);
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur réseau");
      }
    });
  }

  return (
    <div className="card-base overflow-hidden">
      {/* ── Header (toujours visible) ────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-bg-hover transition-colors text-left"
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-text-muted">{reference}</span>
            <span className="text-text-primary font-medium truncate">{course.libelle}</span>
            {isQuinte && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gold-primary/20 text-gold-primary border border-gold-primary/30 font-semibold">
                Quinté+
              </span>
            )}
            {isQuarte && !isQuinte && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold">
                Quarté+
              </span>
            )}
          </div>
          <div className="text-text-muted text-xs mt-0.5">
            {course.hippodrome_nom} · {course.heure_depart?.slice(0, 5) ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {course.has_arrivee ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-status-win" />
              <span className="font-mono text-sm text-text-primary font-bold">
                {formatArrivee(course.arrivee_officielle)}
              </span>
            </div>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-status-loss/10 text-status-loss border border-status-loss/30 font-medium">
              À remplir
            </span>
          )}
        </div>
      </button>

      {/* ── Form (collapse/expand) ───────────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-bg-elevated/30">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrefillGeny}
              disabled={isFetchingGeny || !course.geny_url}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={course.geny_url ? "Pré-remplir depuis Geny" : "Pas de lien Geny pour cette course"}
            >
              {isFetchingGeny ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Pré-remplir Geny
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold-primary text-bg-primary hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Enregistrer
            </button>
            {course.has_arrivee && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-status-loss border border-status-loss/30 hover:bg-status-loss/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            )}
            <button
              onClick={() => setIsExpanded(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              Fermer
            </button>
          </div>

          {/* Toast erreur / succès */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-loss/10 border border-status-loss/30 text-status-loss text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-win/10 border border-status-win/30 text-status-win text-sm">
              <Check className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Ordre d'arrivée */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Ordre d&apos;arrivée <span className="text-status-loss">*</span>
            </label>
            <input
              type="text"
              value={arriveeText}
              onChange={(e) => setArriveeText(e.target.value)}
              placeholder="ex: 4-9-12-7-1"
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-gold-primary outline-none text-text-primary font-mono text-sm"
            />
            <p className="text-xs text-text-muted mt-1">
              5 numéros pour Quinté+, 4 pour Quarté+, 3 pour Tiercé. Séparés par - ou espace.
            </p>
          </div>

          {/* Rapports — Quinté+ (toujours expandé si applicable) */}
          {isQuinte && (
            <details open className="card-base p-3">
              <summary className="cursor-pointer font-semibold text-sm text-gold-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Quinté+ <span className="text-xs text-text-muted">(expandé par défaut)</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <RapportField
                  label="Ordre"
                  value={rapports.quinte_plus?.ordre}
                  onChange={(v) => updateRapport("quinte_plus", { ...rapports.quinte_plus, ordre: v ?? undefined })}
                />
                <RapportField
                  label="Désordre"
                  value={rapports.quinte_plus?.desordre}
                  onChange={(v) => updateRapport("quinte_plus", { ...rapports.quinte_plus, desordre: v ?? undefined })}
                />
                <RapportField
                  label="Bonus 4"
                  value={rapports.quinte_plus?.bonus4}
                  onChange={(v) => updateRapport("quinte_plus", { ...rapports.quinte_plus, bonus4: v ?? undefined })}
                />
                <RapportField
                  label="Bonus 3"
                  value={rapports.quinte_plus?.bonus3}
                  onChange={(v) => updateRapport("quinte_plus", { ...rapports.quinte_plus, bonus3: v ?? undefined })}
                />
              </div>
            </details>
          )}

          {/* Rapports — Quarté+ */}
          {(isQuinte || isQuarte) && (
            <details className="card-base p-3">
              <summary className="cursor-pointer font-semibold text-sm text-text-primary">Quarté+</summary>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <RapportField
                  label="Ordre"
                  value={rapports.quarte_plus?.ordre}
                  onChange={(v) => updateRapport("quarte_plus", { ...rapports.quarte_plus, ordre: v ?? undefined })}
                />
                <RapportField
                  label="Désordre"
                  value={rapports.quarte_plus?.desordre}
                  onChange={(v) => updateRapport("quarte_plus", { ...rapports.quarte_plus, desordre: v ?? undefined })}
                />
                <RapportField
                  label="Bonus"
                  value={rapports.quarte_plus?.bonus}
                  onChange={(v) => updateRapport("quarte_plus", { ...rapports.quarte_plus, bonus: v ?? undefined })}
                />
              </div>
            </details>
          )}

          {/* Rapports — Tiercé */}
          {(isQuinte || isQuarte || isTierce) && (
            <details className="card-base p-3">
              <summary className="cursor-pointer font-semibold text-sm text-text-primary">Tiercé</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <RapportField
                  label="Ordre"
                  value={rapports.tierce?.ordre}
                  onChange={(v) => updateRapport("tierce", { ...rapports.tierce, ordre: v ?? undefined })}
                />
                <RapportField
                  label="Désordre"
                  value={rapports.tierce?.desordre}
                  onChange={(v) => updateRapport("tierce", { ...rapports.tierce, desordre: v ?? undefined })}
                />
              </div>
            </details>
          )}

          {/* Rapports — Simple */}
          <details className="card-base p-3">
            <summary className="cursor-pointer font-semibold text-sm text-text-primary">Simple</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Simple gagnant</label>
                <RapportField
                  label=""
                  value={rapports.simple_gagnant}
                  onChange={(v) => updateRapport("simple_gagnant", v ?? undefined)}
                  inline
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Simple placé (1er, 2e, 3e)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((idx) => (
                    <RapportField
                      key={idx}
                      label=""
                      placeholder={`${idx + 1}${idx === 0 ? "er" : "e"}`}
                      value={rapports.simple_place?.[idx]}
                      onChange={(v) => {
                        const arr = [...(rapports.simple_place ?? [])];
                        if (v == null) {
                          arr[idx] = 0; // marquer comme vide via 0
                        } else {
                          arr[idx] = v;
                        }
                        // Filtre les zeros pour stockage propre
                        const cleaned = arr.filter((n) => n > 0);
                        updateRapport("simple_place", cleaned.length > 0 ? cleaned : undefined);
                      }}
                      inline
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* Rapports — Couplé */}
          <details className="card-base p-3">
            <summary className="cursor-pointer font-semibold text-sm text-text-primary">Couplé</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Couplé gagnant</label>
                <RapportField
                  label=""
                  value={rapports.couple_gagnant}
                  onChange={(v) => updateRapport("couple_gagnant", v ?? undefined)}
                  inline
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Couplé placé (1-2, 1-3, 2-3)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((idx) => (
                    <RapportField
                      key={idx}
                      label=""
                      placeholder={["1-2", "1-3", "2-3"][idx]}
                      value={rapports.couple_place?.[idx]}
                      onChange={(v) => {
                        const arr = [...(rapports.couple_place ?? [])];
                        if (v == null) {
                          arr[idx] = 0;
                        } else {
                          arr[idx] = v;
                        }
                        const cleaned = arr.filter((n) => n > 0);
                        updateRapport("couple_place", cleaned.length > 0 ? cleaned : undefined);
                      }}
                      inline
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>

          {/* Rapports — Trio + 2/4 */}
          <details className="card-base p-3">
            <summary className="cursor-pointer font-semibold text-sm text-text-primary">Trio &amp; 2 sur 4</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <RapportField
                label="Trio"
                value={rapports.trio}
                onChange={(v) => updateRapport("trio", v ?? undefined)}
              />
              <RapportField
                label="2 sur 4"
                value={rapports.deux_sur_quatre}
                onChange={(v) => updateRapport("deux_sur_quatre", v ?? undefined)}
              />
            </div>
          </details>

          {/* Rapports — Multi */}
          <details className="card-base p-3">
            <summary className="cursor-pointer font-semibold text-sm text-text-primary">Multi</summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RapportField
                label="En 4"
                value={rapports.multi?.en_4}
                onChange={(v) => updateRapport("multi", { ...rapports.multi, en_4: v ?? undefined })}
              />
              <RapportField
                label="En 5"
                value={rapports.multi?.en_5}
                onChange={(v) => updateRapport("multi", { ...rapports.multi, en_5: v ?? undefined })}
              />
              <RapportField
                label="En 6"
                value={rapports.multi?.en_6}
                onChange={(v) => updateRapport("multi", { ...rapports.multi, en_6: v ?? undefined })}
              />
              <RapportField
                label="En 7"
                value={rapports.multi?.en_7}
                onChange={(v) => updateRapport("multi", { ...rapports.multi, en_7: v ?? undefined })}
              />
            </div>
          </details>

          {/* Commentaire */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Commentaire d&apos;arrivée (optionnel)
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              placeholder="ex: Course remportée en tête. Le favori s'est imposé sans difficulté…"
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-gold-primary outline-none text-text-primary text-sm resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant : champ de rapport € ──────────────────────────────────────

function RapportField({
  label,
  value,
  onChange,
  placeholder,
  inline,
}: {
  label:        string;
  value:        number | undefined;
  onChange:     (n: number | null) => void;
  placeholder?: string;
  inline?:      boolean;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");

  // Sync external value updates (pour prefill Geny)
  if (value != null && text !== String(value) && text === "") {
    setText(String(value));
  }

  function handleChange(s: string) {
    setText(s);
    const cleaned = s.replace(",", ".").trim();
    if (cleaned === "") {
      onChange(null);
      return;
    }
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n < 0) {
      // input invalide : on ne met pas à jour le state parent (mais on garde le texte)
      return;
    }
    onChange(Math.round(n * 100) / 100);
  }

  return (
    <div className={inline ? "" : ""}>
      {label && (
        <label className="block text-xs text-text-muted mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="w-full pl-3 pr-7 py-1.5 rounded-lg bg-bg-card border border-border focus:border-gold-primary outline-none text-text-primary text-sm font-mono"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
      </div>
    </div>
  );
}
