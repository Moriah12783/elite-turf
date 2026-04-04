"use client";

import { useState } from "react";
import { Plus, Trash2, Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Partant {
  _key: string;        // clé locale unique (non persistée)
  id?: string;         // UUID Supabase (existe si déjà en base)
  numero: number | "";
  nom_cheval: string;
  jockey: string;
  entraineur: string;
  cote: number | "";
  musique: string;
  poids_kg: number | "";
  deferre: boolean;
  non_partant: boolean;
}

function emptyPartant(numero: number): Partant {
  return {
    _key: crypto.randomUUID(),
    numero,
    nom_cheval: "",
    jockey: "",
    entraineur: "",
    cote: "",
    musique: "",
    poids_kg: "",
    deferre: false,
    non_partant: false,
  };
}

function fromDb(p: any): Partant {
  return {
    _key: p.id,
    id: p.id,
    numero: p.numero ?? "",
    nom_cheval: p.nom_cheval ?? "",
    jockey: p.jockey ?? "",
    entraineur: p.entraineur ?? "",
    cote: p.cote ?? "",
    musique: p.musique ?? "",
    poids_kg: p.poids_kg ?? "",
    deferre: p.deferre ?? false,
    non_partant: p.non_partant ?? false,
  };
}

interface Props {
  courseId: string;
  nbPartants: number;
  initialPartants: any[];
}

export default function PartantsClient({ courseId, nbPartants, initialPartants }: Props) {
  const supabase = createClient();

  const [rows, setRows] = useState<Partant[]>(() => {
    if (initialPartants.length > 0) return initialPartants.map(fromDb);
    // Pré-remplir avec le nombre de partants attendus
    return Array.from({ length: nbPartants }, (_, i) => emptyPartant(i + 1));
  });

  const [saving, setSaving] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

  // ── Mise à jour d'un champ ──────────────────────────────────────────
  function update(key: string, field: keyof Partant, value: any) {
    setRows(prev =>
      prev.map(r => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  // ── Ajouter une ligne ───────────────────────────────────────────────
  function addRow() {
    const nextNum = rows.length > 0 ? Math.max(...rows.map(r => Number(r.numero) || 0)) + 1 : 1;
    setRows(prev => [...prev, emptyPartant(nextNum)]);
  }

  // ── Supprimer une ligne ─────────────────────────────────────────────
  function removeRow(key: string) {
    setRows(prev => prev.filter(r => r._key !== key));
  }

  // ── Enregistrer tout ────────────────────────────────────────────────
  async function save() {
    // Validation minimale
    const valid = rows.filter(r => r.nom_cheval.trim() && Number(r.numero) > 0);
    if (valid.length === 0) {
      toast.error("Aucun partant valide (numéro + nom requis)");
      return;
    }

    setSaving(true);
    try {
      // Supprimer les anciens partants de cette course
      const { error: delErr } = await supabase
        .from("partants")
        .delete()
        .eq("course_id", courseId);

      if (delErr) throw delErr;

      // Insérer les lignes valides
      const toInsert = valid.map(r => ({
        course_id:    courseId,
        numero:       Number(r.numero),
        nom_cheval:   r.nom_cheval.trim().toUpperCase(),
        jockey:       r.jockey.trim() || null,
        entraineur:   r.entraineur.trim() || null,
        cote:         r.cote !== "" ? Number(r.cote) : null,
        musique:      r.musique.trim() || null,
        poids_kg:     r.poids_kg !== "" ? Number(r.poids_kg) : null,
        deferre:      r.deferre,
        non_partant:  r.non_partant,
        scraped_at:   new Date().toISOString(),
      }));

      const { error: insErr } = await supabase.from("partants").insert(toInsert);
      if (insErr) throw insErr;

      // Mettre à jour nb_partants sur la course
      await supabase
        .from("courses")
        .update({ nb_partants: valid.length })
        .eq("id", courseId);

      toast.success(`${valid.length} partant(s) enregistré(s)`);
    } catch (err: any) {
      toast.error(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Compter les non-partants ────────────────────────────────────────
  const nonPartants = rows.filter(r => r.non_partant).length;

  return (
    <div className="space-y-4">

      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 card-base p-3">
        <div className="flex items-center gap-3">
          <span className="text-text-secondary text-sm">
            <span className="font-semibold text-text-primary">{rows.length}</span> partant(s)
            {nonPartants > 0 && (
              <span className="ml-2 text-status-loss text-xs">· {nonPartants} NP</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowExtra(v => !v)}
            className="text-xs text-gold-primary hover:text-gold-light underline underline-offset-2 transition-colors"
          >
            {showExtra ? "Masquer" : "Afficher"} colonnes extra
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-semibold text-sm rounded-lg transition-colors shadow-gold-sm"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-gold-primary/5 border border-gold-primary/20 text-sm text-text-secondary">
        <AlertCircle className="w-4 h-4 text-gold-primary mt-0.5 flex-shrink-0" />
        <span>
          Musique au format PMU : <code className="text-gold-light bg-bg-elevated px-1 rounded">1p 2a 4a 1p</code> (chiffre = position, lettre = type de course).
          Cote : valeur décimale ex. <code className="text-gold-light bg-bg-elevated px-1 rounded">3.5</code>
        </span>
      </div>

      {/* Tableau partants */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated/50">
                <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider w-14">N°</th>
                <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider min-w-[180px]">Nom du cheval</th>
                <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider min-w-[130px]">Jockey</th>
                <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider min-w-[140px]">Musique</th>
                <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider w-20">Cote</th>
                {showExtra && (
                  <>
                    <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider min-w-[130px]">Entraîneur</th>
                    <th className="px-3 py-2.5 text-left text-xs text-text-muted font-semibold uppercase tracking-wider w-16">Poids</th>
                    <th className="px-3 py-2.5 text-center text-xs text-text-muted font-semibold uppercase tracking-wider w-16">Déf.</th>
                    <th className="px-3 py-2.5 text-center text-xs text-text-muted font-semibold uppercase tracking-wider w-14">NP</th>
                  </>
                )}
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row) => (
                <tr
                  key={row._key}
                  className={`transition-colors ${
                    row.non_partant
                      ? "bg-status-loss/5 opacity-60"
                      : "hover:bg-bg-hover"
                  }`}
                >
                  {/* N° */}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={row.numero}
                      onChange={e => update(row._key, "numero", e.target.value === "" ? "" : parseInt(e.target.value))}
                      className="w-12 px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-center text-sm focus:border-gold-primary focus:outline-none"
                    />
                  </td>
                  {/* Nom */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.nom_cheval}
                      onChange={e => update(row._key, "nom_cheval", e.target.value)}
                      placeholder="NOM DU CHEVAL"
                      className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm uppercase placeholder:normal-case placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                    />
                  </td>
                  {/* Jockey */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.jockey}
                      onChange={e => update(row._key, "jockey", e.target.value)}
                      placeholder="Jockey"
                      className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                    />
                  </td>
                  {/* Musique */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.musique}
                      onChange={e => update(row._key, "musique", e.target.value)}
                      placeholder="1p 2a 4a 0"
                      className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm font-mono placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                    />
                  </td>
                  {/* Cote */}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={row.cote}
                      onChange={e => update(row._key, "cote", e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="3.5"
                      className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm text-right placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                    />
                  </td>
                  {/* Colonnes extra */}
                  {showExtra && (
                    <>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.entraineur}
                          onChange={e => update(row._key, "entraineur", e.target.value)}
                          placeholder="Entraîneur"
                          className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={50}
                          max={70}
                          step={0.5}
                          value={row.poids_kg}
                          onChange={e => update(row._key, "poids_kg", e.target.value === "" ? "" : parseFloat(e.target.value))}
                          placeholder="58"
                          className="w-full px-2 py-1 bg-bg-elevated border border-border rounded text-text-primary text-sm text-right placeholder:text-text-muted focus:border-gold-primary focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.deferre}
                          onChange={e => update(row._key, "deferre", e.target.checked)}
                          className="w-4 h-4 accent-gold-primary rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.non_partant}
                          onChange={e => update(row._key, "non_partant", e.target.checked)}
                          className="w-4 h-4 accent-status-loss rounded"
                        />
                      </td>
                    </>
                  )}
                  {/* Supprimer */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row._key)}
                      className="p-1 text-text-muted hover:text-status-loss transition-colors rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-text-muted text-sm mb-3">Aucun partant — ajoute la première ligne</p>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-lg transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" /> Ajouter un partant
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bouton enregistrer bas de page */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-dark disabled:opacity-60 text-bg-primary font-bold text-sm rounded-xl transition-colors shadow-gold"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Enregistrement…" : `Enregistrer ${rows.filter(r => r.nom_cheval.trim()).length} partant(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
