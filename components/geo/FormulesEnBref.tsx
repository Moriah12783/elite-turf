/**
 * « Nos formules » en bref, en haut de chaque page pays (demande de Steph du
 * 06/10/2026). Des visiteurs demandaient sur WhatsApp les formules et les prix,
 * que ces pages ne montraient qu'à 30-37 % de leur hauteur — alors que les
 * visiteurs de Côte d'Ivoire, du Sénégal et du Burkina n'en lisaient en
 * moyenne que 16 à 23 % (Clarity, 04-06/10). Le détail reste plus bas.
 *
 * Mêmes montants que ce détail : PLAN_CONFIG + formatPrice (franc CFA à parité
 * fixe, arrondi à 500, marqué « ≈ » ; le montant facturé est en euros).
 * `data-shared` : exclu de la mesure de similarité entre pages pays.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLAN_CONFIG, type Plan } from "@/types";
import { formatPrice, type Country } from "@/lib/geo/countries";

const FORMULES = ["starter", "pro", "elite"];

/** @param devise devise d'affichage de la page ; EUR ou null → prix en euros seuls. */
export default function FormulesEnBref({ devise }: { devise: Country["devise"] | null }) {
  const locale = devise && devise !== "EUR" ? devise : null;
  const formules = FORMULES.map((id) => PLAN_CONFIG.find((p) => p.id === id)).filter((p): p is Plan => !!p);

  return (
    <section data-shared="true" aria-labelledby="formules-en-bref" className="mb-10 card-base p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 id="formules-en-bref" className="font-serif text-lg sm:text-xl font-bold text-text-primary">
          Nos formules
        </h2>
        <p className="text-text-muted text-xs">Paiement par carte bancaire, prépayées acceptées</p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {formules.map((p) => (
          <li
            key={p.id}
            className="flex sm:flex-col items-center sm:items-start justify-between gap-2 rounded-xl bg-bg-elevated border border-border px-3 py-2.5"
          >
            <span className="text-gold-primary text-xs font-bold uppercase tracking-wider">Pack {p.nom}</span>
            <span className="text-right sm:text-left">
              <span className="block font-serif text-lg font-bold text-text-primary">
                {locale ? `≈ ${formatPrice(p.prix_eur, locale)}` : `${p.prix_eur} €`}
              </span>
              <span className="block text-text-muted text-[11px]">
                {locale ? `${p.prix_eur} € facturés · ` : ""}{p.duree_jours} jours
              </span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/abonnements"
        className="mt-3 inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
      >
        Voir les formules <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
