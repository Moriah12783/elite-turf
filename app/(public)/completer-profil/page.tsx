/**
 * /completer-profil
 *
 * Écran BLOQUANT pour les abonnés existants qui n'ont pas encore renseigné
 * leur numéro de téléphone (donnée critique pour Mobile Money + support
 * WhatsApp + anti-fraude).
 *
 * Logique :
 *  1. Le middleware redirige tout user authentifié sans phone → ici
 *  2. Cette page demande téléphone + pays (autres champs récupérés du profile)
 *  3. Après save → redirige vers /espace-membre
 *
 * Pas de paywall, pas de skip — l'objectif est de récupérer 100% des
 * téléphones manquants en max 1-2 connexions.
 */

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import CompleterProfilForm from "./CompleterProfilForm";

export const dynamic = "force-dynamic";

export default async function CompleterProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Pas authentifié → redirige vers /connexion
  if (!user) {
    redirect("/connexion?redirect=/completer-profil");
  }

  // Récupère le profil pour pré-remplir les valeurs
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("nom_complet, email, phone, pays")
    .eq("id", user.id)
    .maybeSingle();

  // Si l'utilisateur a déjà un téléphone (cas où il a rafraîchi par erreur)
  // → on le renvoie directement à son espace membre
  if (profile?.phone && profile.phone.replace(/\D/g, "").length >= 8) {
    redirect("/espace-membre");
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <CompleterProfilForm
          userId={user.id}
          email={profile?.email ?? user.email ?? ""}
          nomCompletInitial={profile?.nom_complet ?? ""}
          paysInitial={profile?.pays ?? "Côte d'Ivoire"}
        />
      </div>
    </div>
  );
}
