/**
 * /admin/radar — Archive du Radar de la presse.
 *
 * Lit `radar_snapshots` (scellement quotidien write-once, PR #304) : ce qui a
 * RÉELLEMENT été montré au public chaque jour — pas un recalcul. Chaque
 * sélection est confrontée à l'arrivée officielle : placés dans le top 5,
 * bloc par bloc (base / value / coup), avec le point de comparaison « hasard »
 * (espérance d'une sélection aléatoire de même taille).
 *
 * Distinct du Banc de mesure : le banc RECALCULE le consensus depuis les
 * brouillons pour mesurer la méthode ; ici on montre l'ARCHIVE SCELLÉE, la
 * seule opposable (« voilà ce qui était affiché ce jour-là »).
 *
 * Auth : DOUBLE barrière — le layout (admin)/admin/layout.tsx redirige les
 * non-ADMIN, ET cette page revérifie le rôle avant toute lecture service_role
 * (defense in depth : un layout peut être sauté par une requête RSC forgée en
 * navigation douce ; la page, elle, n'est jamais rendue sans ce contrôle).
 * Calculs : lib/consensus/radar-archive.ts (pur, testé).
 */
import { redirect } from "next/navigation";
import { Radar, ShieldCheck, History, AlertTriangle } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  computeArchiveRow,
  aggregateArchive,
  type ArchiveRow,
  type SnapshotArchiveInput,
} from "@/lib/consensus/radar-archive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archive du Radar — Admin" };

/** Résultat de lecture : soit l'archive, soit une panne explicite (jamais un
 *  faux « vide » qui ferait croire à une table vide alors que la lecture a
 *  échoué — un chiffre tronqué présenté comme complet est pire que rien). */
type ArchiveResult =
  | { erreur: false; rows: ArchiveRow[] }
  | { erreur: true; message: string };

/** Redirige si l'appelant n'est pas ADMIN — indépendamment du layout. */
async function exigerAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/admin/radar");
  const adminClient = createServiceClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") redirect("/");
}

async function getArchive(): Promise<ArchiveResult> {
  const supabase = createServiceClient();

  // PostgREST plafonne à 1000 lignes par défaut : borne explicite pour que la
  // troncature soit un choix visible, pas une surprise silencieuse (à ~1/jour,
  // 2000 = plus de 5 ans de marge ; à revoir en pagination bien avant).
  const { data: snaps, error: errSnaps } = await supabase
    .from("radar_snapshots")
    .select(
      "date_course, origine, reunion_course, hippodrome, type_pari, nb_partants, nb_sources, course_id, base, value, coup, selection, favori_presse, favori_marche",
    )
    .order("date_course", { ascending: false })
    .limit(2000);
  if (errSnaps) {
    console.error("[admin/radar] lecture radar_snapshots:", errSnaps.message);
    return { erreur: true, message: "Lecture de l'archive impossible (radar_snapshots)." };
  }
  if (!snaps || snaps.length === 0) return { erreur: false, rows: [] };

  // Arrivées des courses liées, par paquets (Supabase borne les .in()).
  const courseIds: string[] = [];
  for (const s of snaps as any[]) {
    if (s.course_id && courseIds.indexOf(s.course_id) === -1) courseIds.push(s.course_id);
  }
  const arriveeByCourse: Record<string, number[]> = {};
  for (let i = 0; i < courseIds.length; i += 200) {
    const chunk = courseIds.slice(i, i + 200);
    const { data: courses, error: errCourses } = await supabase
      .from("courses")
      .select("id, arrivee_officielle")
      .in("id", chunk);
    if (errCourses) {
      // Un chunk en échec exclurait ~200 courses de « jugées » sans le dire →
      // stats faussement basses présentées comme complètes. On refuse plutôt.
      console.error("[admin/radar] lecture courses:", errCourses.message);
      return { erreur: true, message: "Lecture des arrivées impossible — archive incomplète, chiffres masqués." };
    }
    for (const c of (courses ?? []) as any[]) {
      arriveeByCourse[c.id] = parseArrivee(c.arrivee_officielle);
    }
  }

  const rows = (snaps as any[]).map((s) => {
    const input: SnapshotArchiveInput = {
      date_course:    s.date_course,
      origine:        s.origine,
      reunion_course: s.reunion_course,
      hippodrome:     s.hippodrome,
      type_pari:      s.type_pari,
      nb_partants:    s.nb_partants,
      nb_sources:     s.nb_sources,
      base:           Array.isArray(s.base) ? s.base : [],
      value:          Array.isArray(s.value) ? s.value : [],
      coup:           Array.isArray(s.coup) ? s.coup : [],
      selection:      Array.isArray(s.selection) ? s.selection : [],
      favori_presse:  s.favori_presse ?? null,
      favori_marche:  s.favori_marche ?? null,
      arrivee:        s.course_id ? arriveeByCourse[s.course_id] || [] : [],
    };
    return computeArchiveRow(input);
  });
  return { erreur: false, rows };
}

/**
 * Parse une arrivée officielle en préservant l'ORDRE et le RANG. Un trou
 * (valeur non finie) TRONQUE plutôt que de compacter : compacter promeut le
 * 6ᵉ au rang d'un 5ᵉ manquant et fausse chaque rang suivant d'un cran. Mieux
 * vaut un top 5 court (→ non jugé) qu'un top 5 faux.
 */
function parseArrivee(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isFinite(n)) break; // trou → on s'arrête, on ne décale pas
    out.push(n);
  }
  return out;
}

function fmtDate(iso: string): string {
  // "2026-08-07" → "07/08/26". L'année compte : l'archive est cumulative et
  // franchit les années — deux « 07/08 » de millésimes différents seraient
  // indistinguables (finding revue).
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso;
}

function pct(n: number, d: number): string {
  // Signe collé au nombre, comme le reste de l'admin (banc-mesure).
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

/** Chip d'un numéro : doré plein si placé dans le top 5, discret sinon. */
function Num({ n, hit }: { n: number; hit: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.6rem] px-1 py-0.5 rounded-md text-xs font-bold tabular-nums ${
        hit
          ? "bg-status-win/15 text-status-win border border-status-win/40"
          : "bg-bg-elevated text-text-muted border border-border"
      }`}
    >
      {n}
    </span>
  );
}

function Bloc({ nums, top5 }: { nums: number[]; top5: number[] }) {
  if (nums.length === 0) return <span className="text-text-muted text-xs">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {nums.map((n) => (
        <Num key={n} n={n} hit={top5.indexOf(n) !== -1} />
      ))}
    </span>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <p className="text-text-muted text-[11px] uppercase tracking-wider leading-tight">{label}</p>
      <p className={`font-serif text-2xl font-bold mt-1 ${accent ?? "text-text-primary"}`}>{value}</p>
      {sub && <p className="text-text-muted text-[11px] mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

export default async function AdminRadarPage() {
  await exigerAdmin();
  const res = await getArchive();
  const rows = res.erreur ? [] : res.rows;
  const agg = aggregateArchive(rows);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-3">
          <Radar className="w-6 h-6 text-gold-primary" />
          Archive du Radar de la presse
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          La sélection publique <span className="text-gold-primary font-semibold">scellée chaque jour</span> (write-once),
          face à l&apos;arrivée officielle. Ce qui a été montré, pas un recalcul.
        </p>
      </div>

      {res.erreur ? (
        <div className="card-base p-6 flex items-start gap-3 border border-status-loss/40">
          <AlertTriangle className="w-5 h-5 text-status-loss flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-status-loss">Données indisponibles</p>
            <p className="text-text-secondary mt-1">
              {res.message} Les chiffres ne sont pas affichés pour ne pas induire en erreur. Réessaie, ou vérifie la base.
            </p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card-base p-10 text-center text-text-muted text-sm">
          Aucun scellement pour l&apos;instant — la table se remplit au premier affichage de la home chaque jour.
        </div>
      ) : (
        <>
          {/* Synthèse */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile label="Courses jugées" value={`${agg.nJugees}`} sub={`sur ${agg.nTotal} scellées`} />
            <StatTile
              label="Placés / course"
              value={agg.placesMoyenne != null ? agg.placesMoyenne.toFixed(2) : "—"}
              sub={agg.hasardMoyen != null ? `hasard : ${agg.hasardMoyen.toFixed(2)}` : undefined}
              accent="text-gold-light"
            />
            <StatTile
              label="Vainqueur couvert"
              value={agg.pctVainqueurCouvert != null ? `${agg.pctVainqueurCouvert}%` : "—"}
              sub="le 1er est dans la sélection"
              accent="text-status-win"
            />
            <StatTile label="5 sur 5" value={`${agg.nCinqSurCinq}×`} sub="tout le top 5 couvert" accent="text-status-win" />
            <StatTile label="Bloc base" value={pct(agg.base.places, agg.base.slots)} sub={`${agg.base.places}/${agg.base.slots} slots placés`} />
            <StatTile
              label="Value + coup"
              value={pct(agg.value.places + agg.coup.places, agg.value.slots + agg.coup.slots)}
              sub={`value ${agg.value.places}/${agg.value.slots} · coup ${agg.coup.places}/${agg.coup.slots}`}
            />
          </div>

          {/* Archive */}
          <div className="card-base p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Course</th>
                  <th className="text-left py-2 px-2">Base</th>
                  <th className="text-left py-2 px-2">Value</th>
                  <th className="text-left py-2 px-2">Coup</th>
                  <th className="text-left py-2 px-2">Arrivée (top 5)</th>
                  <th className="text-right py-2 px-2">Placés</th>
                  <th className="text-center py-2 px-2">Scellé</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.date_course}-${r.origine}`} className="border-b border-border/50 align-top">
                    <td className="py-2.5 px-2 text-text-secondary whitespace-nowrap tabular-nums">{fmtDate(r.date_course)}</td>
                    <td className="py-2.5 px-2 text-text-muted whitespace-nowrap">
                      {[r.hippodrome, r.reunion_course].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-2.5 px-2"><Bloc nums={r.base} top5={r.top5} /></td>
                    <td className="py-2.5 px-2"><Bloc nums={r.value} top5={r.top5} /></td>
                    <td className="py-2.5 px-2"><Bloc nums={r.coup} top5={r.top5} /></td>
                    <td className="py-2.5 px-2 text-text-primary font-medium whitespace-nowrap tabular-nums">
                      {r.top5.length ? r.top5.join("-") : <span className="text-text-muted">pas d&apos;arrivée</span>}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {r.placesTop5 == null ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <span
                          className={
                            r.placesTop5 >= 5
                              ? "text-status-win font-bold"
                              : r.placesTop5 >= 3
                                ? "text-gold-light font-semibold"
                                : "text-text-secondary"
                          }
                        >
                          {r.placesTop5}/5{r.placesTop5 >= 5 ? " ✓" : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {r.origine === "live" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-win" title="Scellé au premier affichage public du jour">
                          <ShieldCheck className="w-3.5 h-3.5" /> live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-text-muted" title="Historique rejoué par le moteur (vue de fin de journée)">
                          <History className="w-3.5 h-3.5" /> reconst.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="card-base p-5 space-y-2 text-xs text-text-secondary">
            <p>
              <span className="font-semibold text-text-primary">Placés</span> = combien de chevaux de la sélection publique
              complète (8&nbsp;ch.) figurent dans les 5 premiers de l&apos;arrivée. Un chip <span className="text-status-win font-semibold">vert</span> = placé.
              Les jours où la presse cite peu d&apos;outsiders, la sélection est complétée pour atteindre 8&nbsp;: ce choix peut
              donc dépasser d&apos;un cheval les chips base/value/coup montrés. Seules les courses au top&nbsp;5 complet sont jugées.
              <span className="font-semibold text-text-primary"> Hasard</span> = ce qu&apos;une sélection aléatoire de même
              taille placerait en moyenne (taille × min(5, partants) ÷ partants) — la référence qui donne son sens à la moyenne.
            </p>
            <p className="text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 inline-block mr-1 text-status-win" />
              <span className="font-semibold">live</span> = figé au premier affichage public du jour (opposable).{" "}
              <History className="w-3.5 h-3.5 inline-block mx-1" />
              <span className="font-semibold">reconst.</span> = historique d&apos;avant le scellement (02/07 → 07/08), rejoué
              par le moteur sur les brouillons figés : fidèle pour juger la sélection, mais vue de fin de journée.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
