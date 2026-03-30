// GET /api/ticker-data
// Retourne un mix : arrivées réelles, courses du jour, pronostics publiés, messages marketing

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 900; // 15 min

const BET_LABELS: Record<string, string> = {
  QUINTE_PLUS: "Quinté+",
  QUARTE:      "Quarté+",
  TIERCE:      "Tiercé",
  SIMPLE:      "Simple",
  COUPLE:      "Couplé",
  TRIO:        "Trio",
};

const MARKETING_ITEMS = [
  { label: "🏇 Elite Turf",  result: "Pronostics PMU experts — Abonnez-vous dès 29€/mois", status: "pending" as const },
  { label: "💡 Conseil",     result: "Nos experts analysent chaque Quinté+ pour vous",     status: "pending" as const },
  { label: "⭐ Premium",     result: "Accédez au Quarté+ et Quinté+ — Rejoignez l'élite",  status: "pending" as const },
  { label: "📋 Arrivées",    result: "Consultez les arrivées du jour en temps réel",        status: "pending" as const },
  { label: "📅 Courses",     result: "Programme complet des courses du jour disponible",    status: "pending" as const },
];

export async function GET() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const items: { label: string; result: string; status: "win" | "partial" | "pending" }[] = [];

  try {
    // ── 1. Arrivées réelles du jour (via table arrivees) ─────────────────────
    const { data: arrivees } = await supabase
      .from("arrivees")
      .select(`
        ordre_arrivee,
        course:course_id(
          numero_reunion, numero_course, heure_depart,
          hippodrome:hippodromes(nom)
        )
      `)
      .gte("horodatage", `${today}T00:00:00`)
      .order("horodatage", { ascending: false })
      .limit(8);

    if (arrivees?.length) {
      arrivees.forEach((a: any) => {
        const nums = Array.isArray(a.ordre_arrivee)
          ? a.ordre_arrivee.slice(0, 5).join(" - ")
          : a.ordre_arrivee;
        items.push({
          label:  `R${a.course?.numero_reunion}C${a.course?.numero_course} ${a.course?.hippodrome?.nom || "PMU"}`,
          result: `🏁 Arrivée : ${nums}`,
          status: "win",
        });
      });
    }

    // ── 1b. Courses terminées du jour (statut TERMINE, avec arrivée dans courses) ──
    const { data: coursesTerminees } = await supabase
      .from("courses")
      .select(`
        numero_reunion, numero_course, heure_depart, nom_course,
        arrivee_officielle,
        hippodrome:hippodromes(nom)
      `)
      .eq("date_course", today)
      .eq("statut", "TERMINE")
      .not("arrivee_officielle", "is", null)
      .order("heure_depart", { ascending: false })
      .limit(8);

    if (coursesTerminees?.length) {
      coursesTerminees.forEach((c: any) => {
        const nums = Array.isArray(c.arrivee_officielle)
          ? c.arrivee_officielle.slice(0, 5).join(" - ")
          : c.arrivee_officielle;
        // Eviter les doublons avec la table arrivees
        const dejaDans = items.some(
          i => i.label.includes(`R${c.numero_reunion}C${c.numero_course}`)
        );
        if (!dejaDans) {
          items.push({
            label:  `R${c.numero_reunion}C${c.numero_course} ${c.hippodrome?.nom || "PMU"}`,
            result: `🏁 Arrivée : ${nums}`,
            status: "win",
          });
        }
      });
    }

    // ── 2. Courses du jour (programmées / en cours) ───────────────────────────
    const { data: courses } = await supabase
      .from("courses")
      .select(`
        numero_reunion, numero_course, heure_depart, nom_course, nombre_partants,
        hippodrome:hippodromes(nom, pays)
      `)
      .eq("date_course", today)
      .in("statut", ["PROGRAMME", "EN_COURS"])
      .order("heure_depart", { ascending: true })
      .limit(12);

    if (courses?.length) {
      courses.forEach((c: any) => {
        const heure = c.heure_depart ? c.heure_depart.slice(0, 5) : "";
        const pays = c.hippodrome?.pays && c.hippodrome.pays !== "France"
          ? ` (${c.hippodrome.pays})`
          : "";
        const partants = c.nombre_partants ? ` · ${c.nombre_partants} partants` : "";
        const statut = c.statut === "EN_COURS" ? "🟢 En cours" : `🕐 ${heure}`;
        items.push({
          label:  `R${c.numero_reunion}C${c.numero_course} ${c.hippodrome?.nom || "PMU"}${pays}`,
          result: `${statut}${partants}`,
          status: c.statut === "EN_COURS" ? "win" : "pending",
        });
      });
    }

    // ── 3. Pronostics publiés (avec sélection) ────────────────────────────────
    const { data: pronostics } = await supabase
      .from("pronostics")
      .select(`
        type_pari, selection, arrivee_reelle, resultat,
        course:courses(
          numero_reunion, date_course,
          hippodrome:hippodromes(nom)
        )
      `)
      .eq("publie", true)
      .gte("date_publication", `${today}T00:00:00`)
      .order("date_publication", { ascending: false })
      .limit(6);

    if (pronostics?.length) {
      pronostics.forEach((p: any) => {
        const bet = BET_LABELS[p.type_pari] || p.type_pari;
        const arrivee = Array.isArray(p.arrivee_reelle) ? p.arrivee_reelle.slice(0, 5).join(" - ") : null;
        const sel = Array.isArray(p.selection) ? p.selection.slice(0, 5).join(" - ") : "—";
        items.push({
          label:  `⭐ R${p.course?.numero_reunion} ${p.course?.hippodrome?.nom || "PMU"}`,
          result: arrivee
            ? `${bet} · Arrivée : ${arrivee}`
            : `${bet} · Sélection Elite : ${sel}`,
          status: p.resultat === "GAGNANT" ? "win" : p.resultat === "PARTIEL" ? "partial" : "pending",
        });
      });
    }

    // ── 4. Toujours ajouter les messages marketing ────────────────────────────
    MARKETING_ITEMS.forEach(m => items.push(m));

    // Retourner un minimum de données
    if (items.length === 0) {
      return NextResponse.json(MARKETING_ITEMS);
    }

    return NextResponse.json(items);

  } catch {
    return NextResponse.json(MARKETING_ITEMS);
  }
}
