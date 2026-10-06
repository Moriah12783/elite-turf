"use client";

/**
 * « Payer par Orange Money ou Wave » — page /abonnements, ancre #mobile-money.
 *
 * Le visiteur coche son pays puis clique sur sa formule : WhatsApp s'ouvre avec
 * le message pré-rempli (formule, montant, pays). Steph répond avec le numéro
 * et le montant ; aucun numéro de paiement n'est publié ici. Pays, montants et
 * message : lib/paiement/mobile-money.ts.
 */
import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Smartphone, ShieldCheck, UserPlus } from "lucide-react";
import { whatsappUrl, numeroWhatsappLisible } from "@/lib/constants/whatsapp";
import { trackEvent } from "@/lib/analytics/track";
import {
  PAYS_MOBILE_MONEY,
  OU_PAYER_MOBILE_MONEY_DEBUT,
  formulesMobileMoney,
  montantMobileMoney,
  messageMobileMoney,
  type CodePaysMobileMoney,
} from "@/lib/paiement/mobile-money";

interface Props {
  /** Pays pré-coché, quand on arrive d'une page pays (?pays=BF). */
  paysInitial: CodePaysMobileMoney | null;
  /** Visiteur connecté : inutile de lui demander de créer un compte. */
  connecte: boolean;
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-primary text-bg-primary text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

export default function PayerMobileMoney({ paysInitial, connecte }: Props) {
  const [pays, setPays] = useState<CodePaysMobileMoney | null>(paysInitial);
  const formules = formulesMobileMoney();

  return (
    <section
      id="mobile-money"
      aria-labelledby="mobile-money-titre"
      className="scroll-mt-24 card-base border-2 border-gold-primary/30 p-5 sm:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/40 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-gold-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-gold-primary text-xs font-bold uppercase tracking-wider mb-1">Nouveau</p>
          <h2 id="mobile-money-titre" className="font-serif text-2xl font-bold text-text-primary">
            Payer par Orange Money ou Wave
          </h2>
          <p className="text-text-secondary text-sm mt-1 leading-relaxed">
            {OU_PAYER_MOBILE_MONEY_DEBUT}, réglez votre abonnement en francs CFA depuis votre téléphone, avec notre
            équipe sur WhatsApp.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-3 py-1 rounded-full border border-[#FF7900]/40 bg-[#FF7900]/10 text-[#FF9A3D] text-xs font-semibold">
              Orange Money
            </span>
            <span className="px-3 py-1 rounded-full border border-[#1DC8FF]/40 bg-[#1DC8FF]/10 text-[#5CD6FF] text-xs font-semibold">
              Wave
            </span>
          </div>
        </div>
      </div>

      {!connecte && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-bg-elevated/60 p-4">
          <UserPlus className="w-5 h-5 text-gold-primary flex-shrink-0" aria-hidden="true" />
          <p className="flex-1 text-text-secondary text-sm leading-snug">
            <span className="text-text-primary font-semibold">Pas encore de compte ?</span> Créez-le gratuitement, avant
            ou après votre paiement : c&apos;est sur ce compte que votre accès sera activé.
          </p>
          <Link
            href="/inscription"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-gold-primary/40 text-gold-light hover:bg-gold-faint text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Créer mon compte
          </Link>
        </div>
      )}

      <fieldset className="mb-6">
        <legend className="flex items-center gap-2 text-text-primary text-sm font-semibold mb-2">
          <Num n={1} /> Votre pays
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PAYS_MOBILE_MONEY.map((p) => (
            <label key={p.code} className="cursor-pointer">
              <input
                type="radio"
                name="pays-mobile-money"
                value={p.code}
                checked={pays === p.code}
                onChange={() => setPays(p.code)}
                className="peer sr-only"
              />
              <span className="block rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-center text-sm text-text-secondary transition-colors hover:border-gold-primary/40 peer-checked:border-gold-primary peer-checked:bg-gold-faint peer-checked:text-gold-light peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-gold-primary/60">
                {p.nom}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-6">
        <p className="flex items-center gap-2 text-text-primary text-sm font-semibold mb-2">
          <Num n={2} /> Votre formule
        </p>
        <p className="text-text-muted text-xs mb-2 min-h-[1rem]" aria-live="polite">
          {!pays
            ? "Cochez d'abord votre pays."
            : connecte
              ? "WhatsApp s'ouvre avec votre message déjà écrit : ajoutez l'e-mail de votre compte, puis envoyez."
              : "WhatsApp s'ouvre avec votre message déjà écrit : ajoutez l'e-mail de votre compte si vous en avez un, puis envoyez."}
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {formules.map((plan) => (
            <li key={plan.id} className="flex flex-col rounded-xl border border-border bg-bg-elevated p-4">
              <span className="text-gold-primary text-xs font-bold uppercase tracking-wider">Pack {plan.nom}</span>
              <span className="font-serif text-2xl font-bold text-text-primary mt-1">{montantMobileMoney(plan)}</span>
              <span className="text-text-muted text-xs mb-4">pour {plan.duree_jours} jours</span>
              {pays ? (
                <a
                  href={whatsappUrl(messageMobileMoney(plan, pays))}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Payer le Pack ${plan.nom} par Orange Money ou Wave, sur WhatsApp`}
                  onClick={() => trackEvent("whatsapp_click", { source: "abonnements_mobile_money", plan_id: plan.id, pays })}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] px-4 py-2.5 text-sm font-bold text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Payer sur WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366]/30 px-4 py-2.5 text-sm font-bold text-white/60 cursor-not-allowed"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Payer sur WhatsApp
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <p className="flex gap-3 rounded-xl border border-border bg-bg-elevated/60 p-3 text-text-secondary text-sm leading-snug">
          <Num n={3} />
          Nous vous répondons sur WhatsApp avec le numéro Orange Money ou Wave et le montant à payer.
        </p>
        <p className="flex gap-3 rounded-xl border border-border bg-bg-elevated/60 p-3 text-text-secondary text-sm leading-snug">
          <Num n={4} />
          Vous payez depuis votre téléphone. Dès réception, nous vous envoyons un reçu sur WhatsApp, votre accès est
          activé et vous recevez l&apos;e-mail de confirmation de votre abonnement.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-status-win/20 bg-status-win/5 p-3 text-text-secondary text-xs sm:text-sm leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-status-win flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Le numéro de paiement vous est donné uniquement sur notre WhatsApp officiel, le{" "}
          <span className="text-text-primary font-semibold whitespace-nowrap">{numeroWhatsappLisible()}</span> : vérifiez que
          c&apos;est bien ce numéro. Le montant à payer est celui affiché ici. Gardez la confirmation de votre
          opérateur (SMS ou historique de l&apos;application) et le reçu que nous vous envoyons sur WhatsApp.
        </span>
      </p>

      <p className="mt-4 text-text-muted text-xs text-center">
        Ailleurs, ou si vous préférez : le paiement par carte bancaire reste disponible partout, avec un accès immédiat.
      </p>
    </section>
  );
}
