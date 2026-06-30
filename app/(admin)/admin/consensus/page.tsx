"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ListChecks, Calculator, Save, Loader2, CheckCircle2, XCircle, Crown, Star, Flame, Link2, Sparkles,
} from "lucide-react";
import { parseConsensus } from "@/lib/consensus/parse";
import { buildConsensus, type ConsensusResult, type PartantScored } from "@/lib/consensus/engine";
import { findBestCourseMatch, parseReunionCourse, type CourseLite } from "@/lib/consensus/matcher";
import { pickCoursesVedettes, type CourseForVedette, type CourseVedette } from "@/lib/turf/course-vedette";

type AdminCourse = CourseLite & CourseForVedette;

const PLACEHOLDER = `# Colle la table : 1 ligne par cheval
# Format : numero  citations  [bases]   (cote + nom ajoutés auto par Elite)
11 28 12
10 25 8
8 22 5
5 18 3
7 15 2
4 12 1
6 10 1
12 8 0
2 6 0`;

const CAT_STYLE: Record<string, string> = {
  FAVORI: "text-gold-primary",
  OUTSIDER: "text-blue-400",
  TOCARD: "text-purple-400",
};

// Divergence consensus presse × sélection stats (2×2).
const DIV_FLAG: Record<string, { label: string; cls: string }> = {
  BASE:  { label: "🟢 Base",  cls: "text-status-win" },     // cité ET stats fortes
  VALUE: { label: "🔵 Value", cls: "text-blue-400" },       // stats fortes, peu cité (data voit ce que la presse rate)
  PIEGE: { label: "🟡 Piège", cls: "text-gold-light" },     // cité mais stats faibles (surcote/hype)
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
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [manualPick, setManualPick] = useState(false);
  const [coursePartants, setCoursePartants] = useState<Record<number, { cote: number | null; nom: string | null; statRank: number | null; statLabel: string | null }>>({});

  // Défaut = date du jour (effet client-only → pas de mismatch d'hydratation)
  useEffect(() => {
    setDateCourse(new Date().toISOString().slice(0, 10));
  }, []);

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

  // Course(s) vedette(s) du jour (déterministe, depuis les paris dispo)
  const vedettes = useMemo(() => pickCoursesVedettes(courses, 2), [courses]);
  const vedette = vedettes.length > 0 ? vedettes[0] : null;

  // Auto-rattachement (tant que l'admin n'a pas choisi manuellement) :
  // sans hippodrome saisi → on propose la vedette du jour ; sinon → match hippodrome.
  useEffect(() => {
    if (courses.length === 0 || manualPick) return;
    if (!hippodrome.trim()) {
      setCourseId(vedette ? vedette.id : "");
      return;
    }
    const rc = parseReunionCourse(course);
    const best = findBestCourseMatch({ hippodrome, reunion: rc.reunion, course: rc.course }, courses);
    setCourseId(best ? best.courseId : "");
  }, [courses, hippodrome, course, manualPick, vedette]);

  // Cote + nom des partants de la course liée → enrichissement « à notre niveau »
  // (la cote vient de PMU/Geny déjà en base, jamais saisie par Cowork).
  useEffect(() => {
    if (!courseId) { setCoursePartants({}); return; }
    let cancelled = false;
    setCoursePartants({}); // neutre pendant le fetch → jamais la cote d'une autre course
    fetch(`/api/admin/consensus?courseId=${courseId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const map: Record<number, { cote: number | null; nom: string | null; statRank: number | null; statLabel: string | null }> = {};
        (Array.isArray(d.partants) ? d.partants : []).forEach((p: any) => {
          if (p && p.numero != null) map[p.numero] = { cote: p.cote ?? null, nom: p.nom ?? null, statRank: p.statRank ?? null, statLabel: p.statLabel ?? null };
        });
        setCoursePartants(map);
      })
      .catch(() => { if (!cancelled) setCoursePartants({}); });
    return () => { cancelled = true; };
  }, [courseId]);

  // Auto-détecte « Nb sources : N » dans le texte collé → renseigne le champ
  // (permet de coller l'email Cowork entier sans régler la main).
  useEffect(() => {
    const { nbSources: ns } = parseConsensus(raw);
    if (ns && ns > 0) setNbSources(ns);
  }, [raw]);

  // Une analyse devient périmée si la course liée (donc ses cotes) ou le nombre
  // de sources change → on force une nouvelle Analyse (cohérence + anti-fabrication).
  useEffect(() => { setResult(null); }, [coursePartants, nbSources]);

  // Fusionne cote + nom (depuis la course liée) dans les partants parsés.
  function enrichedPartants() {
    const { partants, errors } = parseConsensus(raw);
    const merged = partants.map((p) => {
      const cp = coursePartants[p.numero];
      return cp ? { ...p, cote: cp.cote, nom: cp.nom ?? p.nom } : p;
    });
    return { partants: merged, errors };
  }

  // Divergence presse × stats : "fort presse" = top 8 du consensus ; "fort stats"
  // = présent dans la sélection stats (top 8 déterministe).
  const pressTop8 = useMemo(() => {
    const s: Record<number, boolean> = {};
    if (result) result.partants.slice(0, 8).forEach((p) => { s[p.numero] = true; });
    return s;
  }, [result]);

  // La divergence n'a de sens que si la sélection stats est chargée (course liée +
  // forme/cotes en base) — sinon on n'affiche aucun flag (évite un faux « Piège »).
  const statsAvailable = useMemo(
    () => Object.keys(coursePartants).some((k) => coursePartants[Number(k)]?.statRank != null),
    [coursePartants],
  );

  function divergenceCode(numero: number): "BASE" | "VALUE" | "PIEGE" | null {
    if (!statsAvailable) return null;
    const inPress = !!pressTop8[numero];
    const inStats = coursePartants[numero]?.statRank != null;
    if (inPress && inStats) return "BASE";
    if (inStats) return "VALUE";
    if (inPress) return "PIEGE";
    return null;
  }

  // Transformer le consensus en pronostic : deep-link vers le formulaire existant
  // « Nouveau pronostic », pré-rempli + éditable. L'admin ajuste et publie lui-même.
  function creerPronostic(niveau: "ELITE" | "PRO") {
    if (!result || !courseId) return;
    const sel = niveau === "ELITE" ? result.elite.selection : result.pro.selection;
    const params = new URLSearchParams({
      courseId,
      niveau_acces: niveau,
      type_pari: typePari,
      selection: sel.join(","),
    });
    window.location.href = `/admin/pronostics/nouveau?${params.toString()}`;
  }

  function utiliserVedette(v: CourseVedette) {
    setCourseId(v.id);
    setManualPick(true);
    if (v.hippodrome) setHippodrome(v.hippodrome);
    if (v.numero_reunion != null && v.numero_course != null) setCourse(`R${v.numero_reunion}C${v.numero_course}`);
    if (v.nb_partants) setNbPartants(v.nb_partants);
    // Le <select> typePari n'a que QUINTE_PLUS/QUARTE/TIERCE → on aplatit
    // QUARTE_PLUS sur QUARTE (intentionnel, vocabulaire du select).
    setTypePari(
      v.pari_principal === "TIERCE" ? "TIERCE"
        : (v.pari_principal === "QUARTE" || v.pari_principal === "QUARTE_PLUS") ? "QUARTE"
        : "QUINTE_PLUS",
    );
  }

  function analyser() {
    const { partants, errors } = enrichedPartants();
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
          partants: result.partants, // même source que `resultat` → jamais de divergence
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
          {/* Course vedette du jour (auto) → ferme la boucle : on sait quoi remplir */}
          {vedette && (
            <div className="card-base p-4 border border-gold-primary/30 bg-gold-faint/40">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-light flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Course vedette du jour
              </p>
              <p className="text-text-primary text-sm font-semibold">
                {vedette.hippodrome ?? "?"}{vedette.numero_reunion != null ? ` R${vedette.numero_reunion}` : ""}{vedette.numero_course != null ? `C${vedette.numero_course}` : ""}
              </p>
              <p className="text-text-muted text-xs mt-0.5">{vedette.raison}</p>
              <button
                onClick={() => utiliserVedette(vedette)}
                className="mt-2.5 w-full px-3 py-1.5 rounded-lg bg-gold-primary text-bg-primary text-xs font-bold hover:bg-gold-dark transition-colors"
              >
                Utiliser cette course
              </button>
            </div>
          )}
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
            <p className="text-text-muted text-xs mt-1">Format : <code>numero citations [bases]</code> — 1 cheval/ligne. La <span className="text-text-secondary">cote + le nom</span> sont ajoutés auto depuis la course liée.</p>
            {courseId && Object.keys(coursePartants).length > 0 && (
              <p className="text-status-win text-[11px] mt-0.5">✓ {Object.keys(coursePartants).length} cotes + noms chargés depuis la course liée.</p>
            )}
            {courseId && Object.keys(coursePartants).length === 0 && (
              <p className="text-gold-light/80 text-[11px] mt-0.5">Pas de cote en base pour cette course → clique « Enrichir PMU » sur la fiche course (sinon analyse sans cote).</p>
            )}
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
                        <th className="text-left py-1.5 px-2">Stats</th>
                        <th className="text-left py-1.5 px-2">Signal</th>
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
                          <td className="py-1.5 px-2 text-text-muted text-xs">{coursePartants[p.numero]?.statLabel ?? "—"}</td>
                          <td className="py-1.5 px-2 text-xs">
                            {(() => {
                              const d = divergenceCode(p.numero);
                              return d
                                ? <span className={`font-semibold ${DIV_FLAG[d].cls}`}>{DIV_FLAG[d].label}</span>
                                : <span className="text-text-muted">—</span>;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-text-muted text-[11px] mt-3 leading-relaxed">
                  <span className="font-semibold text-text-secondary">Signal (presse × stats)</span> — <span className="text-status-win font-semibold">🟢 Base</span> : cité ET stats fortes (consensus solide). <span className="text-blue-400 font-semibold">🔵 Value</span> : stats fortes mais peu cité (la data voit ce que la presse rate). <span className="text-gold-light font-semibold">🟡 Piège</span> : très cité mais stats faibles (surcote/hype). Colonne <span className="text-text-secondary">Stats</span> = sélection stats déterministe. Aide à la décision — c'est toi qui tranches l'Elite-6 / Pro-8.
                </p>
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

              {/* Transformer en pronostic — sélection pré-remplie + éditable, tu publies toi-même */}
              <div className="card-base p-4 space-y-2">
                <p className="text-text-secondary text-xs">
                  Transformer en pronostic : la sélection est <span className="text-text-primary font-semibold">pré-remplie et éditable</span> dans le formulaire — tu l'ajustes (ton coup d'œil d'expert), tu écris l'analyse, puis tu publies toi-même (Brouillon ou Publier).
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => creerPronostic("ELITE")} disabled={!courseId}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 font-bold text-sm rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Crown className="w-4 h-4" /> Créer pronostic Elite ({result.elite.selection.length})
                  </button>
                  <button onClick={() => creerPronostic("PRO")} disabled={!courseId}
                    className="flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/30 text-gold-light hover:border-gold-primary/60 font-bold text-sm rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Star className="w-4 h-4" /> Créer pronostic Pro ({result.pro.selection.length})
                  </button>
                  {!courseId && <span className="text-gold-light/80 text-[11px]">Lie d'abord une course (« Course liée ») pour créer le pronostic.</span>}
                </div>
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
