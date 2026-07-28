/**
 * GET/POST /api/admin/rapport-journalier
 *
 * Génère un rapport structuré post-course pour tous les pronostics
 * résolus du jour (GAGNANT / PARTIEL / PERDANT).
 *
 * Pour chaque pronostic résolu, le rapport contient :
 *  - La sélection Elite Turf vs l'arrivée officielle
 *  - Le nombre de chevaux trouvés (hits)
 *  - Le résultat (GAGNANT / PARTIEL / PERDANT)
 *  - Le rapport PMU (dividende si disponible)
 *  - L'analyse de performance
 *
 * Query params :
 *  ?date=YYYY-MM-DD  (défaut : aujourd'hui)
 *  ?save=true        (sauvegarde le rapport en DB si table rapports existe)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fenetreComparaison } from "@/lib/pronostics/resultat";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────

function computeHits(selection: number[], arrivee: number[], topN: number): number[] {
  const top = new Set(arrivee.slice(0, topN));
  return selection.filter((n) => top.has(n));
}

// Fenêtre de comparaison : `lib/pronostics/resultat.ts` (source unique, testée).
// L'ancienne copie locale testait des libellés accentués absents de la base et
// jugeait donc tous les Tiercés sur le top 5.

function resultEmoji(resultat: string): string {
  if (resultat === "GAGNANT") return "✅";
  if (resultat === "PARTIEL") return "⚡";
  if (resultat === "PERDANT") return "❌";
  return "⏳";
}

function analysePerformance(
  hits: number[],
  selection: number[],
  arrivee: number[],
  topN: number,
  resultat: string,
): string {
  // ⚠️ La fenêtre vient du TYPE DE PARI, plus de la taille de la sélection.
  // GAGNANT ne signifie donc PAS « toute la sélection est dans le top N » : un
  // Tiercé gagné avec 8 chevaux joués n'en place que 3. Les messages disent
  // désormais ce qui est réellement vrai — sans quoi le rapport affirmerait
  // « tous les 8 chevaux dans le top 3 », arithmétiquement impossible.
  const ordered = arrivee.slice(0, topN).join(" - ");
  const nbTrouves = `${hits.length} ${hits.length > 1 ? "chevaux trouvés" : "cheval trouvé"}`;

  if (resultat === "GAGNANT") {
    return `Sélection validée. Arrivée : ${ordered}. Les ${topN} premiers sont tous `
      + `dans la sélection (${selection.length} chevaux joués).`;
  }
  if (resultat === "PARTIEL") {
    const missed = selection.filter((n) => !hits.includes(n)).join(", ");
    return `${hits.length}/${topN} places du top trouvées (${hits.join(", ")}). `
      + `Chevaux joués non placés : ${missed || "aucun"}. Arrivée officielle : ${ordered}.`;
  }
  if (resultat === "PERDANT") {
    // Un PERDANT peut compter des chevaux trouvés : le seuil du PARTIEL est de
    // 3 dès que la fenêtre atteint 4 places. Annoncer « aucun » serait faux.
    if (hits.length === 0) {
      return `Aucun cheval de la sélection (${selection.join(", ")}) dans le top ${topN}. Arrivée : ${ordered}.`;
    }
    return `Seulement ${nbTrouves} (${hits.join(", ")}) dans le top ${topN}, `
      + `sous le seuil du partiel. Arrivée : ${ordered}.`;
  }
  return "Résultat en attente.";
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url     = new URL(req.url);
  const dateISO = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const save    = url.searchParams.get("save") === "true";

  const supabase = createServiceClient();

  // 1. Récupérer les pronostics du jour avec leur course
  const { data: pronostics, error } = await supabase
    .from("pronostics")
    .select(`
      id,
      selection,
      type_pari,
      resultat,
      rapport_gagnant,
      analyse_courte,
      confiance,
      publie,
      course:courses (
        id,
        libelle,
        date_course,
        numero_reunion,
        numero_course,
        arrivee_officielle,
        hippodrome:hippodromes ( nom )
      )
    `)
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filtrer sur la date demandée
  const pronosDuJour = (pronostics ?? []).filter((p) => {
    const course = Array.isArray(p.course) ? p.course[0] : p.course as any;
    return course?.date_course === dateISO;
  });

  if (pronosDuJour.length === 0) {
    return NextResponse.json({
      ok:    true,
      date:  dateISO,
      total: 0,
      message: "Aucun pronostic résolu pour cette date",
      rapport: [],
    });
  }

  // 2. Construire le rapport
  const rapport = pronosDuJour.map((p) => {
    const course = Array.isArray(p.course) ? p.course[0] : p.course as any;
    const hippNom = Array.isArray(course?.hippodrome)
      ? course.hippodrome[0]?.nom
      : course?.hippodrome?.nom ?? "—";

    const selection: number[]  = p.selection ?? [];
    const arrivee: number[]    = course?.arrivee_officielle ?? [];
    const typePari: string     = p.type_pari ?? "";
    const topN                 = fenetreComparaison(typePari, selection.length);
    const hits                 = computeHits(selection, arrivee, topN);
    const resultat: string     = p.resultat ?? "EN_ATTENTE";

    return {
      pronosticId:    p.id,
      courseId:       course?.id ?? null,
      libelle:        course?.libelle ?? "—",
      hippodrome:     hippNom,
      reunion:        course?.numero_reunion ?? null,
      course:         course?.numero_course ?? null,
      date:           course?.date_course ?? dateISO,
      typePari,
      confiance:      p.confiance ?? "—",
      selection,
      arriveeOfficielle: arrivee.slice(0, topN),
      hitsCount:      hits.length,
      hitsChevaux:    hits,
      totalSelection: selection.length,
      topN,
      resultat,
      emoji:          resultEmoji(resultat),
      rapportPMU:     p.rapport_gagnant ?? null,
      analyseCourte:  p.analyse_courte ?? null,
      analysePost:    analysePerformance(hits, selection, arrivee, topN, resultat),
    };
  });

  // 3. Stats globales du jour
  const total    = rapport.length;
  const gagnants = rapport.filter((r) => r.resultat === "GAGNANT").length;
  const partiels = rapport.filter((r) => r.resultat === "PARTIEL").length;
  const perdants = rapport.filter((r) => r.resultat === "PERDANT").length;
  const tauxJour = total > 0 ? Math.round(((gagnants + partiels * 0.5) / total) * 100) : 0;

  // 4. Résumé texte prêt à copier / envoyer (WhatsApp / email)
  const resumeTexte = [
    `📊 RAPPORT ELITE TURF — ${dateISO}`,
    ``,
    ...rapport.map((r) =>
      [
        `${r.emoji} ${r.libelle} (R${r.reunion}C${r.course}) — ${r.hippodrome}`,
        `   Sélection : ${r.selection.join("-")}`,
        `   Arrivée top${r.topN} : ${r.arriveeOfficielle.join("-") || "N/D"}`,
        `   Résultat : ${r.resultat} (${r.hitsCount}/${r.totalSelection} chevaux trouvés)`,
        r.rapportPMU ? `   Rapport PMU : ${r.rapportPMU.toFixed(2)}€ pour 1€ misé` : null,
        `   ${r.analysePost}`,
      ].filter(Boolean).join("\n")
    ),
    ``,
    `📈 BILAN DU JOUR`,
    `   ✅ Gagnants : ${gagnants}/${total}`,
    `   ⚡ Partiels : ${partiels}/${total}`,
    `   ❌ Perdants : ${perdants}/${total}`,
    `   🎯 Score jour : ${tauxJour}%`,
  ].join("\n");

  // 5. Optionnel — sauvegarder le rapport (ignore si table inexistante)
  if (save) {
    await supabase
      .from("rapports_journaliers")
      .upsert(
        {
          date:        dateISO,
          rapport:     rapport,
          resume:      resumeTexte,
          gagnants,
          partiels,
          perdants,
          taux_jour:   tauxJour,
          genere_le:   new Date().toISOString(),
        },
        { onConflict: "date" },
      )
      .then(() => {}); // ignore si table inexistante
  }

  return NextResponse.json({
    ok:          true,
    date:        dateISO,
    total,
    gagnants,
    partiels,
    perdants,
    tauxJour:    `${tauxJour}%`,
    rapport,
    resumeTexte,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
