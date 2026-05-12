/**
 * BulkForm — Formulaire client pour publier en masse les pronostics du jour.
 *
 * Pré-rempli avec 3 lignes par défaut (Elite QUINTE_PLUS, Pro QUINTE_PLUS,
 * Gratuit TIERCE) qu'on peut éditer/supprimer/ajouter à volonté.
 *
 * Submission : POST /api/admin/pronostics/bulk avec cookie session admin
 * (l'endpoint accepte aussi le Bearer pour scripts curl).
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Send, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

type Niveau    = "GRATUIT" | "PRO" | "ELITE";
type TypePari  = "SIMPLE" | "TIERCE" | "QUARTE" | "QUINTE_PLUS";

interface PronosticRow {
  id:        string; // local uuid pour key React
  ref:       string;
  niveau:    Niveau;
  type:      TypePari;
  selection: string; // "7,6,12,2,1,9" — parsé au submit
}

interface CourseForRef {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  heure_depart:   string | null;
  hippodrome:     string | null;
  has_quinte?:    boolean;
}

interface Props {
  courses: CourseForRef[];
  date:    string;
}

interface SubmitResult {
  ref:           string;
  status:        "inserted" | "updated" | "error";
  pronostic_id?: string;
  course_id?:    string;
  error?:        string;
}

// Lignes par défaut — habituellement 3 pronostics matinaux
function initialRows(): PronosticRow[] {
  return [
    { id: "row-1", ref: "",  niveau: "ELITE",   type: "QUINTE_PLUS", selection: "" },
    { id: "row-2", ref: "",  niveau: "PRO",     type: "QUINTE_PLUS", selection: "" },
    { id: "row-3", ref: "",  niveau: "GRATUIT", type: "TIERCE",      selection: "" },
  ];
}

function uuid(): string {
  return `row-${Math.random().toString(36).slice(2, 9)}`;
}

export default function BulkForm({ courses, date }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PronosticRow[]>(initialRows());
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<SubmitResult[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function updateRow(idx: number, patch: Partial<PronosticRow>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { id: uuid(), ref: "", niveau: "PRO", type: "QUINTE_PLUS", selection: "" },
    ]);
  }

  function removeRow(idx: number) {
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setRows(initialRows());
    setResults(null);
    setGlobalError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setResults(null);

    // Validation client + parsing
    const filledRows = rows.filter((r) => r.ref.trim() || r.selection.trim());
    if (filledRows.length === 0) {
      setGlobalError("Renseigne au moins 1 ligne (ref + sélection).");
      return;
    }

    const payload: Array<{ ref: string; niveau: Niveau; type: TypePari; selection: number[] }> = [];
    for (let i = 0; i < filledRows.length; i++) {
      const r = filledRows[i];
      const ref = r.ref.trim().toUpperCase();
      if (!/^R\d+C\d+$/.test(ref)) {
        setGlobalError(`Ligne ${i + 1} : ref "${r.ref}" doit être au format R{n}C{n} (ex: R1C4).`);
        return;
      }
      const nums = r.selection
        .split(/[,\s-]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => parseInt(s, 10));
      if (nums.some(isNaN) || nums.length === 0) {
        setGlobalError(`Ligne ${i + 1} (${ref}) : sélection invalide. Format attendu : "7,6,12,2,1,9".`);
        return;
      }
      if (nums.some((n) => n < 1 || n > 30)) {
        setGlobalError(`Ligne ${i + 1} (${ref}) : les numéros doivent être entre 1 et 30.`);
        return;
      }
      payload.push({
        ref,
        niveau:    r.niveau,
        type:      r.type,
        selection: nums,
      });
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/pronostics/bulk", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // cookie session admin
          body: JSON.stringify({ date, pronostics: payload }),
        });
        const data = await res.json();
        if (!res.ok) {
          setGlobalError(data.error || `HTTP ${res.status}`);
          return;
        }
        setResults(data.results || []);
        // Refresh la liste des courses pour voir les nouveaux pronostics taggés
        router.refresh();
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Erreur réseau");
      }
    });
  }

  // Si on a un résultat, on affiche le récap + bouton "Nouvelle publication"
  if (results !== null) {
    const inserted = results.filter((r) => r.status === "inserted").length;
    const updated  = results.filter((r) => r.status === "updated").length;
    const errors   = results.filter((r) => r.status === "error").length;

    return (
      <div className="card-base p-6">
        <div className="flex items-center gap-3 mb-4">
          {errors === 0 ? (
            <div className="w-10 h-10 rounded-xl bg-status-win/15 border border-status-win/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-status-win" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-400" />
            </div>
          )}
          <div>
            <h2 className="font-serif font-bold text-text-primary text-lg">
              {errors === 0 ? "Publication réussie" : "Publication partielle"}
            </h2>
            <p className="text-text-muted text-sm">
              {inserted > 0 && <span>✨ {inserted} créé{inserted > 1 ? "s" : ""}</span>}
              {inserted > 0 && updated > 0 && <span> · </span>}
              {updated > 0 && <span>🔄 {updated} mis à jour</span>}
              {errors > 0 && <span className="text-orange-400"> · ⚠ {errors} erreur{errors > 1 ? "s" : ""}</span>}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {results.map((r, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                r.status === "inserted" ? "bg-status-win/5 border-status-win/30" :
                r.status === "updated"  ? "bg-gold-faint/40 border-gold-primary/30" :
                                          "bg-status-loss/5 border-status-loss/30"
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {r.status === "inserted" ? <CheckCircle2 className="w-4 h-4 text-status-win" /> :
                 r.status === "updated"  ? <CheckCircle2 className="w-4 h-4 text-gold-light" /> :
                                           <XCircle className="w-4 h-4 text-status-loss" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm font-mono font-bold">{r.ref}</p>
                <p className={`text-xs ${
                  r.status === "inserted" ? "text-status-win" :
                  r.status === "updated"  ? "text-gold-light"  :
                                            "text-status-loss"
                }`}>
                  {r.status === "inserted" ? "✨ Nouveau pronostic publié" :
                   r.status === "updated"  ? "🔄 Pronostic existant remplacé" :
                                              `❌ ${r.error}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={resetForm}
            className="flex-1 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm"
          >
            Nouvelle publication
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-base p-5 space-y-4">
      {/* En-tête tableau */}
      <div className="hidden md:grid grid-cols-[1fr,140px,160px,2fr,40px] gap-3 text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
        <div>Référence</div>
        <div>Niveau</div>
        <div>Type pari</div>
        <div>Sélection (numéros)</div>
        <div></div>
      </div>

      {rows.map((row, idx) => (
        <div
          key={row.id}
          className="grid grid-cols-1 md:grid-cols-[1fr,140px,160px,2fr,40px] gap-3 items-center p-3 bg-bg-elevated/40 rounded-xl border border-border/50"
        >
          {/* Ref */}
          <input
            type="text"
            placeholder="R1C4"
            value={row.ref}
            onChange={(e) => updateRow(idx, { ref: e.target.value.toUpperCase() })}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono uppercase placeholder:text-text-muted/50 focus:outline-none focus:border-gold-primary/50"
            autoCapitalize="characters"
          />

          {/* Niveau */}
          <select
            value={row.niveau}
            onChange={(e) => updateRow(idx, { niveau: e.target.value as Niveau })}
            className="bg-bg-card border border-border rounded-lg px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-primary/50"
          >
            <option value="ELITE">🏆 ELITE</option>
            <option value="PRO">⭐ PRO</option>
            <option value="GRATUIT">🆓 GRATUIT</option>
          </select>

          {/* Type pari */}
          <select
            value={row.type}
            onChange={(e) => updateRow(idx, { type: e.target.value as TypePari })}
            className="bg-bg-card border border-border rounded-lg px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-gold-primary/50"
          >
            <option value="QUINTE_PLUS">Quinté+</option>
            <option value="QUARTE">Quarté+</option>
            <option value="TIERCE">Tiercé</option>
            <option value="SIMPLE">Simple</option>
          </select>

          {/* Sélection */}
          <input
            type="text"
            placeholder="7,6,12,2,1,9"
            value={row.selection}
            onChange={(e) => updateRow(idx, { selection: e.target.value })}
            className="bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-gold-primary/50"
          />

          {/* Bouton suppression */}
          <button
            type="button"
            onClick={() => removeRow(idx)}
            disabled={rows.length <= 1}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-status-loss hover:bg-status-loss/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Retirer cette ligne"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Boutons actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/30 rounded-xl text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter une ligne
        </button>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm disabled:opacity-60 disabled:cursor-wait"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publication en cours…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Publier les {rows.filter((r) => r.ref.trim() || r.selection.trim()).length} pronostics
            </>
          )}
        </button>
      </div>

      {/* Erreur globale */}
      {globalError && (
        <div className="p-3 bg-status-loss/10 border border-status-loss/30 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-status-loss flex-shrink-0 mt-0.5" />
          <p className="text-status-loss text-sm">{globalError}</p>
        </div>
      )}
    </form>
  );
}
