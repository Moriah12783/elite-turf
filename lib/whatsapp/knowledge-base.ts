/**
 * lib/whatsapp/knowledge-base.ts
 *
 * Knowledge base statique d'Elite Turf, injectée dans le system prompt
 * de l'agent WhatsApp. Vise les questions les plus fréquentes des
 * prospects et abonnés.
 *
 * À mettre à jour quand :
 *   - Un pack d'abonnement change de prix
 *   - Une nouvelle méthode de paiement est ajoutée (Wave, etc.)
 *   - La méthodologie évolue
 *   - Une nouvelle FAQ remonte de tickets support récurrents
 *
 * Format Markdown pour que le LLM cite/structure proprement les réponses.
 */

export const KB_ABONNEMENTS = `
# Abonnements Elite Turf

| Pack | Prix mensuel | Inclus |
|------|-------|--------|
| **Starter** | 65€ / 42 637 XOF | Pronostic Quinté+ du jour, accès historique 7 jours |
| **Pro**     | 152€ / ~99 760 XOF | Tous les pronostics PMU, Tiercé/Quarté+/Quinté+, archives 30 jours, méthodologie complète |
| **Elite**   | 208€ / ~136 480 XOF | Tout Pro + alertes WhatsApp temps réel, accès anticipé 24h avant publication, support prioritaire |

Page d'abonnement : https://www.elite-turf.fr/abonnements
Espace membre (après paiement) : https://www.elite-turf.fr/espace-membre
`;

export const KB_PAIEMENTS = `
# Méthodes de paiement

Acceptées via Paystack :
- **Carte bancaire** (Visa, Mastercard) — pour la diaspora EU et internationale
- **Orange Money** — Côte d'Ivoire, Sénégal, Mali, Cameroun
- **MTN Mobile Money** — Côte d'Ivoire, Cameroun, Sénégal
- **Wave** — en cours d'intégration (à venir)

Le paiement est sécurisé et ponctuel : aucun débit récurrent automatique.
Le client doit re-souscrire chaque mois s'il souhaite continuer.

En cas de souci de paiement (carte refusée, abandon de la modale Paystack,
session expirée), il suffit de relancer la transaction depuis la page
/abonnements. Aucun frais n'est prélevé sur les tentatives échouées.
`;

export const KB_METHODOLOGIE = `
# Méthodologie Elite Turf

Notre approche est éditoriale et statistique, jamais émotionnelle :

1. **Sources fiables** : LONASE, France Galop, Geny.com, PMU.fr — données
   officielles de partants, cotes, musique, jockey.
2. **Analyse multi-critères** : forme récente du cheval (musique 5
   dernières courses), poids, corde, type de course, conditions terrain,
   historique jockey/entraîneur sur l'hippodrome.
3. **Sélections couvertes** : on propose 5-8 chevaux par course (jamais
   un seul "tuyau magique"). C'est un système de couverture, pas une
   prédiction unique.
4. **Indice de confiance 1-10** : indique la lisibilité de la course,
   PAS une garantie de gain. Une course à 8/10 reste un pari ; le turf
   comporte un aléa irréductible.
5. **Transparence totale** : tous nos pronostics passés, gagnants ET
   perdants, sont consultables sur /performances.

Nous sommes un service éditorial et de conseil, pas un opérateur de paris.
Elite Turf ne tient PAS de paris, ne reçoit aucun argent de mise, et ne
propose AUCUNE méthode garantie.
`;

export const KB_FAQ = `
# FAQ courante

**Q : "Comment voir le pronostic du jour ?"**
R : Si tu es abonné Pro ou Elite, va sur https://www.elite-turf.fr/pronostics
ou consulte ton /espace-membre. Le pronostic Quinté+ du jour est aussi visible
gratuitement (en partie) pour les non-abonnés.

**Q : "Je n'arrive pas à me connecter à mon compte."**
R : Lien de réinit : https://www.elite-turf.fr/reset-password — un email te
sera envoyé. Si pas reçu sous 5 min, vérifie tes spams ou réécris-moi avec
ton email d'inscription, j'escalade au support technique.

**Q : "Quel est votre taux de réussite ?"**
R : Tu peux consulter la statistique honnête sur /performances. Ce taux varie
selon les périodes ; sur les 90 derniers jours il est de l'ordre de 50-60%
sur Tiercé/Quarté+ (placement) et 15-25% sur Quinté+ ordre. Aucun service
turf n'a 100% — c'est mathématiquement impossible.

**Q : "Le pronostic n'a pas marché aujourd'hui, je veux un remboursement."**
R : Conformément à nos CGU, l'abonnement est forfaitaire (pas un contrat de
résultat). Aucun remboursement n'est proposé sur la base d'un pronostic
perdant — ce serait incohérent avec la nature aléatoire du turf. En revanche,
si l'accès au service a été techniquement défaillant (site indisponible, pas
de pronostic publié), on traite ça au cas par cas. Écris à
support@elite-turf.fr.

**Q : "Vous êtes basés où ?"**
R : Elite Turf est opéré depuis Abidjan (Côte d'Ivoire), avec une expertise
turf française et une couverture des courses PMU France + LONACI Afrique.

**Q : "Vous proposez des paris ?"**
R : Non. Elite Turf est un service d'analyse et de conseil. Nous ne tenons
aucun pari, nous ne recevons aucune mise. Pour parier, le client utilise un
opérateur agréé de son choix (PMU.fr, Geny, opérateurs LONASE locaux).
`;

export const KB_PROGRAMME_DU_JOUR = `
# Programme du jour

URL publique : https://www.elite-turf.fr/courses

Y figurent toutes les courses du jour avec hippodrome, heure, partants
détaillés (cheval, jockey, cote, musique, âge), distance, type de pari
PMU disponible (Quinté+, Tiercé, Couplé, etc.).

Sont également exposés gratuitement :
- /arrivees/<date> : arrivée officielle + tous les rapports PMU des courses
  passées
- /quinte-plus/<date> : focus du Quinté+ du jour avec historique
`;

/**
 * Knowledge base complète, à injecter dans le system prompt.
 * Stratégie : on injecte tout (~3000 tokens) ; le LLM choisit ce qui est
 * pertinent selon la question. Plus efficace qu'un retrieval RAG sur ce
 * volume — pas besoin d'embedding pour ~5kb de texte.
 */
export const FULL_KB = [
  KB_ABONNEMENTS,
  KB_PAIEMENTS,
  KB_METHODOLOGIE,
  KB_FAQ,
  KB_PROGRAMME_DU_JOUR,
].join("\n\n---\n\n");
