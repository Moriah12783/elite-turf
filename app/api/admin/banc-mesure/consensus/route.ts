import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildConsensus, type PartantConsensus } from "@/lib/consensus/engine";
import { pickFavoriMarche } from "@/lib/consensus/radar-vedette";
import { aggregateConsensus, computeConsensusHits, type ConsensusDayInput } from "@/lib/banc/consensus-metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/banc-mesure/consensus?days=120
 *
 * Mesure la SÉLECTION du consensus presse (celle du Radar : base+value+coup) +
 * le favori presse (plus cité) + le favori marché (plus basse cote PMU) VS
 * l'arrivée officielle, sur la période. Recalcule le consensus de chaque
 * brouillon vedette avec le MÊME moteur que le Radar (`buildConsensus`) → on
 * mesure exactement ce que le public voit. Ne garde que les vedettes RÉSULTÉES.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "120", 10);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 1000) : 120;
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // 1. Brouillons vedettes de la période (avec course liée).
  const { data: drafts, error } = await adminClient
    .from("consensus_drafts")
    .select("date_course, reunion_course, hippodrome, type_pari, nb_sources, course_id, citations, created_at")
    .neq("status", "rejected")
    .not("course_id", "is", null)
    .gte("date_course", sinceDate)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Erreur lecture base" }, { status: 500 });

  // Un brouillon par course (on préfère le Quinté+ ; sinon le plus récent — déjà trié).
  const byCourse = new Map<string, any>();
  for (const d of drafts ?? []) {
    const prev = byCourse.get(d.course_id);
    if (!prev) { byCourse.set(d.course_id, d); continue; }
    if (prev.type_pari !== "QUINTE_PLUS" && d.type_pari === "QUINTE_PLUS") byCourse.set(d.course_id, d);
  }
  const draftList = Array.from(byCourse.values());
  const courseIds = draftList.map((d) => d.course_id);
  if (courseIds.length === 0) {
    return NextResponse.json({ days, n: 0, consensus: aggregateConsensus([]), rows: [] });
  }

  // 2. Partants (cotes + source + NP) et arrivées, par lots.
  const partantsByCourse = new Map<string, any[]>();
  const arriveeByCourse = new Map<string, { arrivee: number[]; libelle: string | null }>();
  // Supabase borne les `.in(...)` → on découpe par paquets de 200 course_ids.
  for (let i = 0; i < courseIds.length; i += 200) {
    const chunk = courseIds.slice(i, i + 200);
    const { data: parts } = await adminClient
      .from("partants").select("course_id, numero, cote, cote_source, non_partant").in("course_id", chunk);
    for (const p of parts ?? []) {
      const arr = partantsByCourse.get(p.course_id) || [];
      arr.push(p);
      partantsByCourse.set(p.course_id, arr);
    }
    const { data: courses } = await adminClient
      .from("courses").select("id, arrivee_officielle, libelle").in("id", chunk);
    for (const c of courses ?? []) {
      const arrivee = Array.isArray(c.arrivee_officielle)
        ? c.arrivee_officielle.map(Number).filter((n: number) => Number.isFinite(n))
        : [];
      arriveeByCourse.set(c.id, { arrivee, libelle: c.libelle ?? null });
    }
  }

  // 3. Par vedette : recalcule le consensus (comme le Radar) + hits vs arrivée.
  const dayInputs: ConsensusDayInput[] = [];
  const rows: any[] = [];
  for (const d of draftList) {
    const info = arriveeByCourse.get(d.course_id);
    const arrivee = info?.arrivee ?? [];
    if (arrivee.length === 0) continue; // pas encore courue → non mesurable

    const rawCitations = Array.isArray(d.citations) ? d.citations : [];
    if (rawCitations.length === 0) continue;

    const courseParts = partantsByCourse.get(d.course_id) || [];
    const coteByNum = new Map<number, number>();
    const nonPartants: number[] = [];
    for (const p of courseParts) {
      const nn = Number(p.numero);
      if (!Number.isFinite(nn)) continue;
      if (p.non_partant) nonPartants.push(nn);
      if (p.cote != null && Number.isFinite(Number(p.cote))) coteByNum.set(nn, Number(p.cote));
    }

    const partants: PartantConsensus[] = [];
    for (const c of rawCitations as any[]) {
      const numero = Number(c?.numero);
      if (!Number.isFinite(numero)) continue;
      if (c?.np) nonPartants.push(numero);
      const coteCit = c?.cote != null && Number.isFinite(Number(c.cote)) ? Number(c.cote) : null;
      partants.push({
        numero,
        citations: Number(c?.citations) || 0,
        bases: c?.bases != null ? Number(c.bases) : undefined,
        cote: coteCit != null ? coteCit : (coteByNum.has(numero) ? coteByNum.get(numero)! : null),
      });
    }

    const result = buildConsensus(
      { nbSources: Number(d.nb_sources) || partants.length, partants },
      { nonPartants },
    );
    const selection = result.pro.selection || [];

    // Favori presse = le plus cité (hors non-partant).
    let favoriPresse: number | null = null;
    let maxCit = -1;
    for (const ps of result.partants) {
      if (ps.nonPartant) continue;
      if (ps.citations > maxCit) { maxCit = ps.citations; favoriPresse = ps.numero; }
    }
    // Favori marché = plus basse cote PMU réelle (jamais le 1,2 LONACI).
    const favoriMarche = pickFavoriMarche(courseParts)?.numero ?? null;

    const input: ConsensusDayInput = { selection, favoriPresse, favoriMarche, arrivee, typePari: d.type_pari };
    dayInputs.push(input);

    const h = computeConsensusHits(input);
    rows.push({
      date:         d.date_course,
      course:       d.reunion_course,
      hippodrome:   d.hippodrome,
      selection,
      favoriPresse,
      favoriMarche,
      arrivee:      arrivee.slice(0, 6),
      vainqueurHit: h.vainqueurHit,
      couverture:   h.couverture,
      quinte:       h.quinteTrouve,
    });
  }

  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return NextResponse.json({
    days,
    n: dayInputs.length,
    consensus: aggregateConsensus(dayInputs),
    rows: rows.slice(0, 60),
  });
}
