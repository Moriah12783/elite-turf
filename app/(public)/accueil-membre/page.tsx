/**
 * /accueil-membre — accueil PERSONNALISÉ des membres connectés (brief SEO du
 * 01/10/2026, B3).
 *
 * Le middleware y réécrit « / » quand un membre est connecté : l'adresse
 * affichée reste « / ». Identique à l'accueil d'avant : Radar de la presse
 * masqué aux abonnés payants, pronostics déverrouillés selon l'abonnement.
 * Les visiteurs non connectés et Google reçoivent `/`, mise en cache.
 */
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserSubscription } from "@/lib/auth/subscription";
import AccueilSections from "@/components/home/AccueilSections";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: { absolute: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium" },
  alternates: { canonical: APP_URL },
  robots: { index: false, follow: true },
};

/**
 * Vrai abonné = plan payant ACTIF (STARTER/PRO/ELITE non expiré). Sert à
 * MASQUER le Radar de la presse aux abonnés (ils ont déjà le pronostic).
 */
async function isVraiAbonne(): Promise<boolean> {
  try {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;
    const sub = await resolveUserSubscription(createServiceClient(), user.id);
    return sub !== "GRATUIT" && sub !== "EXPIRE";
  } catch {
    return false; // non authentifié / erreur → traité comme visiteur
  }
}

export default async function AccueilMembre() {
  const abonne = await isVraiAbonne();
  return <AccueilSections abonne={abonne} personnalise />;
}
