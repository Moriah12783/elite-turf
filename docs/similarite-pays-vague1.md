# Similarité des pages pays — vague 1 avant déploiement (serveur local, branche seo/pages-pays-vague1)

- Date : 2026-10-01 19:23 UTC
- Source : `http://127.0.0.1:3010` (12 pages `/pronostics-pmu-*`)
- Méthode : texte du `<main>` sans `<script>`/`<style>` ni blocs `data-shared="true"` ; minuscules ; nom du pays, gentilé, capitale, opérateur (nom et site) et devise remplacés par des jetons ; similarité de Jaccard sur les 5-grammes de mots, pour chaque paire (`lib/seo/similarite.ts`).
- Seuils bloquants : similarité max par paire ≤ 0.25 ; au moins 60 % de 5-grammes propres par page ; titres, H1 et meta descriptions uniques.

**Verdict : ❌ 45 dépassement(s) de seuil.**

## Par page

| Page | HTTP | Mots | 5-grammes | Part propre | Similarité max | Page la plus proche | Nb de H1 |
|---|---|---|---|---|---|---|---|
| cote-d-ivoire | 200 | 561 | 514 | 83 % | 0.08 | burkina-faso | 1 |
| senegal | 200 | 790 | 623 | 80 % | 0.12 | burkina-faso | 1 |
| cameroun | 200 | 599 | 546 | 21 % | 0.65 | mali | 1 |
| maroc | 200 | 564 | 517 | 26 % | 0.55 | mali | 1 |
| mali | 200 | 597 | 535 | 18 % | 0.65 | cameroun | 1 |
| burkina-faso | 200 | 539 | 480 | 76 % | 0.12 | senegal | 1 |
| tchad | 200 | 530 | 494 | 15 % | 0.73 | gabon | 1 |
| gabon | 200 | 525 | 486 | 15 % | 0.73 | tchad | 1 |
| togo | 200 | 564 | 518 | 19 % | 0.57 | mali | 1 |
| congo-brazzaville | 200 | 538 | 492 | 15 % | 0.72 | gabon | 1 |
| madagascar | 200 | 537 | 498 | 20 % | 0.60 | congo-brazzaville | 1 |
| reunion | 200 | 529 | 466 | 19 % | 0.53 | togo | 1 |

## Les 15 paires les plus similaires

| Page A | Page B | Similarité |
|---|---|---|
| tchad | gabon | 0.73 |
| gabon | congo-brazzaville | 0.72 |
| tchad | congo-brazzaville | 0.71 |
| cameroun | mali | 0.65 |
| congo-brazzaville | madagascar | 0.60 |
| tchad | madagascar | 0.60 |
| gabon | madagascar | 0.60 |
| mali | togo | 0.57 |
| cameroun | togo | 0.56 |
| maroc | mali | 0.55 |
| cameroun | maroc | 0.54 |
| gabon | togo | 0.54 |
| tchad | togo | 0.53 |
| togo | congo-brazzaville | 0.53 |
| togo | reunion | 0.53 |

## Titres, H1 et meta descriptions

| Page | Titre | H1 | Meta description |
|---|---|---|---|
| cote-d-ivoire | Pronostic LONACI du jour : Quinté+ PMU à l'heure d'Abidjan \| Elite Turf | Pronostic LONACI du jour | Quinté+ du jour : Prix Céréaliste à Auteuil, départ à 11 h 55 à Abidjan. Les Nationales de la LONACI et notre pronostic du jour. |
| senegal | PMU Sénégal : pronostic du jour à l'heure de Dakar \| Elite Turf | PMU Sénégal : pronostic du jour | Quinté+ du jour : Prix Céréaliste à Auteuil, départ à 11 h 55 à Dakar. Le PMU de la LONASE, ses paris ALR et PLR et notre pronostic. |
| cameroun | Pronostic PMU Cameroun 🇨🇲 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Cameroun 🇨🇲 | Pronostic PMU Cameroun : analyses expertes Quinté+, Tiercé, Quarté+ chaque jour. Courses France pour les parieurs du PMUC. Résultats publics, essai gratuit. |
| maroc | Pronostic PMU Maroc 🇲🇦 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Maroc 🇲🇦 | Pronostic PMU Maroc : Quinté+, Tiercé et courses SOREC analysés chaque jour. Pour les turfistes du Royaume (MDJS). Méthode transparente, essai gratuit. |
| mali | Pronostic PMU Mali 🇲🇱 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Mali 🇲🇱 | Pronostic PMU Mali : Quinté+, Tiercé, Quarté+ analysés chaque jour par nos experts. Courses France pour les turfistes maliens. Résultats publics, essai gratuit. |
| burkina-faso | Pronostic PMU Burkina Faso du jour : Quinté+ à l'heure de Ouagadougou \| Elite Turf | Pronostic PMU Burkina Faso du jour | Quinté+ du jour : Prix Céréaliste à Auteuil, départ à 11 h 55 à Ouagadougou. Le PMU'B de la LONAB, ses formules et notre pronostic. |
| tchad | Pronostic PMU Tchad 🇹🇩 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Tchad 🇹🇩 | Pronostic PMU Tchad : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les turfistes tchadiens. Méthode transparente, essai gratuit. |
| gabon | Pronostic PMU Gabon 🇬🇦 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Gabon 🇬🇦 | Pronostic PMU Gabon : Quinté+, Tiercé, Quarté+ décryptés chaque jour par nos experts. Courses France pour les parieurs gabonais. Essai gratuit. |
| togo | Pronostic PMU Togo 🇹🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Togo 🇹🇬 | Pronostic PMU Togo : Quinté+, Tiercé, Quarté+ chaque matin. Courses France pour les turfistes togolais (LONATO). Analyses transparentes, essai gratuit. |
| congo-brazzaville | Pronostic PMU Congo Brazzaville 🇨🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Congo Brazzaville 🇨🇬 | Pronostic PMU Congo : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les parieurs de Brazzaville et Pointe-Noire. Essai gratuit. |
| madagascar | Pronostic PMU Madagascar 🇲🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Madagascar 🇲🇬 | Pronostic PMU Madagascar : Quinté+, Tiercé, Quarté+ chaque jour par nos experts. Courses France pour les turfistes malgaches. Résultats publics, essai gratuit. |
| reunion | Pronostic PMU La Réunion 🇷🇪 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU La Réunion 🇷🇪 | Pronostic PMU Réunion (974) : Quinté+, Tiercé, Quarté+ chaque matin. Jouez via le PMU France. Analyses expertes et transparentes, essai gratuit. |

## Dépassements de seuil

- Similarité tchad / gabon = 0.73 (> 0.25)
- Similarité gabon / congo-brazzaville = 0.72 (> 0.25)
- Similarité tchad / congo-brazzaville = 0.71 (> 0.25)
- Similarité cameroun / mali = 0.65 (> 0.25)
- Similarité congo-brazzaville / madagascar = 0.60 (> 0.25)
- Similarité tchad / madagascar = 0.60 (> 0.25)
- Similarité gabon / madagascar = 0.60 (> 0.25)
- Similarité mali / togo = 0.57 (> 0.25)
- Similarité cameroun / togo = 0.56 (> 0.25)
- Similarité maroc / mali = 0.55 (> 0.25)
- Similarité cameroun / maroc = 0.54 (> 0.25)
- Similarité gabon / togo = 0.54 (> 0.25)
- Similarité tchad / togo = 0.53 (> 0.25)
- Similarité togo / congo-brazzaville = 0.53 (> 0.25)
- Similarité togo / reunion = 0.53 (> 0.25)
- Similarité maroc / togo = 0.51 (> 0.25)
- Similarité maroc / reunion = 0.48 (> 0.25)
- Similarité togo / madagascar = 0.48 (> 0.25)
- Similarité mali / tchad = 0.48 (> 0.25)
- Similarité mali / gabon = 0.47 (> 0.25)
- Similarité mali / congo-brazzaville = 0.47 (> 0.25)
- Similarité mali / reunion = 0.46 (> 0.25)
- Similarité madagascar / reunion = 0.45 (> 0.25)
- Similarité cameroun / gabon = 0.45 (> 0.25)
- Similarité cameroun / reunion = 0.45 (> 0.25)
- Similarité cameroun / congo-brazzaville = 0.45 (> 0.25)
- Similarité cameroun / tchad = 0.45 (> 0.25)
- Similarité mali / madagascar = 0.42 (> 0.25)
- Similarité congo-brazzaville / reunion = 0.42 (> 0.25)
- Similarité tchad / reunion = 0.41 (> 0.25)
- Similarité maroc / gabon = 0.41 (> 0.25)
- Similarité gabon / reunion = 0.41 (> 0.25)
- Similarité maroc / tchad = 0.41 (> 0.25)
- Similarité maroc / congo-brazzaville = 0.41 (> 0.25)
- Similarité cameroun / madagascar = 0.41 (> 0.25)
- Similarité maroc / madagascar = 0.36 (> 0.25)
- cameroun : 21 % de 5-grammes propres (< 60 %)
- maroc : 26 % de 5-grammes propres (< 60 %)
- mali : 18 % de 5-grammes propres (< 60 %)
- tchad : 15 % de 5-grammes propres (< 60 %)
- gabon : 15 % de 5-grammes propres (< 60 %)
- togo : 19 % de 5-grammes propres (< 60 %)
- congo-brazzaville : 15 % de 5-grammes propres (< 60 %)
- madagascar : 20 % de 5-grammes propres (< 60 %)
- reunion : 19 % de 5-grammes propres (< 60 %)
