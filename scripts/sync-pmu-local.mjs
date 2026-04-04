/**
 * sync-pmu-local.mjs — Elite Turf
 * ─────────────────────────────────────────────────────────────────
 * Lance ce script depuis ton PC (connexion résidentielle non bloquée).
 * Il récupère le programme PMU et l'insère dans Supabase.
 *
 * Usage :
 *   node scripts/sync-pmu-local.mjs              → aujourd'hui
 *   node scripts/sync-pmu-local.mjs 20260405     → date précise
 *   node scripts/sync-pmu-local.mjs demain       → J+1
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     || "https://cpzjjnmszbyizeqhgrat.supabase.co";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE) {
  console.error("❌ Manque SUPABASE_SERVICE_ROLE_KEY");
  console.error("   Crée un fichier .env.local avec : SUPABASE_SERVICE_ROLE_KEY=votre_clé");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ── Helpers date ──────────────────────────────────────────────────
function toDateStr(d = new Date()) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

function pmuDateToISO([y, m, d]) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function tsToTime(ts) {
  const d = new Date(ts);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

function toCategorie(discipline = "") {
  if (discipline.includes("TROT"))     return "TROT";
  if (discipline.includes("OBSTACLE") || discipline.includes("HAIE") || discipline.includes("STEEPLE")) return "OBSTACLE";
  return "PLAT";
}

// ── Fetch PMU ─────────────────────────────────────────────────────
const HEADERS = {
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "Referer":         "https://www.pmu.fr/",
  "Origin":          "https://www.pmu.fr",
};

async function fetchProgramme(dateStr) {
  const urls = [
    `https://turfinfo.api.pmu.fr/rest/client/1/programmeComplet/${dateStr}?specialisation=INTERNET`,
    `https://online.turfinfo.api.pmu.fr/rest/client/61/programmeComplet/${dateStr}?specialisation=INTERNET`,
    `https://online.turfinfo.api.pmu.fr/rest/client/7/programmeComplet/${dateStr}?specialisation=INTERNET`,
    `https://online.turfinfo.api.pmu.fr/rest/client/1/programmeComplet/${dateStr}?specialisation=INTERNET`,
  ];

  for (const url of urls) {
    try {
      console.log(`  ↗ Tentative : ${url}`);
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) { console.log(`    ✗ HTTP ${res.status}`); continue; }
      const json = await res.json();
      const reunions = json?.programme?.reunions ?? json?.reunions ?? [];
      if (reunions.length > 0) {
        console.log(`  ✓ ${reunions.length} réunions trouvées`);
        return reunions;
      }
      console.log(`    ✗ 0 réunions`);
    } catch (e) {
      console.log(`    ✗ Erreur réseau: ${e.message}`);
    }
  }
  throw new Error("Impossible de récupérer le programme PMU (tous les endpoints ont échoué)");
}

// ── Normalisation ─────────────────────────────────────────────────
function normalizeReunions(reunions) {
  const courses = [];
  for (const reunion of reunions) {
    const dateCourse = pmuDateToISO(reunion.dateReunion.date);
    const hipNom     = reunion.hippodrome?.libelleLong || reunion.hippodrome?.libelleCourt || "Inconnu";
    const hipPays    = reunion.hippodrome?.pays?.code === "FRA" ? "France" : (reunion.hippodrome?.pays?.code || "France");

    for (const c of reunion.courses ?? []) {
      const paris = new Set();
      if (Array.isArray(c.paris))      c.paris.forEach(p => p?.typePari && paris.add(p.typePari.toUpperCase()));
      if (Array.isArray(c.typesParis)) c.typesParis.forEach(t => t && paris.add(t.toUpperCase()));

      courses.push({
        hippodromeName:  hipNom,
        hippodromePays:  hipPays,
        dateCourse,
        heureDepart:     tsToTime(c.heureDepart),
        numeroReunion:   reunion.numOrdre,
        numeroCourse:    c.numOrdre,
        libelle:         c.libelle || `Course R${reunion.numOrdre}C${c.numOrdre}`,
        distanceMetres:  c.distance || 0,
        categorie:       toCategorie(c.discipline),
        nbPartants:      c.nombreDeclaresPartants || 0,
        parisDisponibles: Array.from(paris),
      });
    }
  }
  return courses;
}

// ── Upsert Supabase ───────────────────────────────────────────────
async function syncToSupabase(courses) {
  // Hippodromes
  const hipNoms  = [...new Set(courses.map(c => c.hippodromeName))];
  const hipMap   = {};

  for (const nom of hipNoms) {
    const pays = courses.find(c => c.hippodromeName === nom)?.hippodromePays || "France";
    const { data: existing } = await supabase.from("hippodromes").select("id").eq("nom", nom).single();
    if (existing) {
      hipMap[nom] = existing.id;
    } else {
      const { data: ins } = await supabase.from("hippodromes")
        .insert({ nom, pays, ville: nom, fuseau_horaire: "Europe/Paris", actif: true })
        .select("id").single();
      if (ins) hipMap[nom] = ins.id;
    }
  }

  let inserted = 0, updated = 0;
  for (const c of courses) {
    const hippodromeId = hipMap[c.hippodromeName];
    if (!hippodromeId) continue;

    const { data: existing } = await supabase.from("courses").select("id")
      .eq("hippodrome_id", hippodromeId)
      .eq("date_course", c.dateCourse)
      .eq("numero_reunion", c.numeroReunion)
      .eq("numero_course", c.numeroCourse)
      .single();

    if (existing) {
      await supabase.from("courses").update({
        nb_partants:       c.nbPartants,
        libelle:           c.libelle,
        paris_disponibles: c.parisDisponibles,
      }).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("courses").insert({
        hippodrome_id:     hippodromeId,
        date_course:       c.dateCourse,
        heure_depart:      c.heureDepart,
        numero_reunion:    c.numeroReunion,
        numero_course:     c.numeroCourse,
        libelle:           c.libelle,
        distance_metres:   c.distanceMetres,
        categorie:         c.categorie,
        nb_partants:       c.nbPartants,
        statut:            "PROGRAMME",
        paris_disponibles: c.parisDisponibles,
      });
      inserted++;
    }
  }
  return { inserted, updated };
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  let dateStr;

  if (!arg || arg === "aujourd'hui") {
    dateStr = toDateStr();
  } else if (arg === "demain") {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dateStr = toDateStr(d);
  } else {
    dateStr = arg;
  }

  console.log(`\n🏇 Elite Turf — Sync PMU local`);
  console.log(`📅 Date : ${dateStr}`);
  console.log(`─────────────────────────────`);

  try {
    console.log("\n1. Récupération du programme PMU...");
    const reunions = await fetchProgramme(dateStr);
    const courses  = normalizeReunions(reunions);
    console.log(`   → ${reunions.length} réunions, ${courses.length} courses`);

    console.log("\n2. Insertion dans Supabase...");
    const { inserted, updated } = await syncToSupabase(courses);
    console.log(`   → ${inserted} insérées, ${updated} mises à jour`);

    console.log("\n✅ Sync terminée avec succès !\n");
  } catch (err) {
    console.error(`\n❌ Erreur : ${err.message}\n`);
    process.exit(1);
  }
}

main();
