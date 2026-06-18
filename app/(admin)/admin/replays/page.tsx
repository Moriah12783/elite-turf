/**
 * /admin/replays — curation des replays OFFICIELS affichés sur « Le Direct ».
 *
 * On colle un lien YouTube d'une chaîne officielle (Equidia, France Galop,
 * Le Trot, PMU) ; le site l'intègre via l'embed YouTube standard. Aucune vidéo
 * n'est hébergée ni rediffusée.
 */

import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import { PlayCircle, Trash2, Plus, CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = { title: "Replays — Admin Elite Turf" };
export const dynamic = "force-dynamic";

const INPUT =
  "w-full mt-1 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary text-sm focus:border-gold-primary/50 focus:outline-none";

const ERRORS: Record<string, string> = {
  champs: "Lien YouTube, titre et date sont requis (et le lien doit être une vidéo YouTube valide).",
  serveur: "Erreur serveur. Réessayez.",
};

export default async function AdminReplaysPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  const supabase = createServiceClient();
  const { data: replays } = await supabase
    .from("replays")
    .select("id, date_course, titre, youtube_id, hippodrome")
    .order("date_course", { ascending: false })
    .order("ordre", { ascending: true })
    .limit(100);

  const list = replays ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <PlayCircle className="w-6 h-6 text-gold-primary" />
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Replays</h1>
          <p className="text-text-secondary text-sm mt-1">
            Replays <strong>officiels</strong> affichés sur « Le Direct ». Colle un lien YouTube
            d&apos;une chaîne officielle.
          </p>
        </div>
      </div>

      {searchParams.ok && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-status-win/10 border border-status-win/30 text-status-win text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Enregistré.
        </div>
      )}
      {searchParams.error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-status-loss/10 border border-status-loss/30 text-status-loss text-sm font-semibold">
          <AlertCircle className="w-4 h-4" /> {ERRORS[searchParams.error] || "Erreur."}
        </div>
      )}

      {/* Ajout */}
      <form action="/api/admin/replays" method="POST" className="card-base p-5 space-y-4">
        <input type="hidden" name="_action" value="add" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider sm:col-span-2">
            Lien ou ID YouTube (chaîne officielle)
            <input
              name="youtube"
              required
              placeholder="https://www.youtube.com/watch?v=…"
              className={INPUT}
            />
          </label>
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
            Titre
            <input name="titre" required placeholder="Quinté+ de Vincennes" className={INPUT} />
          </label>
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
            Hippodrome (optionnel)
            <input name="hippodrome" placeholder="Vincennes" className={INPUT} />
          </label>
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
            Date de la course
            <input type="date" name="date_course" required defaultValue={todayParisISO()} className={INPUT} />
          </label>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Ajouter le replay
        </button>
      </form>

      {/* Liste */}
      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary text-sm">{list.length} replay(s)</h2>
        </div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-text-secondary text-sm">Aucun replay pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-4">
                <div className="w-24 aspect-video rounded-lg overflow-hidden bg-bg-elevated flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${r.youtube_id}/mqdefault.jpg`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-semibold truncate">{r.titre}</p>
                  <p className="text-text-muted text-xs truncate">
                    {[r.hippodrome, r.date_course].filter(Boolean).join(" · ")} · {r.youtube_id}
                  </p>
                </div>
                <form action="/api/admin/replays" method="POST">
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="p-2 text-text-muted hover:text-status-loss transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
