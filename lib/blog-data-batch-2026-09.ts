// lib/blog-data-batch-2026-09.ts
// ELITE TURF — lot septembre 2026 : article du test pré-enregistré (Radar Elite Predictive).
//
// ⚠️ Règle « aucune donnée inventée » : tous les chiffres de cet article
// proviennent du journal scellé du projet Radar (Supabase kkwfaxxyzttooqhdglgk,
// clés project_memory.preregistration_v4_t252 et verdict_preregistration_v4_t252)
// et ont été répliqués en base le 07/09/2026 : t = 3,124 sur n = 12 342 partants
// jugés au 06/09 (edition = MATIN). Ne pas modifier un chiffre sans re-calcul.

import type { BlogArticle } from "./blog-data";

const TABLE_STYLE = "width:100%;border-collapse:collapse;margin:1rem 0 1.5rem;font-size:0.9rem;";
const TH_STYLE = "text-align:left;padding:0.55rem 0.75rem;border-bottom:1px solid rgba(201,168,76,0.35);color:#E8D5A3;font-weight:600;";
const TD_STYLE = "padding:0.5rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.06);color:#9090A0;";
const TD_NUM = TD_STYLE + "text-align:right;font-variant-numeric:tabular-nums;";

export const BLOG_ARTICLES_2026_09: BlogArticle[] = [
  {
    slug: "test-pre-enregistre-moteur-probabilites-resultat",
    titre: "Nous avons soumis notre moteur à un test qu'il ne pouvait pas tricher. Voici le résultat.",
    titreSeo: "Test pré-enregistré : notre moteur face au marché, le résultat",
    description:
      "Elite Turf a gelé à l'avance l'hypothèse, la métrique et les seuils d'un test hors échantillon de son moteur de probabilités, puis a laissé courir six jours de courses. Le signal a tenu. Voici les chiffres, la méthode — et ce que ce résultat ne dit pas.",
    categorie: "Innovation",
    date: "2026-09-07",
    readTime: 6,
    image: "/images/heroes/hero-performances.jpg",
    keywords: [
      "pré-enregistrement",
      "calibration probabilités",
      "score de Brier",
      "moteur de pronostics",
      "test hors échantillon",
      "transparence pronostics PMU",
      "Elite Turf méthodologie",
    ],
    popular: true,
    contenu: `
<p class="lead">Le 31 août au soir, nous avons écrit noir sur blanc, dans une base de données horodatée, une hypothèse sur notre moteur de probabilités, la formule exacte qui servirait à la juger, et les seuils au-dessous desquels nous admettrions qu'elle est fausse. Puis nous avons laissé courir six jours de courses sans rien toucher. Le 7 septembre au matin, le verdict est tombé, calculé par deux programmes indépendants qui ont trouvé le même résultat au millième.</p>

<p>Cet article raconte pourquoi nous avons fait cela, ce que nous avons trouvé, et — surtout — ce que ce résultat <strong>ne</strong> signifie <strong>pas</strong>.</p>

<h2>Le problème de tous les pronostiqueurs (nous compris)</h2>
<p>Quiconque publie des pronostics finit par afficher des chiffres flatteurs. Pas forcément par malhonnêteté : par sélection. On retient la bonne semaine, on oublie la mauvaise ; on change de méthode et on ne compte qu'à partir du changement ; on mesure vingt indicateurs et on montre celui qui est bon. En statistique, cela porte un nom — le <em>p-hacking</em> — et c'est la raison pour laquelle un « 73 % de réussite » sur une page de vente ne veut rigoureusement rien dire.</p>
<p>Il existe une parade, utilisée en recherche médicale depuis vingt ans : le <strong>pré-enregistrement</strong>. On dépose, <em>avant</em> de voir les données, l'hypothèse précise, la métrique qui la testera et le critère de succès. Ensuite, on ne peut plus rien changer. Si le résultat est mauvais, il est mauvais.</p>
<p>Nous avons appliqué cette discipline à notre propre moteur.</p>

<h2>Ce que nous avons gelé le 31 août</h2>
<p><strong>L'hypothèse.</strong> Depuis le 22 juillet, notre moteur (version « v4-labels ») produit chaque matin à 7h35, pour chaque partant des courses françaises, une probabilité de victoire. Ces probabilités sont <em>scellées</em> : inscrites dans un journal où rien ne peut être modifié ni effacé, et dont l'empreinte cryptographique est ancrée chaque mois. Sur les 10 153 partants jugés jusqu'au 30 août, ces probabilités étaient légèrement mieux calibrées que celles implicites dans les cotes du matin. L'hypothèse gelée : <em>ce gain de calibration est réel, pas un accident d'échantillon.</em></p>
<p><strong>La métrique.</strong> Le score de Brier — l'écart quadratique entre la probabilité annoncée et ce qui s'est réellement passé — comparé, partant par partant, à celui du marché. Un gain positif signifie que nos probabilités étaient plus proches de la réalité que les cotes. La formule exacte, jusqu'à la façon de traiter un partant sans cote, a été écrite dans le contrat.</p>
<p><strong>Les seuils.</strong> Un test statistique classique (le t de Student) mesurait à 2,52 la solidité du signal au 30 août. Nous avons fixé à l'avance : si, une fois les six jours de fenêtre ajoutés, le t cumulé reste au-dessus de 2,5, le signal est <em>maintenu</em> ; entre 2,0 et 2,5, zone grise, on prolonge d'une semaine ; sous 2,0, le signal est <em>affaibli</em> et nous le dirons.</p>
<p><strong>Les interdits.</strong> Aucune modification du moteur pendant la fenêtre. Aucune modification de la métrique. Aucun arrêt ni relance sélectif.</p>

<h2>Ce qui s'est passé du 1er au 6 septembre</h2>
<p>Six jours de courses, 1 908 partants jugés que le moteur n'avait jamais vus au moment du scellement.</p>
<div style="overflow-x:auto;">
<table style="${TABLE_STYLE}">
  <thead>
    <tr><th style="${TH_STYLE}">Jour</th><th style="${TH_STYLE}text-align:right;">Partants jugés</th><th style="${TH_STYLE}text-align:right;">Gain de calibration moyen</th></tr>
  </thead>
  <tbody>
    <tr><td style="${TD_STYLE}">Mardi 1er</td><td style="${TD_NUM}">265</td><td style="${TD_NUM}">+0,002874</td></tr>
    <tr><td style="${TD_STYLE}">Mercredi 2</td><td style="${TD_NUM}">233</td><td style="${TD_NUM}">+0,000498</td></tr>
    <tr><td style="${TD_STYLE}">Jeudi 3</td><td style="${TD_NUM}">395</td><td style="${TD_NUM}">+0,001441</td></tr>
    <tr><td style="${TD_STYLE}">Vendredi 4</td><td style="${TD_NUM}">382</td><td style="${TD_NUM}">+0,002425</td></tr>
    <tr><td style="${TD_STYLE}">Samedi 5</td><td style="${TD_NUM}">370</td><td style="${TD_NUM}">−0,000298</td></tr>
    <tr><td style="${TD_STYLE}">Dimanche 6</td><td style="${TD_NUM}">263</td><td style="${TD_NUM}">+0,001951</td></tr>
  </tbody>
</table>
</div>
<p>Cinq jours positifs sur six. Le gain moyen sur la fenêtre, +0,001455, est plus de deux fois supérieur à la moyenne historique — et la fenêtre prise <em>seule</em>, sans l'historique, atteint un t de 2,52 : les six jours sont significatifs par eux-mêmes.</p>
<p><strong>Le t cumulé, calculé sur l'ensemble des 12 342 partants jugés au 6 septembre, s'établit à 3,12.</strong> Critère 1 (gain hors échantillon positif) : rempli. Critère 2 (t ≥ 2,5) : rempli.</p>
<p><strong>Verdict : signal maintenu.</strong></p>
<p>Un détail qui compte pour nous : le verdict a été calculé le 7 septembre par notre auditeur automatique du matin, puis recalculé indépendamment par une seconde procédure. Les deux ont trouvé 3,124 sur 12 342 partants. Nous avons aussi refait la baseline avec la règle stricte du contrat (seuls les partants de courses effectivement arrivées comptent) : 2,518, contre 2,52 gelé. Rien ne bouge.</p>

<h2>Ce que ce résultat ne dit pas</h2>
<p>C'est la section la plus importante de cet article, et c'est celle qu'aucun vendeur de pronostics n'écrirait.</p>
<p><strong>Ce n'est pas une promesse de gains.</strong> Le test mesure la <em>calibration</em> de nos probabilités face au marché du matin. Il ne mesure pas ce qu'un parieur toucherait. Or le pari mutuel paie les cotes <em>finales</em>, pas celles du matin — et l'argent qui arrive dans les dernières minutes est, en moyenne, bien informé. Nous avons fait le calcul sur nos propres données d'avant-fenêtre, et nous le publions tel quel : les partants que notre moteur jugeait sous-cotés le matin affichaient un rendement théorique très positif aux cotes de 7h35… et un rendement <strong>négatif</strong> une fois payés aux cotes réelles du départ. L'écart entre les deux, c'est le prix de l'information tardive et de la marge du mutuel. Un gain de calibration réel mais modeste ne le comble pas.</p>
<p><strong>Ce n'est pas la fin du travail.</strong> C'est la fin d'une question — « le signal est-il réel ? » — et le début d'une autre, plus difficile : « existe-t-il un edge <em>réalisable</em> aux cotes réelles ? ». Cette question aura son propre pré-enregistrement, ses propres seuils, et sa propre fenêtre. Tant qu'elle n'aura pas reçu de réponse positive, rien de ce que nous publierons ne prétendra le contraire.</p>
<p><strong>Ce n'est pas généralisable aux réunions du soir.</strong> Le test porte sur les courses dont les cotes de référence sont disponibles à 7h35. Les réunions nocturnes, dont les cotes n'ouvrent qu'en fin d'après-midi, en étaient absentes. Depuis le 7 septembre, notre journal les scelle aussi, en fin d'après-midi avec les cotes du moment, dans une édition distincte (« soir ») qui sera évaluée séparément, après plusieurs semaines d'accumulation, avant d'être utilisée. Le résultat présenté ici ne concerne que l'édition du matin.</p>

<h2>Pourquoi nous publions cela</h2>
<p>Parce que c'est la seule façon d'être crus. Un moteur qui bat le marché en calibration, démontré par un test dont les règles ont été gelées avant les données, journalisé et ancré cryptographiquement, est une chose rare dans le pronostic hippique francophone. Nous préférons le dire avec ses limites que le survendre sans elles.</p>
<p>Nous publions chaque semaine un <strong>tableau de bord de calibration</strong> : probabilité annoncée contre réalité, par tranche de cotes, sur la semaine écoulée et depuis le début du journal. Il est consultable sur la page <a href="/calibration">Calibration du moteur</a>, et il montre les bonnes semaines comme les mauvaises. Et lorsque le prochain pré-enregistrement rendra son verdict — quel qu'il soit — vous le lirez ici.</p>
<p>Les courses restent un jeu de hasard ; jouer comporte des risques. Notre métier est de vous donner une information calibrée et une méthode transparente, jamais une certitude. Pour comprendre comment nous travaillons au quotidien, consultez notre <a href="/methodologie">méthodologie</a> et nos <a href="/performances">performances publiques, gagnantes comme perdantes</a>.</p>

<p><em>Méthodologie complète, formule de la métrique et journal de scellement disponibles sur demande. Le contrat de pré-enregistrement est horodaté au 31 août 2026, 21h20 UTC.</em></p>
    `,
  },
];
