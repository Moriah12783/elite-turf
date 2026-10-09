"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Edit2, Save, X, Loader2, Sparkles, Trash2,
  ChevronDown, ChevronRight, Check, AlertCircle,
} from "lucide-react";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";
import { jsonbRapportsToRapportsList } from "@/lib/rapports-pmu-format";

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

/**
 * Nombre minimum de chevaux à saisir selon les paris disponibles d'une course.
 *
 * **Politique unifiée 5 chevaux minimum** : pour garantir un contenu SEO
 * homogène et dense sur la page /arrivees/ (Google adore les pages au
 * contenu uniforme), TOUTES les courses doivent avoir au moins 5 chevaux
 * dans leur arrivée. Geny.com fournit quasiment toujours les 5+ premiers
 * chevaux dans la section "Arrivée définitive", même pour les courses
 * sans pari spécifique.
 *
 * Le "label" sert juste à informer l'admin sur le type de pari, mais
 * n'affecte pas la contrainte minimale (qui reste à 5 partout).
 */
function getMinHorses(parisDispo: string[]): { min: number; ideal: number; label: string } {
  if (parisDispo.includes("QUINTE_PLUS") || parisDispo.includes("QUINTE")) {
    return { min: 5, ideal: 6, label: "Quinté+" };
  }
  if (parisDispo.includes("QUARTE_PLUS")) {
    return { min: 5, ideal: 5, label: "Quarté+" };
  }
  if (parisDispo.includes("TIERCE")) {
    return { min: 5, ideal: 5, label: "Tiercé" };
  }
  // Courses sans grand pari : on exige quand même 5 pour homogénéité SEO
  return { min: 5, ideal: 5, label: "Course simple" };
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
  const [commentaire, setCommentaire] = useState(course.commentaire ?? "");

  // Rapports en LECTURE SEULE (décision de Steph du 09/10/2026) : ils viennent
  // du seul PMU (runPmuRapportsSync) ; ceux de Geny étaient faux.
  const rapportsAffiches = jsonbRapportsToRapportsList(
    course.rapports_pmu,
    course.arrivee_officielle ?? [],
  );

  const reference = `R${course.numero_reunion}C${course.numero_course}`;
  const isQuinte = course.paris_disponibles?.includes("QUINTE_PLUS");
  const isQuarte = course.paris_disponibles?.includes("QUARTE_PLUS");
  const isTierce = course.paris_disponibles?.includes("TIERCE");
  const horsesReq = getMinHorses(course.paris_disponibles ?? []);

  // Validation du nombre de chevaux côté client (avant envoi API)
  const currentArrivee = parseArriveeInput(arriveeText);
  const insufficientHorses =
    currentArrivee !== null && currentArrivee.length < horsesReq.min;

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
      // Pré-remplit l'arrivée et le commentaire (sans sauver). Jamais les rapports.
      if (data.arrivee) setArriveeText(formatArrivee(data.arrivee));
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
    if (arrivee.length < horsesReq.min) {
      setError(
        `${horsesReq.label} : ${horsesReq.min} chevaux minimum requis (idéal ${horsesReq.ideal}). Tu as saisi ${arrivee.length}.`,
      );
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
            <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-2">
              <span>Ordre d&apos;arrivée <span className="text-status-loss">*</span></span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isQuinte ? "bg-gold-primary/20 text-gold-primary border border-gold-primary/30" :
                isQuarte ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                isTierce ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                "bg-bg-elevated text-text-muted border border-border"
              }`}>
                {horsesReq.label} · min {horsesReq.min} · idéal {horsesReq.ideal}
              </span>
            </label>
            <input
              type="text"
              value={arriveeText}
              onChange={(e) => setArriveeText(e.target.value)}
              placeholder={
                isQuinte ? "ex: 4-9-12-7-1-3 (les 6 premiers idéalement)" :
                isQuarte ? "ex: 4-9-12-7-1 (les 5 premiers idéalement)" :
                "ex: 4-9-12-7-1 (5 chevaux pour un contenu riche)"
              }
              className={`w-full px-3 py-2 rounded-lg bg-bg-card border outline-none text-text-primary font-mono text-sm ${
                insufficientHorses ? "border-status-loss" : "border-border focus:border-gold-primary"
              }`}
            />
            <p className="text-xs text-text-muted mt-1">
              {isQuinte ? (
                <>
                  <strong className="text-gold-primary">Quinté+ : 5 chevaux minimum</strong> (6 idéal pour Bonus 4).
                  Saisir &quot;4-9-12-7-1-3&quot; → ordre Quinté + Bonus calculables.
                </>
              ) : (
                <>
                  <strong className="text-text-primary">5 chevaux minimum</strong> pour un contenu SEO homogène.
                  Geny donne quasiment toujours les 5+ premiers dans &quot;Arrivée définitive&quot;.
                </>
              )}
            </p>
            {insufficientHorses && (
              <p className="text-xs text-status-loss mt-1 font-medium">
                ⚠ {currentArrivee?.length} cheval/aux saisi(s) — il faut au moins {horsesReq.min} pour {horsesReq.label}
              </p>
            )}
          </div>

          {/* Rapports PMU — lecture seule (décision de Steph du 09/10/2026) */}
          <div className="card-base p-3">
            <p className="font-semibold text-sm text-text-primary">Rapports PMU</p>
            {rapportsAffiches.length > 0 ? (
              <>
                <ul className="mt-2 space-y-1 text-sm">
                  {rapportsAffiches.flatMap((r) => r.dividendes.map((d, i) => (
                    <li key={`${r.typePari}-${i}`} className="flex justify-between gap-3">
                      <span className="text-text-secondary">{r.label} · {d.combinaison}</span>
                      <span className="font-mono text-text-primary">
                        {d.rapport != null ? `${fmtEur(d.rapport)} €` : "—"}
                      </span>
                    </li>
                  )))}
                </ul>
                <p className="mt-2 text-xs text-text-muted">
                  Source : PMU (rapports définitifs). Non modifiables ici.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                Aucun rapport en base. La synchro PMU les ajoute quand le PMU les publie.
              </p>
            )}
          </div>

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
