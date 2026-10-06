import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import { resolvePlanUuid } from "@/lib/plans/resolve";
import { paysMobileMoney } from "@/lib/paiement/mobile-money";
import {
  OPERATEURS,
  type Operateur,
  palierDeFormule,
  montantFcfa,
  calculerPeriode,
  avertissements,
  dateLongue,
  referenceMobileMoney,
  motifEmailExact,
} from "@/lib/paiement/activation-mobile-money";
import { envoyerConfirmationAbonnement } from "@/lib/abonnements/confirmation";

/** Un second paiement enregistré moins de 10 min après le premier = doublon probable. */
const DELAI_DOUBLON_MS = 10 * 60 * 1000;

/**
 * POST /api/admin/abonnements/activer-mobile-money
 * { email, formule: "starter"|"pro"|"elite", operateur: "ORANGE_MONEY"|"WAVE",
 *   pays?, reference?, envoyerEmail?: boolean (défaut true),
 *   apercu?: boolean, doublonConfirme?: boolean }
 *
 * Bouton « Activer » de /admin/utilisateurs (demande de Steph du 06/10/2026) :
 * après un paiement Orange Money / Wave reçu sur WhatsApp, active l'accès,
 * enregistre le paiement et envoie l'e-mail de confirmation. Règles pures et
 * décisions de Steph : lib/paiement/activation-mobile-money.ts.
 *
 * `apercu: true` → ne modifie RIEN : renvoie ce qui va se passer (affiché à
 * l'admin avant qu'il confirme). Mêmes calculs que l'activation réelle.
 *
 * Refus (rien n'est écrit) :
 *   - aucun compte, ou plusieurs comptes, avec cet e-mail ;
 *   - renouvellement automatique par carte en cours (Stripe écraserait tout) ;
 *   - accès payant sans date de fin (permanent) ;
 *   - paiement Orange Money / Wave déjà enregistré il y a < 10 min, sauf
 *     `doublonConfirme`.
 *
 * Ordre des écritures : le profil d'abord (c'est lui qui ouvre l'accès ; s'il
 * échoue, rien d'autre n'est écrit), puis la ligne `abonnements`, le paiement,
 * l'e-mail. Chaque étape est rapportée à l'admin (rien n'est transactionnel).
 */
export async function POST(req: NextRequest) {
  // ── Admin connecté, session seule : cette route ouvre un accès payant, elle
  //    n'accepte donc PAS le CRON_SECRET (contrairement à requireAdminAuth).
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
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const formule = typeof body.formule === "string" ? body.formule : "";
  const operateur: Operateur | null = body.operateur === "ORANGE_MONEY" || body.operateur === "WAVE" ? body.operateur : null;
  const pays = paysMobileMoney(typeof body.pays === "string" ? body.pays : null);
  const referenceSaisie = typeof body.reference === "string" ? body.reference.trim().slice(0, 100) : "";
  const envoyerEmail = body.envoyerEmail !== false;
  const apercu = body.apercu === true;
  const doublonConfirme = body.doublonConfirme === true;

  const plan = PLAN_CONFIG.find((p) => p.id === formule);
  const palier = palierDeFormule(formule);
  if (!email || !plan || !palier || !operateur) {
    return NextResponse.json(
      { error: "Champs manquants : e-mail du compte, formule (Starter, Pro, Elite) et opérateur (Orange Money, Wave)." },
      { status: 400 },
    );
  }
  // PostgREST lit « * » comme un joker dans un motif ILIKE, impossible à
  // neutraliser : refus plutôt que de risquer le mauvais compte.
  if (email.indexOf("*") !== -1) {
    return NextResponse.json({ error: "Adresse e-mail non prise en charge (caractère *)." }, { status: 400 });
  }

  // ── Compte de l'abonné ───────────────────────────────────────────────────
  // ILIKE pour ignorer la casse, puis comparaison EXACTE : seul le compte dont
  // l'adresse est identique (casse et espaces mis à part) est retenu.
  const emailNorme = email.toLowerCase();
  const { data: candidats, error: errProfil } = await admin
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement, date_expiration_abonnement, date_debut_abonnement")
    .ilike("email", motifEmailExact(email))
    .limit(5);
  if (errProfil) {
    return NextResponse.json({ error: `Lecture du compte impossible : ${errProfil.message}` }, { status: 500 });
  }
  const profils = (candidats ?? []).filter((p) => String(p.email ?? "").trim().toLowerCase() === emailNorme);
  if (profils.length === 0) {
    return NextResponse.json(
      {
        error: `Aucun compte Elite Turf avec l'e-mail ${email}. L'abonné doit d'abord créer son compte (il peut le faire après avoir payé), puis vous l'activez.`,
      },
      { status: 404 },
    );
  }
  if (profils.length > 1) {
    return NextResponse.json(
      { error: `Plusieurs comptes portent l'e-mail ${email} : activation refusée, à régler à la main.` },
      { status: 409 },
    );
  }
  const profil = profils[0];

  // ── Renouvellement automatique par carte en cours → refus ────────────────
  // Stripe prélèverait à l'échéance et écraserait formule et date
  // (lib/stripe/activate.ts), et l'abonné ne pourrait plus l'annuler.
  const { data: aboCarte, error: errCarte } = await admin
    .from("abonnements")
    .select("id")
    .eq("user_id", profil.id)
    .eq("statut", "ACTIF")
    .eq("auto_renouvellement", true)
    .not("stripe_subscription_id", "is", null)
    .limit(1);
  if (errCarte) {
    return NextResponse.json(
      { error: `Vérification du renouvellement par carte impossible (${errCarte.message}) : rien n'a été modifié.` },
      { status: 500 },
    );
  }
  if (aboCarte && aboCarte.length > 0) {
    return NextResponse.json(
      {
        error:
          "Cet abonné a un renouvellement automatique par carte en cours : il doit d'abord l'annuler depuis son espace membre. Activation refusée, rien n'a été modifié.",
      },
      { status: 409 },
    );
  }

  // ── Période ──────────────────────────────────────────────────────────────
  const maintenant = new Date();
  const etat = { statut: profil.statut_abonnement ?? null, expiration: profil.date_expiration_abonnement ?? null };
  const periode = calculerPeriode(etat, plan.duree_jours, maintenant);
  if ("erreur" in periode) {
    return NextResponse.json(
      {
        error: `Ce compte a un accès ${etat.statut} sans date de fin (permanent) : l'activation lui en donnerait une. Activation refusée, rien n'a été modifié.`,
      },
      { status: 409 },
    );
  }

  const montant = montantFcfa(plan);
  const resume = {
    membre: { nom: profil.nom_complet ?? null, email: profil.email },
    actuel: {
      statut: etat.statut,
      expiration: etat.expiration,
      expirationLisible: etat.expiration ? dateLongue(etat.expiration) : null,
    },
    nouveau: {
      statut: palier,
      formule: plan.nom,
      dureeJours: plan.duree_jours,
      fin: periode.fin,
      finLisible: dateLongue(periode.fin),
      prolongation: periode.prolongation,
    },
    paiement: {
      montantFcfa: montant,
      operateur,
      operateurLibelle: OPERATEURS[operateur],
      pays,
      reference: referenceSaisie || null,
    },
    envoyerEmail,
    avertissements: avertissements(etat, palier, maintenant),
  };

  if (apercu) return NextResponse.json({ apercu: true, ...resume });

  // ── Doublon probable (refus sauf confirmation explicite) ─────────────────
  // Trois signaux : un paiement Orange Money / Wave enregistré il y a moins de
  // 10 min ; une activation du profil il y a moins de 10 min (couvre une
  // première tentative interrompue après l'étape 1, et un paiement par carte
  // tout juste passé) ; la même référence d'opérateur déjà enregistrée.
  // Si une de ces vérifications échoue, on refuse : mieux vaut réessayer que
  // compter deux fois un même paiement.
  if (!doublonConfirme) {
    const depuis = new Date(maintenant.getTime() - DELAI_DOUBLON_MS).toISOString();
    const { data: recents, error: errRecents } = await admin
      .from("transactions")
      .select("reference_operateur")
      .eq("user_id", profil.id)
      .eq("statut", "SUCCES")
      .in("methode", ["ORANGE_MONEY", "WAVE"])
      .gte("created_at", depuis)
      .limit(1);
    let memeReference: { reference_operateur: string | null }[] | null = null;
    let errReference: { message: string } | null = null;
    if (referenceSaisie) {
      const r = await admin
        .from("transactions")
        .select("reference_operateur")
        .eq("statut", "SUCCES")
        .eq("metadata->>reference_paiement", referenceSaisie)
        .limit(1);
      memeReference = r.data;
      errReference = r.error;
    }
    if (errRecents || errReference) {
      return NextResponse.json(
        { error: `Contrôle des doublons impossible (${(errRecents ?? errReference)?.message}) : rien n'a été modifié, réessayez.` },
        { status: 500 },
      );
    }
    const activeRecemment =
      !!profil.date_debut_abonnement && Date.parse(profil.date_debut_abonnement) >= Date.parse(depuis);
    const motif =
      memeReference && memeReference.length > 0
        ? `La référence ${referenceSaisie} est déjà enregistrée (${memeReference[0].reference_operateur}).`
        : recents && recents.length > 0
          ? `Un paiement Orange Money / Wave a déjà été enregistré pour ce compte il y a moins de 10 minutes (${recents[0].reference_operateur}).`
          : activeRecemment
            ? "Ce compte a déjà été activé il y a moins de 10 minutes."
            : null;
    if (motif) {
      return NextResponse.json(
        { doublon: true, error: `${motif} Doublon ? Si c'est bien un second paiement, confirmez-le.` },
        { status: 409 },
      );
    }
  }

  const planUuid = await resolvePlanUuid(plan);
  if (!planUuid) {
    return NextResponse.json(
      { error: `Formule « ${plan.nom} » introuvable dans la table plans : rien n'a été modifié.` },
      { status: 500 },
    );
  }

  // ── 1. Le profil : c'est lui qui ouvre l'accès ───────────────────────────
  const { error: errAcces } = await admin
    .from("profiles")
    .update({
      statut_abonnement:          palier,
      date_expiration_abonnement: periode.fin,
      date_debut_abonnement:      periode.debut,
      plan_id:                    plan.id,
    })
    .eq("id", profil.id);
  if (errAcces) {
    return NextResponse.json(
      { error: `Activation impossible : ${errAcces.message}. Rien n'a été modifié.` },
      { status: 500 },
    );
  }

  // ── 2. La ligne `abonnements` ────────────────────────────────────────────
  // Les anciennes lignes ACTIF passent EXPIRE AVANT l'insertion : si l'insertion
  // échouait, aucune ancienne ligne ne ferait expirer le profil trop tôt (le
  // cron expire-abonnements remet le profil à EXPIRE quand il ne reste plus de
  // ligne ACTIF ; sans ligne, l'accès reste réglé par la date du profil).
  const { error: errCloture } = await admin
    .from("abonnements")
    .update({ statut: "EXPIRE" })
    .eq("user_id", profil.id)
    .eq("statut", "ACTIF");
  const { data: abonnement, error: errAbo } = await admin
    .from("abonnements")
    .insert({
      user_id:             profil.id,
      plan_id:             planUuid,
      date_debut:          periode.debut.slice(0, 10),
      date_fin:            periode.fin.slice(0, 10),
      statut:              "ACTIF",
      auto_renouvellement: false,
    })
    .select("id")
    .single();

  // ── 3. Le paiement (Admin → Paiements, chiffre d'affaires) ───────────────
  const reference = referenceMobileMoney(operateur, maintenant, Math.random().toString(36).slice(2, 6));
  const { data: transaction, error: errTx } = await admin
    .from("transactions")
    .insert({
      user_id:             profil.id,
      abonnement_id:       abonnement?.id ?? null,
      montant_fcfa:        montant,
      devise:              "XOF",
      methode:             operateur,
      statut:              "SUCCES",
      reference_operateur: reference,
      date_transaction:    periode.debut,
      metadata: {
        source:              "admin_mobile_money",
        formule:             plan.id,
        pays,
        reference_paiement:  referenceSaisie || null,
        prolongation:        periode.prolongation,
        ancienne_expiration: etat.expiration,
        active_par:          user.id,
      },
    })
    .select("id")
    .single();
  if (abonnement?.id && transaction?.id) {
    await admin.from("abonnements").update({ transaction_id: transaction.id }).eq("id", abonnement.id);
  }

  // ── 4. L'e-mail de confirmation ──────────────────────────────────────────
  const envoi = envoyerEmail
    ? await envoyerConfirmationAbonnement(admin, {
        id:         profil.id,
        email:      profil.email,
        nomComplet: profil.nom_complet ?? null,
        palier,
        expiration: periode.fin,
      })
    : null;

  // Conséquence de chaque échec possible sur la ligne `abonnements`, dite à
  // l'admin : c'est elle que lisent le cron d'expiration et le rappel d'échéance.
  const etapeAbonnement = errAbo
    ? {
        ok: false,
        erreur: errCloture
          ? `${errAbo.message}. ⚠ L'ancienne ligne d'abonnement est restée active : le cron d'expiration pourrait couper l'accès à son ancienne date de fin. À corriger à la main.`
          : `${errAbo.message}. L'accès reste réglé par la date du profil, mais le rappel d'échéance ne partira pas.`,
      }
    : errCloture
      ? { ok: true, note: `ancienne ligne non clôturée (${errCloture.message}), sans effet sur l'accès` }
      : { ok: true };

  return NextResponse.json({
    success: true,
    ...resume,
    reference,
    etapes: {
      acces:      { ok: true },
      abonnement: etapeAbonnement,
      paiement:   errTx ? { ok: false, erreur: errTx.message } : { ok: true },
      email: !envoi
        ? { ok: true, nonDemande: true }
        : {
            ok: envoi.ok,
            erreur: envoi.erreur ?? null,
            journalise: envoi.journalise,
            erreurJournal: envoi.erreurJournal ?? null,
          },
    },
  });
}
