"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, ArrowRight, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface Commentaire { confiance: number; selection: number[]; analyse_courte: string; analyse_complete: string }
interface Draft {
  id: string;
  date_course: string;
  reunion_course: string;
  hippodrome: string | null;
  nb_partants: number | null;
  course_id: string | null;
  run_type: string;
  type_pari: string;
  nb_sources: number;
  echantillon_reduit: boolean;
  citations: { numero: number; citations: number; bases: number }[];
  commentaires: { elite: Commentaire | null; pro: Commentaire | null } | null;
  status: string;
  created_at: string;
}

const RUN_LABEL: Record<string, string> = { matin: "Matin 10h", filet_j1: "Filet J-1", sentinelle: "Sentinelle" };

export default function BrouillonsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");

  function load() {
    setLoading(true);
    fetch("/api/admin/consensus/drafts")
      .then((r) => r.json())
      .then((d) => setDrafts(Array.isArray(d.drafts) ? d.drafts : []))
      .catch(() => setDrafts([]))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function rejeter(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/admin/consensus/drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-3">
          <Inbox className="w-6 h-6 text-gold-primary" />
          Brouillons en attente
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Consensus déposés par le pipeline. Relis dans l&apos;atelier, ajuste, puis publie — <span className="text-text-primary">rien n&apos;est publié sans toi</span>.
        </p>
      </div>

      {loading ? (
        <div className="card-base p-10 text-center text-text-muted text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : drafts.length === 0 ? (
        <div className="card-base p-10 text-center text-text-muted text-sm">
          Aucun brouillon en attente. Le pipeline déposera ici ses prochains consensus.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {drafts.map((d) => {
            const orphan = !d.course_id;
            const elite = d.commentaires?.elite;
            const pro = d.commentaires?.pro;
            return (
              <div key={d.id} className="card-base p-5 border border-border">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-bold text-text-primary">{d.hippodrome || "—"} {d.reunion_course}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary border border-border">{RUN_LABEL[d.run_type] || d.run_type}</span>
                  <span className="text-xs text-text-muted">{d.date_course} · {d.nb_sources} sources</span>
                  {d.echantillon_reduit && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gold-primary/10 text-gold-light border border-gold-primary/30">⚠️ Échantillon réduit</span>
                  )}
                  {orphan && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-status-loss/10 text-status-loss border border-status-loss/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Course à rattacher
                    </span>
                  )}
                </div>

                {(elite || pro) && (
                  <div className="text-xs text-text-secondary space-y-1 mb-4">
                    {elite && <p><b className="text-gold-light">Elite-{elite.selection.length}</b> : {elite.selection.join(" · ")}</p>}
                    {pro && <p><b className="text-blue-400">Pro-{pro.selection.length}</b> : {pro.selection.join(" · ")}</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/consensus?draft=${d.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors"
                  >
                    Ouvrir dans l&apos;atelier <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => rejeter(d.id)}
                    disabled={busyId === d.id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-bg-elevated hover:bg-bg-card text-text-secondary text-sm rounded-xl border border-border transition-colors disabled:opacity-50"
                  >
                    {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Rejeter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
