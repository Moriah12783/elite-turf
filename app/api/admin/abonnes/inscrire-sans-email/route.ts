import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PAYS_OPTIONS } from "@/lib/utils/pays";
import { motifEmailExact } from "@/lib/paiement/activation-mobile-money";
import {
  DOMAINE_ADRESSE_TECHNIQUE,
  adresseTechnique,
  premierRangLibre,
  telephoneInternational,
  memeNumero,
} from "@/lib/abonnements/sans-email";

/** Profils lus par page pour chercher un numéro déjà enregistré. */
const PAGE_PROFILS = 1000;
/** Garde-fou : jamais de boucle sans fin, quelle que soit la limite de PostgREST. */
const PAGES_MAX = 100;

/**
 * Mot de passe aléatoire (256 bits), jamais affiché ni stocké : l'abonné ne se
 * connecte pas, Steph lui envoie les pronostics sur WhatsApp.
 */
function motDePasseAleatoire(): string {
  const octets = new Uint8Array(32);
  globalThis.crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

function champTexte(valeur: unknown, max: number): string {
  return typeof valeur === "string" ? valeur.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/**
 * POST /api/admin/abonnes/inscrire-sans-email
 * { prenom, nom, telephone, pays?, autreTelephone?, apercu?: boolean, numeroConfirme?: boolean }
 *
 * Carte « Inscrire un abonné sans e-mail » de /admin/utilisateurs (décisions de
 * Steph du 10/11/2026) : crée le compte d'un abonné WhatsApp qui n'a pas
 * d'e-mail, avec l'adresse technique `prenom.nom@elite-turf.fr` (homonyme →
 * `prenom.nom2@`…). Le paiement s'active ENSUITE avec le formulaire habituel
 * (« Activer un paiement Orange Money / Wave »), pré-rempli avec cette adresse.
 * Règles pures : lib/abonnements/sans-email.ts.
 *
 * `apercu: true` → ne modifie RIEN : renvoie l'adresse qui sera créée, les
 * comptes qui portent déjà ce numéro ou ce nom.
 *
 * Refus (rien n'est créé) :
 *   - prénom, nom ou numéro manquant ; numéro sans indicatif ; pays inconnu ;
 *   - numéro déjà enregistré sur un autre compte, sauf `numeroConfirme`
 *     (numéro partagé par deux personnes) ;
 *   - adresse déjà présente dans l'authentification (compte sans profil).
 *
 * Création : `auth.admin.createUser` (service role, `email_confirm: true`),
 * puis le profil est réécrit (nom, téléphone, pays, `sms_opt_in = false`,
 * `email_opted_out = true`) : le trigger handle_new_user a déjà divergé du
 * fichier de migration, on ne compte pas sur lui.
 */
export async function POST(req: NextRequest) {
  // ── Admin connecté, session seule : cette route crée un compte, elle
  //    n'accepte donc PAS le CRON_SECRET (comme la route d'activation).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createServiceClient();
  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // ── Saisie ───────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const prenom = champTexte(body.prenom, 60);
  const nom = champTexte(body.nom, 60);
  const telephoneSaisi = champTexte(body.telephone, 40);
  const autreSaisi = champTexte(body.autreTelephone, 40);
  const paysSaisi = champTexte(body.pays, 60);
  const apercu = body.apercu === true;
  const numeroConfirme = body.numeroConfirme === true;

  if (!prenom || !nom || !telephoneSaisi) {
    return NextResponse.json({ error: "Champs manquants : prénom, nom et numéro WhatsApp." }, { status: 400 });
  }
  // Ces caractères sont des jokers ou des délimiteurs dans les recherches
  // PostgREST (ILIKE) : refus plutôt que de risquer le mauvais compte.
  if (/[*%_\\@<>"]/.test(`${prenom}${nom}`)) {
    return NextResponse.json(
      { error: "Caractère non pris en charge dans le prénom ou le nom (* % _ \\ @ < > \")." },
      { status: 400 },
    );
  }
  const adresseDeBase = adresseTechnique(prenom, nom);
  if (!adresseDeBase) {
    return NextResponse.json(
      { error: "Prénom ou nom sans aucune lettre : impossible de former l'adresse technique." },
      { status: 400 },
    );
  }
  const telephone = telephoneInternational(telephoneSaisi);
  if (!telephone) {
    return NextResponse.json(
      { error: "Numéro WhatsApp invalide : avec l'indicatif (+226…, +225…), 10 à 15 chiffres." },
      { status: 400 },
    );
  }
  const autreTelephone = autreSaisi ? telephoneInternational(autreSaisi) : null;
  if (autreSaisi && !autreTelephone) {
    return NextResponse.json(
      { error: "Autre numéro invalide : avec l'indicatif (+226…, +225…), 10 à 15 chiffres." },
      { status: 400 },
    );
  }
  // Même valeur que l'inscription publique : le NOM du pays (« Burkina Faso »).
  const pays = paysSaisi ? (PAYS_OPTIONS.find((p) => p.nom === paysSaisi)?.nom ?? null) : null;
  if (paysSaisi && !pays) {
    return NextResponse.json({ error: `Pays inconnu : ${paysSaisi}.` }, { status: 400 });
  }
  const nomComplet = `${prenom} ${nom}`;

  // ── Comptes qui portent déjà ce numéro ───────────────────────────────────
  // Les numéros sont enregistrés dans des formats variés (« +226 70… »,
  // « 0022670… ») : lecture de tous les profils avec numéro, comparaison sur
  // les 8 derniers chiffres. Pagination jusqu'à une page vide (la limite de
  // lignes de PostgREST peut être inférieure à PAGE_PROFILS).
  const memeTelephone: { email: string | null; nom_complet: string | null; statut_abonnement: string | null }[] = [];
  for (let depart = 0, page = 0; page < PAGES_MAX; page++) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, nom_complet, phone, statut_abonnement")
      .not("phone", "is", null)
      .order("id")
      .range(depart, depart + PAGE_PROFILS - 1);
    if (error) {
      return NextResponse.json(
        { error: `Recherche des comptes existants impossible (${error.message}) : rien n'a été créé.` },
        { status: 500 },
      );
    }
    if (!data || data.length === 0) break;
    for (const p of data) {
      if (memeNumero(p.phone, telephone) || (autreTelephone && memeNumero(p.phone, autreTelephone))) {
        memeTelephone.push({ email: p.email, nom_complet: p.nom_complet, statut_abonnement: p.statut_abonnement });
      }
    }
    depart += data.length;
  }

  // ── Comptes qui portent déjà ce nom, adresses déjà prises ────────────────
  const prefixe = adresseDeBase.split("@")[0];
  const [{ data: memeNom, error: errNom }, { data: prises, error: errPrises }] = await Promise.all([
    admin.from("profiles").select("email, statut_abonnement").ilike("nom_complet", motifEmailExact(nomComplet)).limit(5),
    admin
      .from("profiles")
      .select("email")
      .ilike("email", `${motifEmailExact(prefixe)}%@${DOMAINE_ADRESSE_TECHNIQUE}`)
      .limit(200),
  ]);
  if (errNom || errPrises) {
    return NextResponse.json(
      { error: `Recherche des comptes existants impossible (${(errNom ?? errPrises)?.message}) : rien n'a été créé.` },
      { status: 500 },
    );
  }
  const rang = premierRangLibre(prenom, nom, (prises ?? []).map((p) => String(p.email ?? "")));
  const adresse = adresseTechnique(prenom, nom, rang) as string;

  const avertissements: string[] = [];
  if (rang > 1) {
    avertissements.push(`Homonyme : ${adresseDeBase} est déjà prise, ce compte aura l'adresse ${adresse}.`);
  }
  if (memeNom && memeNom.length > 0) {
    avertissements.push(
      `Un compte porte déjà le nom « ${nomComplet} » (${memeNom
        .map((m) => `${m.email ?? "sans e-mail"}, ${m.statut_abonnement ?? "GRATUIT"}`)
        .join(" ; ")}) : vérifiez qu'il ne s'agit pas du même abonné.`,
    );
  }

  const resume = {
    membre: { nomComplet, adresse, telephone, autreTelephone, pays },
    comptesMemeNumero: memeTelephone.map((c) => ({
      nom: c.nom_complet ?? null,
      email: c.email ?? null,
      statut: c.statut_abonnement ?? null,
    })),
    avertissements,
  };

  if (apercu) return NextResponse.json({ apercu: true, ...resume });

  // ── Numéro déjà enregistré : refus sauf confirmation explicite ───────────
  if (memeTelephone.length > 0 && !numeroConfirme) {
    return NextResponse.json(
      {
        doublon: true,
        ...resume,
        error:
          "Ce numéro est déjà celui d'un compte. Même abonné : activez son compte existant. Autre personne (numéro partagé) : confirmez la création.",
      },
      { status: 409 },
    );
  }

  // ── 1. Le compte (authentification) ──────────────────────────────────────
  const { data: cree, error: errCreation } = await admin.auth.admin.createUser({
    email: adresse,
    password: motDePasseAleatoire(),
    email_confirm: true,
    user_metadata: {
      nom_complet: nomComplet,
      phone: telephone,
      pays,
      sms_opt_in: false,
      compte_sans_email: true,
      cree_par_admin: user.id,
      ...(autreTelephone ? { telephone_appel: autreTelephone } : {}),
    },
  });
  if (errCreation || !cree?.user) {
    const message = errCreation?.message ?? "réponse vide";
    const dejaPrise = /already|registered|exists/i.test(message);
    return NextResponse.json(
      {
        error: dejaPrise
          ? `L'adresse ${adresse} existe déjà dans l'authentification (compte sans profil) : rien n'a été créé, à régler à la main.`
          : `Création du compte impossible : ${message}. Rien n'a été créé.`,
      },
      { status: dejaPrise ? 409 : 500 },
    );
  }
  const id = cree.user.id;

  // ── 2. Le profil : réécrit, sans compter sur le trigger ──────────────────
  const champs = {
    nom_complet:     nomComplet,
    phone:           telephone,
    pays,
    sms_opt_in:      false,
    email_opted_out: true,
  };
  const { data: majProfil, error: errMaj } = await admin.from("profiles").update(champs).eq("id", id).select("id");
  let etapeProfil: { ok: boolean; erreur?: string; note?: string };
  if (errMaj) {
    etapeProfil = {
      ok: false,
      erreur: `${errMaj.message}. Le compte existe : corrigez son profil à la main (nom, téléphone, sms_opt_in = false).`,
    };
  } else if (!majProfil || majProfil.length === 0) {
    // Aucun profil : trigger handle_new_user absent ou divergent → on le crée.
    const { error: errInsert } = await admin.from("profiles").insert({
      id,
      email:             adresse,
      role:              "USER",
      statut_abonnement: "GRATUIT",
      actif:             true,
      date_inscription:  new Date().toISOString(),
      ...champs,
    });
    etapeProfil = errInsert
      ? { ok: false, erreur: `${errInsert.message}. Le compte existe sans profil : à créer à la main avant l'activation.` }
      : { ok: true, note: "profil créé par la route (le trigger ne l'avait pas fait)" };
  } else {
    etapeProfil = { ok: true };
  }

  return NextResponse.json({
    success: true,
    ...resume,
    etapes: { compte: { ok: true }, profil: etapeProfil },
  });
}
