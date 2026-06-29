"use client";

import { useEffect, useState } from "react";
import {
  ListChecks, Calculator, Save, Loader2, CheckCircle2, XCircle, Crown, Star, Flame, Link2,
} from "lucide-react";
import { parseConsensus } from "@/lib/consensus/parse";
import { buildConsensus, type ConsensusResult, type PartantScored } from "@/lib/consensus/engine";
import { findBestCourseMatch, parseReunionCourse, type CourseLite } from "@/lib/consensus/matcher";

const PLACEHOLDER = `# Colle la table : 1 ligne par cheval
# Format : numero  citations  [cote]  [bases]
11 28 3.2 12
10 25 4.0 8
8 22 4.8 5
5 18 6.0 3
7 15 8.0 2
4 12 9.5 1
6 10 11 1
12 8 18 0
2 6 22 0`;

const CAT_STYLE: Record<string, string> = {
  FAVORI: "text-gold-primary",
  OUTSIDER: "text-blue-400",
  TOCARD: "text-purple-400",
};

function Chip({ p, nb }: { p: PartantScored; nb: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-elevated border border-border text-sm">
      <span className="font-bold text-text-primary">{p.numero}</span>
      <span className="text-text-muted text-xs">{p.citations}/{nb}</span>
    </span>
  );
}

function TopCard({ titre, items, nb, color }: { titre: string; items: PartantScored[]; nb: number; color: string }) {
  return (
    <div className="card-base p-4">
      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{titre}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? <span className="text-text-muted text-xs">—</span> : items.map((p) => <Chip key={p.numero} p={p} nb={nb} />)}
      </div>
    </div>
  );
}

export default function ConsensusPage() {
  const [dateCourse, setDateCourse] = useState("");
  const [hippodrome, setHippodrome] = useState("");
  const [course, setCourse] = useState("");
  const [typePari, setTypePari] = useState("QUINTE_PLUS");
  const [nbPartants, setNbPartants] = useState<number | "">("");
  const [nbSources, setNbSources] = useState<number>(30);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ConsensusResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [courseId, setCourseId] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [manualPick, setManualPick] = useState(false);

  // Charge les courses du jour quand la date change
  useEffect(() => {
    if (!dateCourse) { setCourses([]); setCourseId(""); setManualPick(false); return; }
    let cancelled = false;
    setCoursesLoading(true);
    setManualPick(false);
    fetch(`/api/admin/consensus?date=${dateCourse}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCourses(Array.isArray(d.courses) ? d.courses : []); })
      .catch(() => { if (!cancelled) setCourses([]); })
      .finally(() => { if (!cancelled) setCoursesLoading(false); });
    return () => { cancelled = true; };
  }, [dateCourse]);

  // Auto-rattachement (tant que l'admin n'a pas choisi manuellement)
  useEffect(() => {
    if (courses.length === 0 || manualPick) return;
    const rc = parseReunionCourse(course);
    const best = findBestCourseMatch({ hippodrome, reunion: rc.reunion, course: rc.course }, courses);
    setCourseId(best ? best.courseId : "");
  }, [courses, hippodrome, course, manualPick]);

  function analyser() {
    const { partants, errors } = parseConsensus(raw);
    setParseErrors(errors);
    setSaveStatus("idle");
    setSaveMsg("");
    setResult(partants.length === 0 ? null : buildConsensus({ nbSources: nbSources || 30, partants }));
  }

  async function enregistrer() {
    if (!result) return;
    setSaveStatus("loading");
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: {
            date_course: dateCourse || null, hippodrome, course,
            type_pari: typePari, nb_partants: nbPartants || null, nb_sources: nbSources,
            course_id: courseId || null,
          },
          partants: parseConsensus(raw).partants,
          resultat: { elite: result.elite, pro: result.pro, topCites: result.topCites.map((p) => p.numero) },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveStatus("error"); setSaveMsg(data.error || "Erreur"); return; }
      setSaveStatus("success"); setSaveMsg("✓ Consensus enregistré");
    } catch {
      setSaveStatus("error"); setSaveMsg("Erreur réseau — réessayez");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-3">
          <ListChecks className="w-6 h-6 text-gold-primary" />
          Consensus de la presse
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Colle la table de citations (Cowork) → synthèse instantanée : tops favoris / outsiders / tocards + sélection Elite-6 & Pro-8. Usage interne, jamais republié.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Saisie ── */}
        <div className="lg:col-span-1 space-y-5">
          <div className="card-base p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs font-semibold">Date</label>
                <input type="date" value={dateCourse} onChange={(e) => setDateCourse(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-text-muted text-xs font-semibold">Type</label>
                <select value={typePari} onChange={(e) => setTypePari(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none">
                  <option value="QUINTE_PLUS">Quinté+</option>
                  <option value="QUARTE">Quarté+</option>
                  <option value="TIERCE">Tiercé</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-text-muted text-xs font-semibold">Hippodrome</label>
              <input value={hippodrome} onChange={(e) => setHippodrome(e.target.value)} placeholder="Vincennes…"
                className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted" />
            </div>
            <div>
              <label className="text-text-muted text-xs font-semibold">Course</label>
              <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Prix… / R1C1"
                className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted" />
            </div>
            {/* Rattachement à une course du programme (pour l'affichage abonné) */}
            <div>
              <label className="text-text-muted text-xs font-semibold flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> Course liée {coursesLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </label>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setManualPick(true); }}
                disabled={!dateCourse || courses.length === 0}
                className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none disabled:opacity-50">
                <option value="">{!dateCourse ? "Choisis une date d'abord" : courses.length === 0 ? "Aucune course ce jour" : "— Non liée —"}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.hippodrome ?? "?")} R{c.numero_reunion}C{c.numero_course}{c.libelle ? ` — ${c.libelle}` : ""}
                  </option>
                ))}
              </select>
              {courseId && !manualPick && (
                <p className="text-status-win text-[11px] mt-1">✓ Rattachée automatiquement — vérifie</p>
              )}
              {!courseId && dateCourse && courses.length > 0 && (
                <p className="text-gold-light/80 text-[11px] mt-1">Non liée → le consensus ne s'affichera pas sur la fiche course.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-muted text-xs font-semibold">Nb partants</label>
                <input type="number" min={1} value={nbPartants} onChange={(e) => setNbPartants(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-text-muted text-xs font-semibold">Nb sources presse</label>
                <input type="number" min={1} value={nbSources} onChange={(e) => setNbSources(Number(e.target.value) || 1)}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-elevated border border-border text-text-primary text-sm rounded-lg focus:border-gold-primary/50 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="card-base p-5">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Table de citations</label>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={12} placeholder={PLACEHOLDER}
              className="w-full mt-2 px-3 py-2.5 bg-bg-elevated border border-border text-text-primary text-sm font-mono rounded-xl focus:border-gold-primary/50 focus:outline-none placeholder:text-text-muted resize-none" />
            <p className="text-text-muted text-xs mt-1">Format : <code>numero citations [cote] [bases]</code> — 1 cheval/ligne.</p>
            <button onClick={analyser} disabled={!raw.trim()}
              className="w-full mt-3 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Calculator className="w-4 h-4" /> Analyser
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="card-base p-4 border-status-loss/30">
              <p className="text-status-loss text-xs font-semibold mb-1">Avertissements de lecture :</p>
              {parseErrors.map((e, i) => <p key={i} className="text-text-muted text-xs">• {e}</p>)}
            </div>
          )}
        </div>

        {/* ── Résultats ── */}
        <div className="lg:col-span-2 space-y-5">
          {!result ? (
            <div className="card-base p-10 text-center text-text-muted text-sm">
              Colle la table puis clique <span className="text-gold-primary font-semibold">Analyser</span> pour voir le consensus.
            </div>
          ) : (
            <>
              {/* Plans Elite / Pro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { titre: "ELITE (6)", plan: result.elite, icon: Crown, accent: "border-gold-primary/40" },
                  { titre: "PRO (8)", plan: result.pro, icon: Star, accent: "border-blue-400/40" },
                ].map(({ titre, plan, icon: Icon, accent }) => (
                  <div key={titre} className={`card-base p-5 border-2 ${accent}`}>
                    <p className="font-bold text-text-primary text-sm flex items-center gap-2 mb-3">
                      <Icon className="w-4 h-4 text-gold-primary" /> {titre}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {plan.selection.map((n) => (
                        <span key={n} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold-faint border border-gold-primary/30 text-gold-light font-bold text-sm">{n}</span>
                      ))}
                    </div>
                    <div className="text-xs text-text-muted space-y-0.5">
                      <p><span className="text-text-secondary font-semibold">Base :</span> {plan.base.join(" · ") || "—"}</p>
                      <p><span className="text-blue-400 font-semibold">Value :</span> {plan.value.join(" · ") || "—"}</p>
                      <p><span className="text-purple-400 font-semibold">Coup :</span> {plan.coup.join(" · ") || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tops */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TopCard titre="Top chevaux cités" items={result.topCites} nb={result.nbSources} color="text-text-primary" />
                <TopCard titre="Top favoris cités" items={result.topFavoris} nb={result.nbSources} color={CAT_STYLE.FAVORI} />
                <TopCard titre="Top outsiders cités" items={result.topOutsiders} nb={result.nbSources} color={CAT_STYLE.OUTSIDER} />
                <TopCard titre="Top tocards cités" items={result.topTocards} nb={result.nbSources} color={CAT_STYLE.TOCARD} />
              </div>

              {/* Table complète */}
              <div className="card-base p-5">
                <p className="font-semibold text-text-primary text-sm mb-3">Détail ({result.partants.length} chevaux · {result.nbSources} sources)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted text-xs border-b border-border">
                        <th className="text-left py-1.5 px-2">N°</th>
                        <th className="text-right py-1.5 px-2">Citations</th>
                        <th className="text-right py-1.5 px-2">Taux</th>
                        <th className="text-right py-1.5 px-2">Bases</th>
                        <th className="text-right py-1.5 px-2">Cote</th>
                        <th className="text-left py-1.5 px-2">Catégorie</th>
                        <th className="text-right py-1.5 px-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.partants.map((p) => (
                        <tr key={p.numero} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-bold text-text-primary">{p.numero}</td>
                          <td className="py-1.5 px-2 text-right text-text-secondary">{p.citations}</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{Math.round(p.tauxCitation * 100)}%</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{p.bases || "—"}</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{p.cote == null ? "—" : p.cote}</td>
                          <td className={`py-1.5 px-2 font-semibold ${CAT_STYLE[p.categorie] || ""}`}>{p.categorie}</td>
                          <td className="py-1.5 px-2 text-right text-text-secondary">{p.scoreConsensus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enregistrer */}
              <div className="flex items-center gap-3">
                <button onClick={enregistrer} disabled={saveStatus === "loading"}
                  className="flex items-center gap-2 px-5 py-2.5 bg-bg-elevated border border-gold-primary/30 hover:border-gold-primary/60 text-gold-light font-bold text-sm rounded-xl transition-colors disabled:opacity-50">
                  {saveStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer ce consensus
                </button>
                {saveStatus === "success" && <span className="flex items-center gap-1.5 text-status-win text-sm"><CheckCircle2 className="w-4 h-4" />{saveMsg}</span>}
                {saveStatus === "error" && <span className="flex items-center gap-1.5 text-status-loss text-sm"><XCircle className="w-4 h-4" />{saveMsg}</span>}
              </div>

              <div className="flex items-start gap-2 text-text-muted text-xs">
                <Flame className="w-3.5 h-3.5 text-gold-primary flex-shrink-0 mt-0.5" />
                <p>Signal d'aide à la décision (interne). L'edge vient des <span className="text-blue-400">outsiders</span>/<span className="text-purple-400">tocards</span> bien cités + ta validation — pas du consensus brut. Aucune promesse de gain.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
