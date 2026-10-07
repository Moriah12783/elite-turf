/**
 * GET /api/cron/brouillons-quinte
 *
 * Brouillons automatiques du Quinté+ à ~T-90 (spec
 * docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md).
 * Toutes les 5 min (elite-turf-crons, minutes 4, 9, … 59). Une fois par
 * Quinté+ : un brouillon PRO et un brouillon ELITE (source AUTO-MARCHE, jamais
 * publiés), puis un e-mail à Steph. Interrupteur BROUILLONS_QUINTE_ENABLED
 * fermé (absent) = essai à blanc : rien n'est écrit, l'e-mail le dit.
 *
 * `?apercu=1` (Bearer requis) : calcule et renvoie les brouillons en JSON, sans
 * fenêtre, sans garde-fous, sans écriture ni e-mail (seul cron_logs en garde
 * une trace). Pour vérifier.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";
import { todayParisISO, parisVersUtc } from "@/lib/paris-date";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";
import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import { buildNotreSelection } from "@/lib/courses/notre-selection";
import { sendEmail, APP_URL } from "@/lib/email";
import { chargerDonneesPmu } from "@/lib/brouillons-quinte/pmu";
import {
  situer, dansFenetre, dernierPassage, gardeFous, type PronosticExistant,
} from "@/lib/brouillons-quinte/fenetre";
import { appliquerCotesPmu } from "@/lib/brouillons-quinte/selection";
import { controlerDonneesPmu, assemblerBrouillons } from "@/lib/brouillons-quinte/assembler";
import {
  emailBrouillons, emailEchec, emailRelance, typeJournal,
  type GenreEmail, type LiensBrouillons, type RaisonEchec,
} from "@/lib/brouillons-quinte/email";
import { heureGmt } from "@/lib/brouillons-quinte/commentaires";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@elite-turf.fr";

function liensVers(idPro: string | null, idElite: string | null): LiensBrouillons {
  const lien = (id: string | null) => (id ? `${APP_URL}/admin/pronostics/${id}/modifier` : null);
  return { pro: lien(idPro), elite: lien(idElite) };
}

/**
 * Envoie à Steph au plus une fois par genre et par jour (email_sent_log,
 * UNIQUE(email, type)). Seul le statut SENT bloque : un envoi raté est
 * journalisé FAILED et retenté au passage suivant.
 */
async function envoyerUneFois(
  supabase: SupabaseClient,
  jour: string,
  genre: GenreEmail,
  mail: { subject: string; html: string },
): Promise<"envoye" | "deja" | "echec_envoi"> {
  const type = typeJournal(jour, genre);
  const { data: deja } = await supabase
    .from("email_sent_log")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .eq("type", type)
    .eq("status", "SENT")
    .maybeSingle();
  if (deja) return "deja";
  const ok = await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, html: mail.html });
  await supabase.from("email_sent_log").upsert(
    { email: ADMIN_EMAIL, type, status: ok ? "SENT" : "FAILED", error: ok ? null : "envoi refusé", sent_at: new Date().toISOString() },
    { onConflict: "email,type" },
  );
  return ok ? "envoye" : "echec_envoi";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apercu = req.nextUrl.searchParams.get("apercu") === "1";
  const cronLog = logCronStart("brouillons-quinte");
  const supabase = createServiceClient();
  const jour = todayParisISO();
  let minutes: number | null = null;
  let prix = "Quinté+";
  let heure = "";

  /** Données PMU insuffisantes : nouvel essai au passage suivant ; e-mail d'échec au dernier. */
  async function donneesInsuffisantes(raison: RaisonEchec) {
    let email: string | null = null;
    if (!apercu && dernierPassage(minutes)) {
      email = await envoyerUneFois(supabase, jour, "echec", emailEchec({ jour, prix, heureGmt: heure, raison }));
    }
    await cronLog.finish("skip", { reason: "donnees_insuffisantes", raison, minutes, email, jour });
    return NextResponse.json({ ok: true, skipped: "donnees_insuffisantes", raison });
  }

  try {
    // 1. Le Quinté+ du jour (même repère que la Vedette de l'accueil) et la fenêtre
    const { data: courses, error } = await supabase
      .from("courses")
      .select("id, libelle, date_course, heure_depart, numero_reunion, numero_course, distance_metres, nationale, jouable_afrique, paris_disponibles, statut, hippodrome:hippodromes(nom)")
      .eq("date_course", jour);
    if (error) throw new Error(`courses : ${error.message}`);
    const quinte: any = pickQuinteDuJour((courses ?? []) as any[]);
    if (!quinte) {
      await cronLog.finish("skip", { reason: "pas_de_quinte", jour });
      return NextResponse.json({ ok: true, skipped: "pas_de_quinte" });
    }
    const depart = parisVersUtc(quinte.date_course, quinte.heure_depart);
    const moment = situer(depart);
    if (moment.etat === "heure_inconnue" || !depart) {
      // Heure illisible : arrêt sans alerte (sinon un échec toutes les 5 min, toute la journée).
      await cronLog.finish("skip", { reason: "heure_depart_inconnue", heure_depart: quinte.heure_depart ?? null, jour });
      return NextResponse.json({ ok: true, skipped: "heure_depart_inconnue" });
    }
    minutes = moment.minutes;
    prix = quinte.libelle || prix;
    heure = heureGmt(depart.getTime());
    if (!apercu && moment.etat === "hors_fenetre") {
      await cronLog.finish("skip", { reason: "hors_fenetre", minutes, jour });
      return NextResponse.json({ ok: true, skipped: "hors_fenetre", minutes });
    }

    // 2. Garde-fous : déjà publié, déjà préparé, brouillons retirés, échec déjà signalé
    if (!apercu) {
      const { data: existants, error: eErr } = await supabase
        .from("pronostics")
        .select("id, niveau_acces, publie, source")
        .eq("course_id", quinte.id);
      if (eErr) throw new Error(`pronostics existants : ${eErr.message}`);
      const { data: journal, error: jErr } = await supabase
        .from("email_sent_log")
        .select("type")
        .eq("email", ADMIN_EMAIL)
        .eq("status", "SENT")
        .in("type", [typeJournal(jour, "prets"), typeJournal(jour, "echec")]);
      if (jErr) throw new Error(`journal des e-mails : ${jErr.message}`);
      const envoyes = (journal ?? []).map((l: any) => String(l.type));
      const garde = gardeFous({
        existants: (existants ?? []) as PronosticExistant[],
        pretsEnvoye: envoyes.indexOf(typeJournal(jour, "prets")) !== -1,
        echecEnvoye: envoyes.indexOf(typeJournal(jour, "echec")) !== -1,
      });
      if (garde.action === "arreter") {
        await cronLog.finish("skip", { reason: garde.raison, minutes, jour });
        return NextResponse.json({ ok: true, skipped: garde.raison });
      }
      if (garde.action === "deja_prepare") {
        // L'e-mail « prêts » a pu échouer au passage précédent : relance (sans effet s'il est parti).
        const email = await envoyerUneFois(supabase, jour, "prets", emailRelance({ prix, heureGmt: heure, liens: liensVers(garde.idPro, garde.idElite) }));
        await cronLog.finish("skip", { reason: "deja_prepare", email, minutes, jour });
        return NextResponse.json({ ok: true, skipped: "deja_prepare", email });
      }
    }

    // 3. Données PMU et contrôles bloquants
    const { data: partantsBase, error: pErr } = await supabase
      .from("partants")
      .select("id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, non_partant")
      .eq("course_id", quinte.id);
    if (pErr) throw new Error(`partants : ${pErr.message}`);
    const base = (partantsBase ?? []) as any[];
    const pmu = await chargerDonneesPmu(quinte.date_course, quinte.numero_reunion, quinte.numero_course);
    const raison = controlerDonneesPmu(base, pmu.participants);
    if (raison || !pmu.participants) return await donneesInsuffisantes(raison ?? "pmu_injoignable");

    // 4. Les 8 favoris, dans l'ordre de la Sélection stats du site (non-partants exclus en amont)
    const avecCotes = appliquerCotesPmu(base, pmu.participants).filter((p: any) => !p.non_partant);
    const stats = await getCourseStatsEnrichies(avecCotes);
    const top8 = buildNotreSelection(stats.partants);

    // 5. Brouillons et textes
    const hippo = Array.isArray(quinte.hippodrome) ? quinte.hippodrome[0] : quinte.hippodrome;
    const resultat = assemblerBrouillons({
      courseId: quinte.id,
      top8,
      ctx: {
        dateISO: quinte.date_course,
        prix,
        hippodrome: hippo?.nom ?? "",
        reunion: quinte.numero_reunion,
        course: quinte.numero_course,
        heureParis: quinte.heure_depart,
        departUtc: depart,
        coursePmu: pmu.course,
        distanceBase: quinte.distance_metres ?? null,
        participants: pmu.participants,
      },
    });
    if (!resultat.ok) return await donneesInsuffisantes(resultat.raison);

    if (apercu) {
      await cronLog.finish("skip", { reason: "apercu", minutes, jour });
      return NextResponse.json({ ok: true, apercu: true, minutes, pro: resultat.pro, elite: resultat.elite, resume: resultat.resume });
    }

    // 6. Interrupteur : fermé = essai à blanc, rien n'est écrit
    if (process.env.BROUILLONS_QUINTE_ENABLED !== "true") {
      const email = await envoyerUneFois(supabase, jour, "blanc", emailBrouillons(resultat.resume, null));
      await cronLog.finish("success", { dry_run: true, email, pro: resultat.pro.selection, elite: resultat.elite.selection, minutes, jour });
      return NextResponse.json({ ok: true, dryRun: true, email });
    }

    // 7. Les deux brouillons en un seul appel : tout ou rien
    const { data: inseres, error: iErr } = await supabase
      .from("pronostics")
      .insert([resultat.pro, resultat.elite])
      .select("id, niveau_acces");
    if (iErr) throw new Error(`insertion des brouillons : ${iErr.message}`);
    const lignes = (inseres ?? []) as Array<{ id: string; niveau_acces: string }>;
    const idPro = lignes.find((l) => l.niveau_acces === "PRO")?.id ?? null;
    const idElite = lignes.find((l) => l.niveau_acces === "ELITE")?.id ?? null;
    const email = await envoyerUneFois(supabase, jour, "prets", emailBrouillons(resultat.resume, liensVers(idPro, idElite)));
    await cronLog.finish("success", { drafts_created: [idPro, idElite], email, minutes, jour });
    return NextResponse.json({ ok: true, brouillons: [idPro, idElite], email });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    let email: string | null = null;
    // Erreur non réessayée (spec §10) : e-mail immédiat, mais seulement dans la fenêtre.
    if (!apercu && dansFenetre(minutes)) {
      email = await envoyerUneFois(supabase, jour, "echec", emailEchec({ jour, prix, heureGmt: heure, raison: "erreur", detail: message }))
        .catch(() => "echec_envoi");
    }
    await cronLog.finish("failure", { error: message, email, minutes, jour });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
