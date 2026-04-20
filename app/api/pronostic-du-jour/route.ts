/**
 * GET /api/pronostic-du-jour
 *
 * Retourne les pronostics publiés du jour en JSON.
 * Conçu pour les automatisations externes (Make.com, Zapier, bots Slack/WhatsApp).
 *
 * Sécurité : protégé par `x-api-key` header OU `?api_key=` query param.
 * Définir la variable d'environnement PRONOSTIC_API_KEY sur Vercel.
 * Si la variable est vide, l'endpoint est public (pratique en dev).
 *
 * Exemple de réponse :
 * {
 *   "ok": true,
 *   "date": "2026-04-20",
 *   "total": 2,
 *   "pronostics": [
 *     {
 *       "id": "...",
 *       "course": "Prix de Monfort",
 *       "hippodrome": "Toulouse",
 *       "type_pari": "QUINTE_PLUS",
 *       "heure_depart": "16h10",
 *       "selection": [4, 3, 14, 1, 5],
 *       "selection_texte": "4 - 3 - 14 - 1 - 5",
 *       "confiance": "HAUTE",
 *       "niveau_acces": "GRATUIT",
 *       "resultat": "EN_ATTENTE",
 *       "lien_geny": "https://www.geny.com/..."
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

type HippodromeRow = { nom: string; pays: string } | null;
type CourseRow = {
  date_course: string;
  heure_depart: string | null;
  numero_reunion: number;
  numero_course: number;
  libelle: string | null;
  distance_metres: number | null;
  nb_partants: number | null;
  hippodrome: HippodromeRow | HippodromeRow[];
} | null;

// ── Helper : formater "HH:MM:SS" → "HHhMM" ──────────────────────────────────

function formatHeure(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const [h, m] = raw.split(":");
  if (!h || !m) return null;
  return `${h}h${m}`;
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── 1. Vérification de la clé API ─────────────────────────────────────────
  const apiKey = process.env.PRONOSTIC_API_KEY ?? "";
  if (apiKey) {
    const provided =
      req.headers.get("x-api-key") ??
      req.nextUrl.searchParams.get("api_key") ??
      "";
    if (provided !== apiKey) {
      return NextResponse.json(
        { ok: false, error: "Clé API invalide ou manquante." },
        { status: 401 }
      );
    }
  }

  // ── 2. Date du jour (heure Paris) ─────────────────────────────────────────
  const today = new Date()
    .toLocaleString("sv-SE", { timeZone: "Europe/Paris" })
    .split(" ")[0]; // "YYYY-MM-DD"

  // Permettre de surcharger la date via ?date=2026-04-20 (utile pour tests Make)
  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  // ── 3. Requête Supabase ───────────────────────────────────────────────────
  const supabase = createServiceClient();

  const { data: pronostics, error } = await supabase
    .from("pronostics")
    .select(
      `
      id,
      type_pari,
      selection,
      confiance,
      analyse_courte,
      niveau_acces,
      resultat,
      lien_geny,
      course:courses (
        date_course,
        heure_depart,
        numero_reunion,
        numero_course,
        libelle,
        distance_metres,
        nb_partants,
        hippodrome:hippodromes (
          nom,
          pays
        )
      )
    `
    )
    .eq("publie", true)
    .order("date_publication", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  // ── 4. Filtrer sur la date cible ──────────────────────────────────────────
  const todayPronostics = (pronostics ?? []).filter((p) => {
    const c = Array.isArray(p.course) ? p.course[0] : p.course;
    return (c as CourseRow)?.date_course === targetDate;
  });

  // ── 5. Formatter la réponse ───────────────────────────────────────────────
  const dateGeny = targetDate.replace(/-/g, ""); // "20260420"

  const formatted = todayPronostics.map((p) => {
    const course = (
      Array.isArray(p.course) ? p.course[0] : p.course
    ) as CourseRow;
    const hippodrome = (
      Array.isArray(course?.hippodrome)
        ? course?.hippodrome[0]
        : course?.hippodrome
    ) as HippodromeRow;

    const selection = (p.selection as number[]) ?? [];
    const selectionTexte = selection.join(" - ");

    const lienGeny =
      p.lien_geny ||
      `https://www.geny.com/reunions-courses-pmu/_d${dateGeny}`;

    return {
      id: p.id,
      date: targetDate,
      course: course?.libelle ?? "",
      hippodrome: hippodrome?.nom ?? "",
      pays: hippodrome?.pays ?? "France",
      type_pari: p.type_pari ?? "",
      reunion: course?.numero_reunion ?? null,
      numero_course: course?.numero_course ?? null,
      heure_depart: formatHeure(course?.heure_depart),
      distance_metres: course?.distance_metres ?? null,
      nb_partants: course?.nb_partants ?? null,
      selection,
      selection_texte: selectionTexte,
      confiance: p.confiance ?? null,
      analyse_courte: p.analyse_courte ?? null,
      niveau_acces: p.niveau_acces ?? "GRATUIT",
      resultat: p.resultat ?? "EN_ATTENTE",
      lien_geny: lienGeny,
    };
  });

  // ── 6. Réponse ────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      date: targetDate,
      total: formatted.length,
      pronostics: formatted,
    },
    {
      headers: {
        // Autoriser Make.com à appeler depuis n'importe quel domaine
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    }
  );
}
