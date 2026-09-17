import Link from "next/link";
import { UserPlus } from "lucide-react";

/**
 * Invitation à créer un compte, affichée APRÈS la capture d'un guide.
 *
 * POURQUOI : mesuré le 25/08/2026, **107 prospects sur 163 (66 %) n'avaient
 * jamais créé de compte**. Aucun des trois écrans de confirmation (page
 * /guide-initie, popup de sortie, encart d'article) ne le proposait — le
 * visiteur repartait avec son PDF et rien d'autre. Un abonné malien est même
 * allé jusqu'à payer par Orange Money sans avoir de compte, donc sans que rien
 * puisse lui être livré.
 *
 * Le moment est le bon : il vient de donner son adresse et d'obtenir ce qu'il
 * voulait. C'est le point d'intérêt maximal du parcours.
 *
 * L'e-mail (et le prénom) sont passés à /inscription en query pour PRÉ-REMPLIR
 * le formulaire — le lui redemander serait une friction gratuite. Les champs
 * restent modifiables.
 *
 * PUR : composant serveur, aucun état, réutilisable dans un composant client.
 */
export default function CreerCompteCTA({
  email,
  nom,
  compact = false,
}: {
  email: string;
  nom?: string;
  /** Version resserrée pour le popup et les encarts d'article. */
  compact?: boolean;
}) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (nom) params.set("nom", nom);
  const href = `/inscription${params.toString() ? `?${params.toString()}` : ""}`;

  if (compact) {
    return (
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Créer mon compte gratuit
      </Link>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-border text-left">
      <p className="text-text-primary text-sm font-semibold mb-1">
        Pour aller plus loin — créez votre compte gratuit
      </p>
      <p className="text-text-secondary text-xs leading-relaxed mb-3">
        Il vous donne accès au pronostic gratuit du jour, aux résultats vérifiés
        course par course, et vous permet de vous abonner en un clic si vous le
        souhaitez plus tard. C&apos;est gratuit et sans engagement.
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Créer mon compte gratuit
      </Link>
      <p className="text-text-muted text-[11px] mt-2">
        Votre adresse est déjà pré-remplie.
      </p>
    </div>
  );
}
