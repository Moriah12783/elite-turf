# Brouillons du Quinté+ à T-90, préparés par Argon — conception

*Rédigée le 16/10/2026. Parties 1, 2 et 3 validées par Steph le même jour.*

## 1. Contexte

- Depuis la PR #383 (07/10/2026), un robot prépare à T-90 deux brouillons non publiés du Quinté+ du jour (PRO et ELITE). Il calcule sa sélection sur les **cotes PMU** (« moteur + marché »). Son interrupteur `BROUILLONS_QUINTE_ENABLED` est fermé : il tourne en **essai à blanc** depuis le 08/10. L'e-mail d'essai contient la sélection, les textes prévus (#386) et le tableau des musiques et allocations (#385, #396).
- Steph a un moteur prédictif à lui, **Argon V4.5** (`https://argon.elite-turf.fr/`). Il veut que les brouillons viennent d'Argon : publier à la main lui prend trop de temps.
- Argon expose `GET https://argon.elite-turf.fr/api/races` (JSON, ~2,7 Mo, ~1,5 s, 151 courses relevées le 16/10). Pour chaque course, il **fige des éditions horaires** (`MATIN`, `T90`, `T30`, `T15`, `T5`) qui contiennent ses 8 chevaux (`argon8`) et un drapeau `sealed`.

## 2. Objectif

À T-90 du Quinté+ du jour, le site lit l'**édition T-90 scellée d'Argon** et prépare deux brouillons **non publiés**, PRO et ELITE, avec leurs textes. Il envoie ensuite un e-mail à Steph. Steph relit, ajuste et publie lui-même. **Rien n'est jamais publié automatiquement.**

## 3. Décisions de Steph (16/10/2026)

| Sujet | Décision |
|---|---|
| Approche | **A** : le site va chercher dans Argon ; Argon n'est pas modifié |
| Moment | **T-90**, comme le robot actuel |
| Courses | le **Quinté+ du jour** uniquement *(hypothèse énoncée, non contestée)* |
| Source | Argon **remplace** la sélection « marché » ; **pas de repli** sur le marché |
| Pro | **6 chevaux** = les 6 premiers d'Argon : **4 bases** (le 1er est le pivot) + **2 values** |
| Elite | **8 chevaux** = les mêmes **4 bases** ; parmi les 4 suivants, **3 values + 1 associé** ou **2 values + 2 associés**, selon l'avantage calculé par Argon |
| Couplé | **choisi par Steph**, jamais posé dans le brouillon ; le « couplé maître » d'Argon est indiqué dans l'e-mail pour information |
| Offre Elite | passe officiellement à **8 chevaux, base de 4, values et associés** ; toutes les mentions du site sont mises à jour |
| Sécurité | Argon est **fermé au public** (Cloudflare Access) ; Steph fait les réglages, guidé |

C'est un **retour sur la décision du 06/10/2026**, où le couplé et les associés avaient été retirés de l'offre Elite (6 chevaux, base de 3).

## 4. Hors périmètre

- Les courses autres que le Quinté+.
- Toute modification du code d'Argon (filtre par date, rôles explicites…).
- La mise à jour des brouillons aux éditions T-30, T-15 ou T-5.
- La publication automatique, sous quelque forme que ce soit.

## 5. Contrat de données lu chez Argon

La lecture est **stricte** : si un champ attendu manque ou n'a pas le bon type, c'est un échec (`argon_format_inattendu`), jamais un brouillon approximatif.

| Champ Argon | Usage |
|---|---|
| `status` (racine) | doit valoir `"ok"` |
| `races[].date` (`AAAA-MM-JJ`), `reunion`, `course_num`, `hippodrome` | identifier la course (§7) |
| `races[].editions_schedule.T90.argon8` | les 8 chevaux, dans l'ordre d'Argon |
| `races[].editions_schedule.T90.sealed` | `true` obligatoire |
| `races[].editions_schedule.T90.lock_gmt` | affiché dans l'e-mail |
| `races[].runners[]` : `num`, `name`, `edge_pts` | correspondance des noms ; répartition values / associés |
| `races[].confidence_stars` (1 à 5) | confiance proposée |
| `races[].is_no_bet` | « course déconseillée » |
| `races[].decision`, `sniper_num`, `sniper_odds` | indiqués dans l'e-mail, pour information |

⚠️ `edge_pts` n'est **pas figé** dans l'édition T-90 : c'est la valeur au moment de la lecture, c'est-à-dire juste après le scellement, puisque le robot passe toutes les 5 minutes.

Configuration :
- `ARGON_API_URL`, par défaut `https://argon.elite-turf.fr/api/races` ;
- `ARGON_ACCESS_CLIENT_ID` et `ARGON_ACCESS_CLIENT_SECRET`, secrets du Worker `elite-turf`. S'ils sont présents, ils sont envoyés dans les en-têtes `CF-Access-Client-Id` et `CF-Access-Client-Secret`. Ils sont posés par Steph et ne sont jamais transmis dans la conversation.

Délai de lecture : 15 s, la réponse fait ~2,7 Mo.

## 6. Déroulé d'un jour de course

Mécanique **inchangée** du robot actuel (`app/api/cron/brouillons-quinte`) :
- passages toutes les 5 minutes, fenêtre `FENETRE_MIN = 60` à `FENETRE_MAX = 95` minutes avant le départ ;
- dernier passage sous `DERNIER_PASSAGE_SOUS = 65` ;
- mêmes garde-fous : déjà publié, brouillons retirés, échec déjà signalé, déjà préparé avec relance de l'e-mail ;
- même interrupteur et même journal `email_sent_log`.

Ce qui change, dans l'ordre :

1. Lecture de la course du jour et des données PMU (partants, cotes, course, allocations) : **inchangé**.
2. Contrôle base ↔ PMU (`controlerDonneesPmu`) : **inchangé**.
3. **Nouveau** : lecture d'Argon, puis identification de la course (§7).
4. **Nouveau** : si `T90.sealed` n'est pas `true`, on passe sans rien faire (`skip: argon_pas_scelle`). Au dernier passage, c'est un échec `argon_non_scelle`.
5. **Nouveau** : correspondance des 8 chevaux d'Argon avec le PMU (§7).
6. **Nouveau** : composition PRO et ELITE (§8), à la place de `buildNotreSelection`.
7. Textes (§9), brouillons (§10) et e-mail (§11).

## 7. Identifier la course et contrôler les chevaux

**La course.** On cherche dans `races[]` la course qui a :
- `date` égale à `courses.date_course` ;
- `reunion` égal à `numero_reunion` ;
- `course_num` égal à `numero_course` ;
- un `hippodrome` qui correspond à celui de la base (noms normalisés, l'un contenant l'autre).

Aucune course trouvée : `argon_course_introuvable`. Plusieurs courses trouvées : `argon_format_inattendu`.

**Les chevaux.** Chaque numéro de `argon8` doit :
- exister chez le PMU ;
- avoir un `name` Argon qui désigne le même cheval que le nom PMU (`memeNom`).

Sinon : `argon_partants_incoherents`. On ne prépare jamais la sélection d'une autre course.

## 8. Composition

Notations :
- `P` = les numéros de `argon8` qui sont **partants** selon le PMU, dans l'ordre d'Argon (les non-partants sont retirés et les suivants remontent) ;
- `edge(n)` = `edge_pts` du cheval chez Argon (`null` est traité comme non positif).

**Bases** = `P[0..3]`, et le pivot est `P[0]`.

**PRO (6)**
- `P` doit compter au moins 6 chevaux, sinon `argon_partants_insuffisants`.
- Bases : `P[0..3]`. Values : `P[4]` et `P[5]`.

**ELITE (8, ou 7 si un non-partant)**
- `R` = `P[4..]`, au plus 4 chevaux.
- `nbPositifs` = nombre de chevaux de `R` dont `edge > 0`.
- `nbValues` = 3 si `nbPositifs ≥ 3`, sinon 2. Si `R` compte moins de chevaux que `nbValues`, tous ses chevaux sont values.
- Values = les `nbValues` chevaux de `R` au meilleur `edge`. À égalité, ou sans `edge`, on suit l'ordre d'Argon.
- Associés = les autres chevaux de `R`, dans l'ordre d'Argon.
- Si `P` compte moins de 8 chevaux, l'e-mail l'annonce en tête : « n°X non partant : Elite à 7 chevaux, ajoute un cheval avant de publier ».

**Exemple réel** (Vincennes R1C4, 16/10, T-90 scellée : `3-6-12-13-7-4-11-14`) :

| | Bases | Values | Associés |
|---|---|---|---|
| PRO | 3 (pivot) · 6 · 12 · 13 | 7 · 4 | — |
| ELITE | 3 (pivot) · 6 · 12 · 13 | 11 (+0,7) · 14 (0,0) | 7 (−0,8) · 4 (−0,9) |

Un seul avantage positif dans `R` : la règle donne donc 2 values.

**Confiance** (`confidence_stars`) : 5 ou 4 donne `ELEVE`, 3 donne `MOYEN`, 1 ou 2 donne `FAIBLE`. Une valeur absente ou hors de 1 à 5 donne `argon_format_inattendu`.

**Couplé** : jamais posé (`couple: true` absent de `selection_detail`).

## 9. Textes des brouillons

Le générateur actuel (`commentaires.ts`) est conservé : faits du PMU uniquement (discipline, distance, partants, recul, jockey ou driver, entraîneur, forme et fautes sur la musique, rang au marché à l'heure du relevé). Il est adapté à la nouvelle structure :

- **analyse courte** : inchangée (course + pivot) ;
- **analyse complète** :
  - « LA BASE » liste les 4 bases ;
  - « LES VALUES » liste les values avec la mention « Retenu en value » (et non plus « pour sa cote », puisque la règle suit l'avantage d'Argon) ;
  - nouvelle section « LES ASSOCIÉS », côté Elite seulement ;
  - « À SAVOIR » est inchangée.

**Interdits** : aucun pourcentage, probabilité, avantage ni étoile d'Argon dans un texte destiné aux abonnés, et les `MOTS_INTERDITS` existants restent interdits.

## 10. Brouillons en base

- Deux lignes `pronostics` : `niveau_acces` `PRO` et `ELITE`, `type_pari = QUINTE_PLUS`, `publie = false`, `date_publication = null`, `auteur_id = null`.
- **`source = 'ARGON'`**. Migration manuelle `supabase/migrations/20261016_pronostics_source_argon.sql`, qui ajoute `ARGON` à la contrainte `pronostics_source_check`. Elle est appliquée à la main et vérifiée par `conrelid`, comme le 07/10.
- `selection` = bases puis values puis associés. `selection_detail` : rôles `BASE` (le pivot avec `pivot: true`), `OUTSIDER` (value) et `ASSOCIE`.
- `SOURCE_BROUILLON` devient `ARGON`. Les garde-fous « déjà préparé » et « brouillons retirés » portent sur `ARGON`.

**Étanchéité.** Les filtres qui excluent aujourd'hui `AUTO-MARCHE` doivent exclure les **deux** sources :
- `ia-auto-publish` ;
- `ai-review/[id]/publish` ;
- `admin/pronostics/bulk`.

Le filtre devient `source.is.null,source.not.in.(AUTO-MARCHE,ARGON)`. Les lecteurs publics filtrent déjà `publie = true` (tâche 0 de la PR #383).

## 11. E-mails à Steph

Mêmes genres, même journal (`BROUILLONS_QUINTE_{jour}`, `_BLANC_`, `_ECHEC_`) :

- **« prêts »** :
  - objet « Brouillons du Quinté+ prêts — {prix} ({heure} GMT) », précédé de « ⚠️ Argon déconseille de jouer cette course » si `is_no_bet` ;
  - liens vers les 2 brouillons, sélection PRO et ELITE ;
  - bloc **« Avis d'Argon (pour information) »** : édition T-90 scellée à {lock_gmt}, 8 chevaux, étoiles, `decision` recopiée telle quelle (couplé maître, sniper) ;
  - alerte non-partant s'il y a lieu ;
  - tableau des musiques et allocations : le rang au marché reste calculé sur les cotes PMU, et la colonne « Retenu » reprend les rôles Argon (Base ⭐, Base, Value Pro, Value Elite, Value Pro + Elite, Associé).
- **« essai à blanc »** : même contenu sans liens, plus les textes prévus (#386).
- **« échec »** : raison lisible, puis « Publiez à la main comme d'habitude ».

Nouvelles raisons :

| Code | Texte |
|---|---|
| `argon_injoignable` | Argon ne répond pas |
| `argon_format_inattendu` | la réponse d'Argon n'a pas le format attendu |
| `argon_course_introuvable` | Argon ne connaît pas ce Quinté+ |
| `argon_non_scelle` | l'édition T-90 d'Argon n'a pas été scellée à temps |
| `argon_partants_incoherents` | les chevaux d'Argon ne correspondent pas aux partants du PMU |
| `argon_partants_insuffisants` | moins de 6 chevaux d'Argon sont partants |

## 12. Cas d'échec (récapitulatif)

| Situation | Effet |
|---|---|
| Argon injoignable ou format inattendu | on réessaie à chaque passage ; au dernier passage, aucun brouillon et e-mail d'échec |
| Course introuvable chez Argon | idem |
| T-90 pas encore scellée | on attend le passage suivant ; au dernier passage, échec `argon_non_scelle` |
| Chevaux incohérents avec le PMU | aucun brouillon et e-mail d'échec, dès le premier passage concerné |
| Un ou deux non-partants dans les 8 | brouillons créés (Pro 6, Elite 7 ou 6) et alerte dans l'e-mail |
| Moins de 6 partants dans les 8 | échec `argon_partants_insuffisants` |
| Forfait après la création des brouillons | non détecté : la relecture de Steph reste le dernier contrôle |
| Exception imprévue | comportement actuel : e-mail d'échec dans la fenêtre seulement |

## 13. Sécurité : fermer Argon

Constat du 16/10 : le cockpit et `/api/races` sont **lisibles sans connexion**, y compris l'édition « 📢 T-90 Abonnés ».

1. **Avant de fermer**, nous regardons en lecture seule, dans Cloudflare (statistiques de sécurité, filtre sur l'hôte `argon.elite-turf.fr`), qui appelle `/api/races`. Ainsi, on ne casse pas un autre outil (n8n, autre cron).
2. Steph crée une application **Cloudflare Access** sur `argon.elite-turf.fr`, avec une règle : connexion par son adresse e-mail.
3. Steph crée un **jeton de service** et l'autorise sur cette application. Il pose `ARGON_ACCESS_CLIENT_ID` et `ARGON_ACCESS_CLIENT_SECRET` comme secrets du Worker `elite-turf`.
4. L'essai à blanc suivant confirme que le robot lit toujours Argon.

**Steph fait tous les clics de sécurité** ; je le guide écran par écran et je vérifie le résultat.

## 14. Offre Elite (PR séparée)

Nouvelle formulation : « Le plan de jeu Elite : **8 chevaux**, avec **la base de 4** pour le champ réduit ou total, **les values et les associés** ». Le couplé n'est pas promis, puisque Steph décide course par course de l'indiquer.

À mettre à jour (relevé du 16/10) :
- `app/(public)/abonnements/page.tsx` ;
- `app/(public)/pronostics/page.tsx` ;
- `app/(public)/espace-membre/mon-roi/page.tsx` ;
- `components/home/FAQSection.tsx` ;
- `components/pronostics/PaywallBanner.tsx` ;
- `lib/abonnements/comparatif.ts` ;
- `lib/email/templates/welcome-series-j1.ts` ;
- `types/index.ts` (`PLAN_CONFIG.features` d'Elite ; **`description` inchangée**, elle part chez Stripe) ;
- l'aide de `components/admin/SelectionRolesEditor.tsx` et le commentaire de `lib/pronostics/selection-roles.ts` ;
- la méthode `.claude/skills/prono-elite-turf/SKILL.md` ;
- toute autre mention trouvée par une recherche « base de 3 » et « 6 chevaux » côté Elite.

**Quand** : fusionnée le jour où Steph ouvre l'interrupteur, ou plus tôt s'il publie déjà l'Elite à 8 chevaux à la main.

## 15. Tests

- **Écrits avant le code.**
- **Données** : une vraie réponse d'Argon du jour, réduite au Quinté+ et à une autre course, plus les vraies réponses PMU correspondantes.
- **Ce qui est couvert** :
  - lecture stricte : chaque champ manquant ou mal typé donne `argon_format_inattendu` ;
  - identification de la course : date, réunion, course, hippodrome ; aucune ou plusieurs correspondances ;
  - `sealed` false : on attend, puis échec au dernier passage ;
  - correspondance des noms avec le PMU ;
  - composition PRO et ELITE : exemple réel du §8, cas « 3 values », égalités d'avantage, `edge` absent, 1 et 2 non-partants, moins de 6 partants ;
  - confiance selon les étoiles, et étoiles invalides ;
  - textes : 4 bases, values et associés, aucun chiffre d'Argon, mots interdits ;
  - e-mails « prêts », « essai à blanc » et « échec », alertes non-partant et course déconseillée ;
  - étanchéité : un brouillon `ARGON` n'est jamais repris par l'auto-publication IA, la revue IA ou l'action groupée.
- **Contrôles** : `npx tsc --noEmit`, `npm run build`, `npx vitest run`.

## 16. Mise en service

1. **PR du robot Argon**, puis migration `ARGON` appliquée à la main et vérifiée.
2. **1 ou 2 jours d'essai à blanc** avec Argon (interrupteur fermé). Steph compare avec le cockpit d'Argon.
3. **Sécurité** (§13), guidée ; l'essai à blanc suivant confirme la lecture.
4. **PR de l'offre Elite** (§14).
5. **Ouverture** : `BROUILLONS_QUINTE_ENABLED = true` sur le Worker `elite-turf`, guidée.

## 17. Risques et points ouverts

- **Format d'Argon** : une évolution d'Argon peut casser la lecture. La lecture stricte transforme cela en e-mail d'échec, jamais en brouillon faux.
- **Avantage non figé** : la répartition values / associés utilise l'`edge_pts` lu juste après le scellement. Il peut différer légèrement de ce qu'affichait le cockpit à 16h45 pile.
- **Heure de départ** : Argon scelle T-90 selon sa propre heure de départ. Si elle diffère de la nôtre, l'attente du scellement absorbe l'écart, jusqu'au dernier passage.
- **Autres lecteurs d'Argon** : à vérifier avant la fermeture (§13, étape 1).
- **Code du robot « marché »** : `buildNotreSelection` reste utilisé par le site (« Sélection stats ») ; seules les fonctions de composition propres au robot (`decouperPro`, `choisirValuesElite`) deviennent inutiles et seront retirées dans la PR.
