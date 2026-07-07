"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListChecks, Calculator, Save, Loader2, CheckCircle2, XCircle, Crown, Star, Flame, Link2, Sparkles, Inbox,
} from "lucide-react";
import { parseConsensus } from "@/lib/consensus/parse";
import { buildConsensus, type ConsensusResult, type PartantScored } from "@/lib/consensus/engine";
import { buildAnalyseDraft } from "@/lib/consensus/analyse-draft";
import type { ValidationReport } from "@/lib/consensus/validate";
import { findBestCourseMatch, parseReunionCourse, type CourseLite } from "@/lib/consensus/matcher";
import { pickCoursesVedettes, type CourseForVedette, type CourseVedette } from "@/lib/turf/course-vedette";

type AdminCourse = CourseLite & CourseForVedette;

const PLACEHOLDER = `# Colle le bloc : 1 ligne par cheval — 3 entiers OBLIGATOIRES
# Format v2.4 : numero  citations  bases   (JAMAIS de cote — Elite l'ajoute)
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
  const [valReport, setValReport] = useState<ValidationReport | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [manualPick, setManualPick] = useState(false);
  const [fromDraft, setFromDraft] = useState(false);
  // Course liée d'un brouillon en cours de chargement : le changement de date du
  // brouillon re-déclenche l'effet « courses du jour » qui réinitialiserait
  // manualPick/courseId — ce ref (consommé une seule fois, pour SA date) préserve
  // le rattachement exact déposé par le pipeline.
  const draftPickRef = useRef<{ date: string; courseId: string } | null>(null);
  const [coursePartants, setCoursePartants] = useState<Record<number, { cote: number | null; nom: string | null; statRank: number | null; statLabel: string | null }>>({});
  // Non-partants (jamais dans une sélection) — 2 sources unies : déclarés par le
  // pipeline (brouillon, `np` dans citations) + flag `non_partant` en base.
  const [draftNonPartants, setDraftNonPartants] = useState<number[]>([]);
  const [courseNonPartants, setCourseNonPartants] = useState<number[]>([]);
  // Cotes LIVE (PMU) déposées par le pipeline dans le brouillon (par numéro).
  // Prioritaires sur les cotes de la course liée (LONACI, souvent incomplet).
  const [draftCotes, setDraftCotes] = useState<Record<number, number>>({});
  // Cotes + NP de la course en cours de chargement → Analyser reste bloqué tant
  // que ce n'est pas prêt (sinon on analyserait sans les NP du flag base).
  const [partantsLoading, setPartantsLoading] = useState(false);

  // Défaut = date du jour (effet client-only → pas de mismatch d'hydratation)
  useEffect(() => {
    setDateCourse(new Date().toISOString().slice(0, 10));
  }, []);

  // Pré-remplissage depuis un brouillon du pipeline (/admin/consensus?draft=<id>).
  // Reconstruit le bloc de citations + fixe la course liée ; passe le brouillon
  // en « reviewed ». L'admin garde la main : il relit, ajuste, puis publie.
  useEffect(() => {
    const draftId = new URLSearchParams(window.location.search).get("draft");
    if (!draftId) return;
    let cancelled = false;
    fetch(`/api/admin/consensus/drafts?id=${draftId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.draft) return;
        const dr = d.draft;
        setFromDraft(true);
        // AVANT le changement de date : arme la préservation du rattachement
        // (sinon l'effet « courses du jour » écraserait courseId/manualPick).
        if (dr.course_id) draftPickRef.current = { date: dr.date_course || "", courseId: dr.course_id };
        setDateCourse(dr.date_course || "");
        setHippodrome(dr.hippodrome || "");
        setCourse(dr.reunion_course || "");
        setTypePari(dr.type_pari || "QUINTE_PLUS");
        if (dr.nb_partants) setNbPartants(dr.nb_partants);
        setNbSources(dr.nb_sources || 30);
        const lignes = (Array.isArray(dr.citations) ? dr.citations : [])
          .map((c: any) => `${c.numero} ${c.citations} ${c.bases}`)
          .join("\n");
        setRaw(lignes);
        setDraftNonPartants((Array.isArray(dr.citations) ? dr.citations : []).filter((c: any) => c && c.np).map((c: any) => c.numero));
        // Cotes PMU déposées par le pipeline (par numéro) → prioritaires à l'analyse.
        const cotes: Record<number, number> = {};
        (Array.isArray(dr.citations) ? dr.citations : []).forEach((c: any) => {
          if (c && c.numero != null && typeof c.cote === "number" && c.cote > 0) cotes[Number(c.numero)] = c.cote;
        });
        setDraftCotes(cotes);
        if (dr.course_id) { setManualPick(true); setCourseId(dr.course_id); }
        // Marque le brouillon relu (best-effort).
        fetch("/api/admin/consensus/drafts", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draftId, status: "reviewed" }),
        }).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Charge les courses du jour quand la date change
  useEffect(() => {
    if (!dateCourse) { setCourses([]); setCourseId(""); setManualPick(false); return; }
    let cancelled = false;
    setCoursesLoading(true);
    // Consomme (une seule fois) le rattachement d'un brouillon : si ce changement
    // de date vient du chargement d'un brouillon, on PRÉSERVE sa course liée au
    // lieu de la réinitialiser puis re-matcher approximativement.
    const draftPick = draftPickRef.current && draftPickRef.current.date === dateCourse
      ? draftPickRef.current.courseId
      : null;
    draftPickRef.current = null;
    if (!draftPick) setManualPick(false);
    fetch(`/api/admin/consensus?date=${dateCourse}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCourses(Array.isArray(d.courses) ? d.courses : []);
        if (draftPick) { setManualPick(true); setCourseId(draftPick); }
      })
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
    if (!courseId) { setCoursePartants({}); setCourseNonPartants([]); setPartantsLoading(false); return; }
    let cancelled = false;
    setCoursePartants({}); // neutre pendant le fetch → jamais la cote d'une autre course
    setPartantsLoading(true);
    fetch(`/api/admin/consensus?courseId=${courseId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const map: Record<number, { cote: number | null; nom: string | null; statRank: number | null; statLabel: string | null }> = {};
        (Array.isArray(d.partants) ? d.partants : []).forEach((p: any) => {
          if (p && p.numero != null) map[p.numero] = { cote: p.cote ?? null, nom: p.nom ?? null, statRank: p.statRank ?? null, statLabel: p.statLabel ?? null };
        });
        setCoursePartants(map);
        setCourseNonPartants(Array.isArray(d.nonPartants) ? d.nonPartants : []);
      })
      .catch(() => { if (!cancelled) { setCoursePartants({}); setCourseNonPartants([]); } })
      .finally(() => { if (!cancelled) setPartantsLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  // Auto-détecte « Nb sources : N » dans le texte collé → renseigne le champ
  // (permet de coller l'email Cowork entier sans régler la main).
  useEffect(() => {
    const { nbSources: ns } = parseConsensus(raw);
    if (ns && ns > 0) setNbSources(ns);
  }, [raw]);

  // Une analyse (et son rapport de validation) devient périmée si le bloc, la
  // course liée (donc ses cotes) ou le nombre de sources change → nouvelle Analyse.
  useEffect(() => {
    setResult(null);
    setValReport(null);
    setAckWarnings(false);
  }, [coursePartants, nbSources, raw, draftCotes]);

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

    // Brouillon d'analyse auto (factuel) à partir du consensus + stats + divergence.
    const noms: Record<number, string | null> = {};
    const statLabel: Record<number, string | null> = {};
    const divergence: Record<number, "BASE" | "VALUE" | "PIEGE" | null> = {};
    result.partants.forEach((p) => {
      noms[p.numero] = coursePartants[p.numero]?.nom ?? null;
      statLabel[p.numero] = coursePartants[p.numero]?.statLabel ?? null;
      divergence[p.numero] = divergenceCode(p.numero);
    });
    const pariLabel = typePari === "QUINTE_PLUS" ? "Quinté+" : typePari === "QUARTE" ? "Quarté+" : "Tiercé";
    const draft = buildAnalyseDraft({ result, selection: sel, noms, statLabel, divergence, hippodrome, typePariLabel: pariLabel });

    const params = new URLSearchParams({
      courseId,
      niveau_acces: niveau,
      type_pari: typePari,
      selection: sel.join(","),
      analyse_courte: draft.analyseCourte,
      analyse_texte: draft.analyseTexte,
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

  // Analyser = validation STRICTE côté serveur (contrat v2.4, journalisée dans
  // consensus_imports) → si ok (et warnings acquittés), calcul du consensus sur
  // les partants VALIDÉS, enrichis cote/nom depuis la course liée.
  async function analyser(ack?: boolean) {
    setSaveStatus("idle");
    setSaveMsg("");
    setResult(null);
    setValidating(true);
    try {
      const npForm = typeof nbPartants === "number" && nbPartants > 0 ? nbPartants : null;
      const linked = courses.filter((c) => c.id === courseId)[0];
      const np = npForm ?? linked?.nb_partants ?? 0;

      const res = await fetch("/api/admin/consensus/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_course: dateCourse || null,
          course_id: courseId || null,
          nb_partants: np,
          nb_sources: nbSources,
          texte: raw,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.report) {
        setValReport({ ok: false, errors: [{ code: "E00", message: data.error || "Erreur de validation — réessaye." }], warnings: [], partants: [], seuil_base: 0, echantillon_reduit: false });
        return;
      }
      const report: ValidationReport = data.report;
      setValReport(report);
      if (!report.ok) return; // erreurs bloquantes affichées, rien n'est calculé

      const needsAck = report.warnings.some((w) => w.requires_ack);
      if (needsAck && !(ack || ackWarnings)) return; // l'admin doit acquitter puis relancer

      const merged = report.partants.map((p) => {
        const cp = coursePartants[p.numero];
        const dc = draftCotes[p.numero];          // cote PMU du pipeline → priorité sur LONACI
        if (dc == null && !cp) return p;
        return { ...p, cote: dc != null ? dc : (cp?.cote ?? null), nom: cp?.nom ?? p.nom };
      });
      const nonPartants = draftNonPartants.concat(courseNonPartants);
      setResult(buildConsensus({ nbSources, partants: merged }, { nonPartants }));
    } catch {
      setValReport({ ok: false, errors: [{ code: "E00", message: "Erreur réseau — réessaye." }], warnings: [], partants: [], seuil_base: 0, echantillon_reduit: false });
    } finally {
      setValidating(false);
    }
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
        <a href="/admin/consensus/brouillons" className="inline-flex items-center gap-1.5 mt-2 text-xs text-gold-light hover:text-gold-primary">
          <Inbox className="w-3.5 h-3.5" /> Brouillons du pipeline en attente →
        </a>
        {fromDraft && (
          <div className="mt-3 p-3 rounded-xl bg-gold-primary/10 border border-gold-primary/30 text-xs text-gold-light">
            📥 Chargé depuis un brouillon du pipeline. Clique <b>Analyser</b>, relis, ajuste si besoin, puis crée &amp; publie le pronostic. <span className="text-text-secondary">Rien n&apos;est publié sans toi.</span>
          </div>
        )}
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
            <p className="text-text-muted text-xs mt-1">Format v2.4 : <code>numero citations bases</code> (3 entiers) — 1 cheval/ligne. <span className="text-status-loss font-semibold">Jamais de cote dans le bloc</span> : la <span className="text-text-secondary">cote + le nom</span> sont ajoutés auto depuis la course liée.</p>
            {Object.keys(draftCotes).length > 0 && (
              <p className="text-status-win text-[11px] mt-0.5">✓ {Object.keys(draftCotes).length} cotes PMU (pipeline) — prioritaires sur la course liée.</p>
            )}
            {courseId && Object.keys(coursePartants).length > 0 && (
              <p className="text-status-win text-[11px] mt-0.5">✓ {Object.keys(coursePartants).length} cotes + noms chargés depuis la course liée.</p>
            )}
            {courseId && Object.keys(coursePartants).length === 0 && (
              <p className="text-gold-light/80 text-[11px] mt-0.5">Pas de cote en base pour cette course → clique « Enrichir PMU » sur la fiche course (sinon analyse sans cote).</p>
            )}
            <button onClick={() => analyser()} disabled={!raw.trim() || validating || partantsLoading}
              className="w-full mt-3 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {validating || partantsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {partantsLoading ? "Chargement des cotes…" : "Analyser"}
            </button>
          </div>

          {/* ── Rapport de validation (contrat v2.4) ── */}
          {valReport && valReport.errors.length > 0 && (
            <div className="card-base p-4 border-2 border-status-loss/40">
              <p className="text-status-loss text-xs font-bold uppercase tracking-wider mb-2">⛔ Bloc rejeté — corrige puis relance</p>
              {valReport.errors.map((e, i) => (
                <p key={i} className="text-text-primary text-xs leading-relaxed mb-1">
                  <span className="font-mono text-status-loss font-bold">{e.code}</span> · {e.message}
                </p>
              ))}
            </div>
          )}
          {valReport && valReport.ok && valReport.warnings.length > 0 && (
            <div className="card-base p-4 border-2 border-gold-primary/40">
              <p className="text-gold-light text-xs font-bold uppercase tracking-wider mb-2">⚠️ Avertissements</p>
              {valReport.warnings.map((w, i) => (
                <p key={i} className="text-text-primary text-xs leading-relaxed mb-1">
                  <span className="font-mono text-gold-light font-bold">{w.code}</span> · {w.message}
                </p>
              ))}
              {!result && valReport.warnings.some((w) => w.requires_ack) && (
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={ackWarnings}
                    onChange={(e) => {
                      setAckWarnings(e.target.checked);
                      if (e.target.checked) analyser(true);
                    }}
                    className="mt-0.5 accent-[#C9A84C]" />
                  <span className="text-text-secondary text-xs">J'ai lu ces avertissements — analyser quand même.</span>
                </label>
              )}
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
                        <tr key={p.numero} className={`border-b border-border/50 ${p.nonPartant ? "opacity-45" : ""}`}>
                          <td className="py-1.5 px-2 font-bold text-text-primary">
                            {p.numero}
                            {p.nonPartant && <span className="ml-1.5 text-[10px] font-bold text-status-loss align-middle">NP</span>}
                          </td>
                          <td className="py-1.5 px-2 text-right text-text-secondary">{p.citations}</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{Math.round(p.tauxCitation * 100)}%</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{p.bases || "—"}</td>
                          <td className="py-1.5 px-2 text-right text-text-muted">{p.nonPartant || p.cote == null ? "—" : p.cote}</td>
                          <td className={`py-1.5 px-2 font-semibold ${CAT_STYLE[p.categorie] || ""}`}>{p.nonPartant ? "—" : p.categorie}</td>
                          <td className="py-1.5 px-2 text-right text-text-secondary">{p.scoreConsensus}</td>
                          <td className="py-1.5 px-2 text-text-muted text-xs">{coursePartants[p.numero]?.statLabel ?? "—"}</td>
                          <td className="py-1.5 px-2 text-xs">
                            {p.nonPartant ? (
                              <span className="font-semibold text-status-loss">⛔ Non-partant</span>
                            ) : (() => {
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
                  <span className="font-semibold text-text-secondary">Signal (presse × stats)</span> — <span className="text-status-win font-semibold">🟢 Base</span> : cité ET stats fortes (consensus solide). <span className="text-blue-400 font-semibold">🔵 Value</span> : stats fortes mais peu cité (la data voit ce que la presse rate). <span className="text-gold-light font-semibold">🟡 Piège</span> : très cité mais stats faibles (surcote/hype). Colonne <span className="text-text-secondary">Stats</span> = sélection stats déterministe. <span className="text-text-secondary font-semibold">R01</span> : base auto réservée aux chevaux cités ≥ <span className="text-gold-light font-semibold">{result.seuilBase}</span> fois (anti-fausse-base, incident 01/07). <span className="text-status-loss font-semibold">⛔ Non-partant</span> : compté dans les citations (invariant) mais <span className="text-text-secondary">exclu de toute sélection</span> — jamais chez l'abonné. Aide à la décision — c'est toi qui tranches l'Elite-6 / Pro-8.
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
