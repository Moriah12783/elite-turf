/**
 * Blocs partagés des pages pays migrées (brief §3, blocs 5 et 8) : paiement,
 * formules, appel à l'action, autres pays. Réduits au minimum et marqués
 * `data-shared="true"` : la mesure de similarité les exclut.
 *
 * Montants en devise native (franc CFA : parité fixe 655,957) marqués « ≈ »,
 * avec le montant réellement facturé en euros (paiement par carte).
 */
import Link from "next/link";
import { ArrowRight, Shield, AlertTriangle } from "lucide-react";
import { COUNTRIES, formatPrice, type Country } from "@/lib/geo/countries";
import type { FichePays } from "@/lib/geo/fiches/types";
import { PLAN_CONFIG } from "@/types";
import { STARTER_OFFRE_LABEL, PRO_OFFRE_LABEL, ELITE_OFFRE_LABEL } from "@/lib/pricing";

const LIBELLES: Record<string, string> = { starter: STARTER_OFFRE_LABEL, pro: PRO_OFFRE_LABEL, elite: ELITE_OFFRE_LABEL };

export default function BlocsPartages({ country, fiche, depuis }: { country: Country; fiche: FichePays; depuis: string }) {
  const cfa = fiche.deviseNative === "XOF" || fiche.deviseNative === "XAF" ? fiche.deviseNative : null;
  const formules = PLAN_CONFIG.filter((p) => LIBELLES[p.id]);

  return (
    <>
      <section data-shared="true" className="mb-12" aria-labelledby="payer-depuis">
        <h2 id="payer-depuis" className="font-serif text-2xl font-bold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-6 h-6 text-gold-primary" aria-hidden="true" />
          Payer {depuis}
        </h2>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          Paiement par carte bancaire (Visa / Mastercard) : toutes les cartes de tous les pays sont acceptées,
          y compris les cartes prépayées. Les prix sont facturés en euros
          {cfa ? ", avec l'équivalent indicatif en francs CFA" : ""}. Le paiement Mobile Money n&apos;est pas
          encore disponible.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {formules.map((p) => (
            <div key={p.id} className="card-base p-5">
              <p className="text-gold-primary text-xs font-bold uppercase tracking-wider mb-2">Pack {p.nom}</p>
              <p className="font-serif text-2xl font-bold text-text-primary">
                {cfa ? `≈ ${formatPrice(p.prix_eur, cfa)}` : `${p.prix_eur} €`}
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                {cfa ? `${p.prix_eur} € facturés · ` : ""}pour {p.duree_jours} jours
              </p>
              <p className="text-text-secondary text-sm leading-relaxed mt-3">{LIBELLES[p.id]}</p>
            </div>
          ))}
        </div>
      </section>

      <section data-shared="true" className="mb-12 card-base p-6 sm:p-8 text-center" aria-labelledby="rejoindre">
        <h2 id="rejoindre" className="font-serif text-2xl font-bold text-text-primary mb-4">Rejoindre Elite Turf</h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/abonnements" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all">
            Voir les formules <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link href="/methodologie" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all">
            Notre méthode
          </Link>
          <Link href="/performances" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all">
            Nos résultats publiés
          </Link>
        </div>
        <p className="mt-6 text-text-muted text-xs leading-relaxed flex items-start gap-2 text-left">
          <AlertTriangle className="w-4 h-4 text-status-partial flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <span className="text-text-secondary font-semibold">Jeu responsable.</span> Les pronostics publiés sur Elite Turf
            sont fournis à titre informatif et ne constituent pas une garantie de gain. Le jeu peut être dangereux : jouez
            de manière responsable et ne misez que ce que vous pouvez vous permettre de perdre.
          </span>
        </p>
      </section>

      <section data-shared="true" className="mb-12" aria-labelledby="autres-pays">
        <h2 id="autres-pays" className="font-serif text-xl font-bold text-text-primary mb-4">Pronostics PMU dans d&apos;autres pays</h2>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.filter((c) => c.code !== country.code).map((c) => (
            <Link
              key={c.code}
              href={`/pronostics-pmu-${c.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border rounded-full text-text-secondary hover:text-gold-light hover:border-gold-primary/40 text-sm transition-colors"
            >
              <span aria-hidden="true">{c.drapeau}</span> {c.nom}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
