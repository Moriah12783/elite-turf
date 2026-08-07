# Le Consensus de la presse — comment ça marche

> Document d'explication du système « Consensus de la presse » d'Elite Turf :
> ce que c'est, d'où viennent les données, comment le calcul est fait, et
> comment ça s'affiche sur le site. Rédigé à partir du code réel (aucun chiffre
> inventé). Dernière mise à jour : 2026-07-13.

---

## 1. En une phrase

Le **Consensus de la presse** agrège l'avis de plusieurs pronostiqueurs de la
presse hippique sur la **course vedette du jour** (le plus souvent le Quinté+),
**compte** combien de sources citent chaque cheval, puis **trie** pour en tirer
une sélection lisible — **sans rien deviner ni promettre**. C'est un outil de
transparence : *« voilà ce que dit la presse »*, à ne pas confondre avec le
pronostic premium d'Elite Turf (qui, lui, est notre analyse propre).

Sur le site, cet agrégat s'affiche gratuitement dans un bloc appelé
**« Le Radar de la presse »**, en tête de la page d'accueil.

---

## 2. Le principe : compter, pas deviner

Le moteur est **100 % factuel et déterministe** : pour les mêmes données en
entrée, il produit toujours exactement la même sortie. Il ne fait que deux
choses : **compter** des citations et **trier**. Il n'y a aucune « boîte noire »,
aucune promesse de gain.

Pour chaque cheval de la course, on connaît :

- **`citations`** — combien de sources de presse le citent dans leur sélection ;
- **`bases`** — combien de sources en font leur *base* (leur cheval n°1) ;
- **`cote`** — sa cote probable (ex. 4.5), si connue.

Et pour la course, on connaît le **nombre total de sources agrégées**
(`nbSources`, ex. une trentaine).

---

## 3. D'où viennent les données (la chaîne)

```
Presse hippique  →  Pipeline de collecte  →  Table « consensus_drafts »
   (sources)          (dépôt quotidien)         (brouillon, relu par l'admin)
                                                        │
                                                        ▼
                                            Moteur de consensus (calcul)
                                                        │
                                        ┌───────────────┴───────────────┐
                                        ▼                               ▼
                               « Le Radar de la presse »        « Banc de mesure »
                               (affichage public, home)          (suivi admin, perf)
```

1. **Collecte.** Chaque jour, un pipeline dépose un **brouillon** par course dans
   la table `consensus_drafts`. Ce brouillon contient la **table de citations**
   (pour chaque cheval : numéro, nombre de citations, nombre de bases, cote,
   et un indicateur *non-partant* le cas échéant), plus le contexte de la course
   (hippodrome, réunion/course « R1C5 », type de pari, nombre de partants,
   nombre de sources).
2. **Relecture.** L'admin examine le brouillon puis le marque explicitement
   *relu* (`reviewed`) ou *rejeté* (`rejected`). Seuls les consensus `reviewed`
   ou `published` peuvent alimenter le Radar public : un brouillon brut
   (`draft`) ou rejeté n'est jamais affiché.
3. **Enrichissement des cotes.** Les cotes manquantes et les non-partants sont
   complétés depuis la table `partants` de la course liée (données du programme).
4. **Calcul.** Le moteur (voir §4) transforme cette table en sélection.

> ⚠️ Le commentaire premium (l'analyse rédigée) est stocké à part et **n'est
> jamais exposé** dans le Radar public — il reste réservé aux abonnés.

---

## 4. Le calcul, étape par étape

Le cœur est une fonction pure, `buildConsensus`
(`lib/consensus/engine.ts`). Voici ce qu'elle fait, dans l'ordre.

### 4.1. Un score par cheval

Pour chaque cheval, deux indicateurs sont calculés :

| Indicateur | Formule | Sens |
|---|---|---|
| **Taux de citation** | `citations / nbSources` | Part de la presse qui le cite (ex. 20/30 = 67 %) |
| **Score de consensus** | `citations + 0,5 × bases` | Citations, avec un **bonus** pour les chevaux mis en *base* |

Le bonus « base » (`+ 0,5 × bases`) donne un léger avantage aux chevaux que la
presse ne se contente pas de citer, mais place en tête.

### 4.2. Une catégorie par cheval (selon la cote)

| Cote | Catégorie |
|---|---|
| cote **< 5** | **FAVORI** |
| **5 ≤** cote **≤ 12** | **OUTSIDER** |
| cote **> 12** | **TOCARD** (gros rapport) |
| cote inconnue | traité comme OUTSIDER (neutre) |

### 4.3. Le tri

Tous les chevaux sont triés, dans cet ordre de priorité :
**score décroissant → citations → bases → cote croissante → numéro.**

### 4.4. La sélection : Base / Value / Coup

La sélection est construite en trois tiroirs :

- **BASE** = les chevaux au **meilleur score**… mais avec un **garde-fou
  important** : un cheval doit avoir **assez de citations** pour prétendre à une
  place de base. Ce seuil est **`max(3 ; 30 % des sources)`** — soit 10 citations
  pour 33 sources, 3 pour 7 sources. *(C'est la règle « anti-fausse-base »,
  ajoutée après un incident du 01/07 où un cheval peu cité s'était glissé en
  base.)*
- **VALUE** = les meilleurs **OUTSIDERS** (cote 5–12) pas déjà en base — la
  « valeur ajoutée », là où un rapport intéressant est possible.
- **COUP** = le meilleur **TOCARD** (gros rapport) pas déjà retenu — le pari
  d'audace, le « coup ».

Enfin, la sélection est **dédupliquée** et, si elle n'atteint pas la taille
visée, **complétée** par les chevaux suivants du consensus.

### 4.5. Deux formats de sélection

Le moteur produit deux tailles :

| Format | Composition | Total |
|---|---|---|
| **Elite** | 3 base · 2 value · 1 coup | **6 chevaux** |
| **Pro** | 4 base · 3 value · 1 coup | **8 chevaux** |

👉 **Le Radar public affiche la sélection *Pro* (8 chevaux)** — un teaser
volontairement généreux, distinct du pronostic premium.

### 4.6. Règle d'or : les non-partants

Un cheval **non-partant** (rayé) est **exclu de tous les tiroirs**, quelles que
soient ses citations. Une grille d'abonné ne doit jamais contenir un cheval qui
ne court pas.

---

## 5. Deux « favoris » à ne pas confondre

Le Radar met en avant **deux repères différents** :

| Repère | Définition | Ce qu'il dit |
|---|---|---|
| **Favori de la presse** | Le cheval **le plus cité** par les pronostiqueurs | Là où va **l'avis des experts** |
| **Favori du marché** | La **plus basse cote PMU réelle** | Là où va **l'argent** des parieurs |

- Le **favori du marché** n'utilise **que les vraies cotes PMU**
  (`cote_source = "pmu"`) — jamais le placeholder « 1,2 » des cotes LONACI, pour
  ne pas afficher de fausse info.
- **Quand presse = marché** (convergence), le signal est plus fort. **Quand ils
  divergent**, il peut y avoir de la *value* (la presse aime un cheval que le
  marché néglige, ou l'inverse). C'est justement là que se joue la lecture fine.

---

## 6. Comment ça s'affiche sur le site

**« Le Radar de la presse »** est un bloc **gratuit**, en **tête de la page
d'accueil** (juste après le bandeau d'intro). Il présente :

- les blocs colorés **Base / Value / Coup** de la course vedette ;
- le **favori de la presse** et le **favori du marché** côte à côte ;
- une **légende pédagogique** (presse = avis des experts · marché = l'argent) ;
- un **avertissement** clair (« la presse ≠ notre pronostic ») ;
- un **appel à l'action** vers les pronostics premium.

### Qui le voit ?

| Public | Radar de la presse |
|---|---|
| Visiteur non connecté | ✅ visible |
| Inscrit **gratuit** | ✅ visible |
| Abonné **payant** (Starter/Pro/Elite) | ❌ masqué |

Le Radar est **masqué aux abonnés payants** : eux ont accès au **pronostic
premium** (notre analyse propre, avec plan de jeu), qui est un produit distinct.
Le Radar sert donc de **teaser** — il montre la valeur du travail de consensus
sans cannibaliser l'offre payante.

> Si aucun consensus relu ou publié n'est disponible un jour (ou si sa sélection
> est vide), le Radar ne s'affiche pas : le site retombe sur un bloc de repli.
> **Jamais de chiffres inventés.**

---

## 7. Mesurer pour s'améliorer : le « Banc de mesure »

Dans l'espace admin, une section **« Consensus presse — sélection vs arrivée »**
compare, jour après jour, sur les courses **déjà courues** :

- la **sélection** du Radar,
- le **favori de la presse**,
- le **favori du marché**,

… face à l'**arrivée officielle**. Elle calcule des compteurs : vainqueur
couvert, quinté trouvé, taux de réussite du favori presse / marché (gagnant et
placé), et le taux de réussite en cas de **convergence** presse = marché.

**Objectif** : accumuler ~30 à 60 jours de données réelles pour **calibrer** les
réglages du moteur (tailles des tiroirs, seuils) sur du concret plutôt qu'à
l'estime. Les seuils du moteur sont **volontairement réglables** dans ce but.

---

## 8. Les garanties « anti-fabrication »

Le système est construit pour **ne jamais inventer** :

1. Le moteur ne fait que **compter et trier** des données fournies — aucune
   prédiction magique, aucune promesse de gain.
2. Le **favori du marché** n'utilise que les **vraies cotes PMU** ; sans cote
   fiable, il n'affiche rien.
3. Un cheval **non-partant** est exclu de toute sélection.
4. Un consensus encore **brouillon**, **rejeté** ou **absent** → aucun
   affichage (repli propre).
5. Le calcul est **déterministe** et **testé** (mêmes entrées → mêmes sorties),
   et le Radar public utilise **exactement le même moteur** que l'atelier admin :
   les chiffres montrés au public sont ceux que l'admin voit.

---

## 9. Où c'est dans le code (repères techniques)

| Rôle | Fichier |
|---|---|
| Moteur de calcul (pur, testé) | `lib/consensus/engine.ts` (`buildConsensus`) |
| Données du Radar (I/O + calcul favori marché) | `lib/consensus/radar-vedette.ts` |
| Affichage du bloc sur la home | `components/home/RadarPresseSection.tsx` |
| Mesure de performance (banc) | `lib/banc/consensus-metrics.ts` + `app/api/admin/banc-mesure/consensus/` |
| Source des données | table `consensus_drafts` (brouillon quotidien) |

---

### Résumé en trois points

1. **Ce que c'est** : un agrégat *factuel* de l'avis de la presse sur la course
   vedette (on compte les citations, on trie).
2. **Ce que ça donne** : une sélection Base / Value / Coup + le favori de la
   presse et le favori du marché, affichés gratuitement dans « Le Radar de la
   presse ».
3. **Ce que ce n'est pas** : ce n'est **pas** le pronostic premium d'Elite Turf,
   et ça ne promet **aucun** gain. La presse donne une photo ; notre pronostic,
   lui, est notre analyse.
