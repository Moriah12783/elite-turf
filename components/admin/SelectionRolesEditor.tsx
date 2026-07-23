"use client";

import { useEffect, useState } from "react";
import { Plus, X, Star } from "lucide-react";
import { ROLE_CHOICES, roleChoiceOf } from "@/lib/pronostics/selection-roles";

/**
 * Saisie de la sélection ET de sa hiérarchie (base / value / coup + pivot).
 *
 * Pourquoi : jusqu'ici l'admin ne capturait qu'une liste de numéros. L'abonné
 * payant ne pouvait donc recevoir qu'une ligne de dossards, là où le visiteur
 * gratuit reçoit le Radar de la presse entièrement structuré. Ce composant est
 * le CHAINON MANQUANT : ce qu'il écrit dans `selection_detail` alimente le bloc
 * « façon Radar » de la carte et la hiérarchie de la fiche détail.
 *
 * Les noms/cotes viennent de GET /api/admin/consensus?courseId= (protégé
 * requireAdmin) : qualifier « le 7 » sans savoir que c'est le favori à 2.4 est
 * un exercice inutilement pénible.
 *
 * Le nom du cheval n'est volontairement PAS renvoyé pour stockage : la page
 * publique relit les mêmes `partants` par numéro, le dupliquer n'ajoute rien.
 *
 * Partagé par le formulaire de création et celui de modification.
 */

export interface SelectionRolesValue {
  /** Rôle choisi par l'expert, par n° de dossard. Absent = champ (couverture). */
  roles: Record<number, string>;
  /** Le pivot du jeu, s'il a été désigné. */
  pivot: number | null;
}

export const EMPTY_SELECTION_ROLES: SelectionRolesValue = { roles: {}, pivot: null };

interface PartantLite {
  numero: number;
  nom:    string;
  cote:   number | null;
}

interface Props {
  courseId:          string;
  selection:         number[];
  onSelectionChange: (next: number[]) => void;
  value:             SelectionRolesValue;
  onChange:          (next: SelectionRolesValue) => void;
}

export default function SelectionRolesEditor({
  courseId, selection, onSelectionChange, value, onChange,
}: Props) {
  const [newNumero, setNewNumero] = useState("");
  const [partants, setPartants]   = useState<PartantLite[]>([]);
  const [loading, setLoading]     = useState(false);

  // Partants de la course sélectionnée (numéro + nom + cote).
  useEffect(() => {
    // setLoading(false) indispensable : sans lui, revenir sur « aucune course »
    // pendant une requête en vol laissait le spinner tourner pour toujours (le
    // .finally de la requête précédente est neutralisé par `cancelled`).
    if (!courseId) { setPartants([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setPartants([]);
    fetch(`/api/admin/consensus?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then((d: unknown) => {
        if (cancelled) return;
        const brut = (d as { partants?: unknown })?.partants;
        const liste: PartantLite[] = Array.isArray(brut)
          ? brut
              .map((p) => {
                const o = p as { numero?: unknown; nom?: unknown; cote?: unknown };
                return {
                  numero: Number(o?.numero),
                  nom:    String(o?.nom ?? "").trim(),
                  cote:   Number.isFinite(Number(o?.cote)) ? Number(o?.cote) : null,
                };
              })
              .filter((p) => Number.isFinite(p.numero))
          : [];
        setPartants(liste);
      })
      .catch(() => { if (!cancelled) setPartants([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  const infoDe = (n: number): PartantLite | null => {
    for (const p of partants) if (p.numero === n) return p;
    return null;
  };

  const ajouter = (n: number) => {
    if (!(n > 0) || selection.indexOf(n) !== -1) return;
    onSelectionChange(selection.concat([n]));
    setNewNumero("");
  };

  /** Retirer un cheval annule aussi sa qualification — sinon rôles fantômes. */
  const retirer = (n: number) => {
    onSelectionChange(selection.filter((x) => x !== n));
    const roles: Record<number, string> = {};
    for (const k of Object.keys(value.roles)) {
      const num = Number(k);
      if (num !== n) roles[num] = value.roles[num];
    }
    onChange({ roles, pivot: value.pivot === n ? null : value.pivot });
  };

  /** Un clic pose le rôle, un second l'enlève (le cheval retombe en champ). */
  const basculerRole = (n: number, role: string) => {
    const roles: Record<number, string> = {};
    for (const k of Object.keys(value.roles)) roles[Number(k)] = value.roles[Number(k)];
    if (roles[n] === role) delete roles[n];
    else roles[n] = role;
    onChange({ roles, pivot: value.pivot });
  };

  const basculerPivot = (n: number) => {
    onChange({ roles: value.roles, pivot: value.pivot === n ? null : n });
  };

  const compte = (role: string) => {
    let c = 0;
    for (const n of selection) if (value.roles[n] === role) c++;
    return c;
  };
  const qualifies = ROLE_CHOICES.reduce((acc, c) => acc + compte(c.role), 0);
  // Rôles posés par le pipeline IA (COMPLEMENT, APPUI…) : conservés tels quels,
  // comptés à part pour ne pas les faire passer pour du champ.
  let horsVocabulaire = 0;
  for (const n of selection) {
    const r = value.roles[n];
    if (r && !roleChoiceOf(r)) horsVocabulaire++;
  }
  const dispo = partants.filter((p) => selection.indexOf(p.numero) === -1);

  return (
    <div>
      <label className="block text-text-secondary text-sm font-medium mb-2">
        Sélection &amp; hiérarchie <span className="text-status-loss">*</span>
      </label>

      {/* Ajout par numéro + ajout au clic depuis les partants */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          value={newNumero}
          onChange={(e) => setNewNumero(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); ajouter(parseInt(newNumero, 10)); }
          }}
          placeholder="N°"
          min={1}
          max={30}
          className="w-16 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm"
        />
        <button
          type="button"
          onClick={() => ajouter(parseInt(newNumero, 10))}
          className="p-1.5 bg-gold-faint border border-gold-primary/30 rounded-lg text-gold-primary hover:bg-gold-primary hover:text-bg-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        {loading && (
          <span className="w-4 h-4 border-2 border-gold-primary/30 border-t-gold-primary rounded-full animate-spin" />
        )}
      </div>

      {dispo.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {dispo.map((p) => (
            <button
              key={p.numero}
              type="button"
              onClick={() => ajouter(p.numero)}
              className="px-2 py-1 rounded-lg border border-border bg-bg-elevated text-text-secondary text-xs hover:border-gold-primary/40 hover:text-text-primary transition-colors"
            >
              <span className="font-bold text-text-primary">{p.numero}</span> {p.nom}
              {p.cote ? <span className="text-text-muted"> · {p.cote.toFixed(1)}</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Une ligne par cheval sélectionné : identité + qualification */}
      {selection.length === 0 ? (
        <p className="text-text-muted text-xs">
          Ajoutez les numéros des chevaux dans l&apos;ordre conseillé.
        </p>
      ) : (
        <div className="space-y-1.5">
          {selection.map((n) => {
            const info = infoDe(n);
            const role = value.roles[n];
            return (
              <div
                key={n}
                className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-border/60 bg-bg-elevated"
              >
                <span className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-sm flex-shrink-0">
                  {n}
                </span>
                <span className="flex-1 min-w-[7rem] text-text-primary text-sm truncate">
                  {info ? info.nom : <span className="text-text-muted">—</span>}
                  {info?.cote ? (
                    <span className="text-text-muted text-xs"> · {info.cote.toFixed(1)}</span>
                  ) : null}
                  {role && !roleChoiceOf(role) ? (
                    <span
                      title="Rôle posé par le pipeline IA — conservé tant que vous n'en choisissez pas un autre"
                      className="ml-2 px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-muted text-[10px] uppercase tracking-wider"
                    >
                      {role}
                    </span>
                  ) : null}
                </span>

                <div className="flex items-center gap-1">
                  {ROLE_CHOICES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      title={c.hint}
                      onClick={() => basculerRole(n, c.role)}
                      className={`px-2 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                        role === c.role
                          ? "bg-gold-primary border-gold-primary text-bg-primary"
                          : "bg-transparent border-border text-text-muted hover:text-text-primary hover:border-gold-primary/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Pivot du jeu"
                    onClick={() => basculerPivot(n)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      value.pivot === n
                        ? "bg-gold-faint border-gold-primary text-gold-primary"
                        : "border-border text-text-muted hover:text-gold-primary hover:border-gold-primary/40"
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" fill={value.pivot === n ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    title="Retirer de la sélection"
                    onClick={() => retirer(n)}
                    className="p-1.5 text-text-muted hover:text-status-loss transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-text-muted text-xs">
        {qualifies === 0 && horsVocabulaire === 0 ? (
          <>Qualifiez au moins un cheval pour offrir le tableau structuré à vos abonnés — sinon
          l&apos;affichage reste une simple liste.</>
        ) : (
          <>
            {ROLE_CHOICES.map((c) => `${c.label} ${compte(c.role)}`).join(" · ")}
            {horsVocabulaire > 0 ? ` · Pipeline ${horsVocabulaire}` : ""}
            {` · Champ ${selection.length - qualifies - horsVocabulaire}`}
            {" — les chevaux non qualifiés restent dans le jeu, en couverture."}
          </>
        )}
      </p>
    </div>
  );
}
