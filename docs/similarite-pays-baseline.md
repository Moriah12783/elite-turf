# Similarité des pages pays — mesure de référence (avant toute modification)

- Date : 2026-10-01 16:36 UTC
- Source : `https://www.elite-turf.fr` (12 pages `/pronostics-pmu-*`)
- Méthode : texte du `<main>` sans `<script>`/`<style>` ni blocs `data-shared="true"` ; minuscules ; nom du pays, gentilé, capitale, opérateur (nom et site) et devise remplacés par des jetons ; similarité de Jaccard sur les 5-grammes de mots, pour chaque paire (`lib/seo/similarite.ts`).
- Seuils bloquants : similarité max par paire ≤ 0.25 ; au moins 60 % de 5-grammes propres par page ; titres, H1 et meta descriptions uniques.

**Verdict : ❌ 78 dépassement(s) de seuil.**

## Par page

| Page | HTTP | Mots | 5-grammes | Part propre | Similarité max | Page la plus proche | Nb de H1 |
|---|---|---|---|---|---|---|---|
| cote-d-ivoire | 200 | 574 | 503 | 25 % | 0.51 | cameroun | 2 |
| senegal | 200 | 580 | 528 | 21 % | 0.61 | mali | 2 |
| cameroun | 200 | 570 | 521 | 21 % | 0.63 | mali | 2 |
| maroc | 200 | 539 | 496 | 29 % | 0.49 | cote-d-ivoire | 2 |
| mali | 200 | 568 | 510 | 18 % | 0.63 | cameroun | 2 |
| burkina-faso | 200 | 562 | 499 | 13 % | 0.67 | togo | 2 |
| tchad | 200 | 508 | 475 | 15 % | 0.72 | gabon | 2 |
| gabon | 200 | 503 | 467 | 15 % | 0.72 | tchad | 2 |
| togo | 200 | 542 | 499 | 16 % | 0.67 | burkina-faso | 2 |
| congo-brazzaville | 200 | 516 | 473 | 15 % | 0.72 | gabon | 2 |
| madagascar | 200 | 518 | 482 | 20 % | 0.63 | congo-brazzaville | 2 |
| reunion | 200 | 518 | 455 | 22 % | 0.52 | togo | 2 |

## Les 15 paires les plus similaires

| Page A | Page B | Similarité |
|---|---|---|
| tchad | gabon | 0.72 |
| gabon | congo-brazzaville | 0.72 |
| tchad | congo-brazzaville | 0.70 |
| burkina-faso | togo | 0.67 |
| cameroun | mali | 0.63 |
| congo-brazzaville | madagascar | 0.63 |
| gabon | madagascar | 0.62 |
| tchad | madagascar | 0.62 |
| senegal | mali | 0.61 |
| senegal | cameroun | 0.61 |
| senegal | burkina-faso | 0.56 |
| senegal | togo | 0.56 |
| mali | burkina-faso | 0.56 |
| mali | togo | 0.55 |
| cameroun | togo | 0.54 |

## Titres, H1 et meta descriptions

| Page | Titre | H1 | Meta description |
|---|---|---|---|
| cote-d-ivoire | Pronostic PMU Côte d'Ivoire 🇨🇮 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Côte d'Ivoire 🇨🇮 | Pronostic PMU Côte d'Ivoire : Quinté+, Tiercé, Quarté+ analysés chaque jour par nos experts. Courses France + LONACI. Résultats publics, essai gratuit. |
| senegal | Pronostic PMU Sénégal 🇸🇳 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Sénégal 🇸🇳 | Pronostic PMU Sénégal : Quinté+, Tiercé, Quarté+ décryptés chaque matin par nos experts. Courses jouables via LONASE. Analyses transparentes, essai gratuit. |
| cameroun | Pronostic PMU Cameroun 🇨🇲 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Cameroun 🇨🇲 | Pronostic PMU Cameroun : analyses expertes Quinté+, Tiercé, Quarté+ chaque jour. Courses France pour les parieurs du PMUC. Résultats publics, essai gratuit. |
| maroc | Pronostic PMU Maroc 🇲🇦 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Maroc 🇲🇦 | Pronostic PMU Maroc : Quinté+, Tiercé et courses SOREC analysés chaque jour. Pour les turfistes du Royaume (MDJS). Méthode transparente, essai gratuit. |
| mali | Pronostic PMU Mali 🇲🇱 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Mali 🇲🇱 | Pronostic PMU Mali : Quinté+, Tiercé, Quarté+ analysés chaque jour par nos experts. Courses France pour les turfistes maliens. Résultats publics, essai gratuit. |
| burkina-faso | Pronostic PMU Burkina Faso 🇧🇫 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Burkina Faso 🇧🇫 | Pronostic PMU Burkina Faso : Quinté+, Tiercé, Quarté+ chaque matin. Courses France pour les parieurs PMU'B / LONAB. Analyses claires, essai gratuit. |
| tchad | Pronostic PMU Tchad 🇹🇩 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Tchad 🇹🇩 | Pronostic PMU Tchad : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les turfistes tchadiens. Méthode transparente, essai gratuit. |
| gabon | Pronostic PMU Gabon 🇬🇦 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Gabon 🇬🇦 | Pronostic PMU Gabon : Quinté+, Tiercé, Quarté+ décryptés chaque jour par nos experts. Courses France pour les parieurs gabonais. Essai gratuit. |
| togo | Pronostic PMU Togo 🇹🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Togo 🇹🇬 | Pronostic PMU Togo : Quinté+, Tiercé, Quarté+ chaque matin. Courses France pour les turfistes togolais (LONATO). Analyses transparentes, essai gratuit. |
| congo-brazzaville | Pronostic PMU Congo Brazzaville 🇨🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Congo Brazzaville 🇨🇬 | Pronostic PMU Congo : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les parieurs de Brazzaville et Pointe-Noire. Essai gratuit. |
| madagascar | Pronostic PMU Madagascar 🇲🇬 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU Madagascar 🇲🇬 | Pronostic PMU Madagascar : Quinté+, Tiercé, Quarté+ chaque jour par nos experts. Courses France pour les turfistes malgaches. Résultats publics, essai gratuit. |
| reunion | Pronostic PMU La Réunion 🇷🇪 — Quinté+, Tiercé \| Elite Turf | Pronostics PMU La Réunion 🇷🇪 | Pronostic PMU Réunion (974) : Quinté+, Tiercé, Quarté+ chaque matin. Jouez via le PMU France. Analyses expertes et transparentes, essai gratuit. |

## Dépassements de seuil

- Similarité tchad / gabon = 0.72 (> 0.25)
- Similarité gabon / congo-brazzaville = 0.72 (> 0.25)
- Similarité tchad / congo-brazzaville = 0.70 (> 0.25)
- Similarité burkina-faso / togo = 0.67 (> 0.25)
- Similarité cameroun / mali = 0.63 (> 0.25)
- Similarité congo-brazzaville / madagascar = 0.63 (> 0.25)
- Similarité gabon / madagascar = 0.62 (> 0.25)
- Similarité tchad / madagascar = 0.62 (> 0.25)
- Similarité senegal / mali = 0.61 (> 0.25)
- Similarité senegal / cameroun = 0.61 (> 0.25)
- Similarité senegal / burkina-faso = 0.56 (> 0.25)
- Similarité senegal / togo = 0.56 (> 0.25)
- Similarité mali / burkina-faso = 0.56 (> 0.25)
- Similarité mali / togo = 0.55 (> 0.25)
- Similarité cameroun / togo = 0.54 (> 0.25)
- Similarité cameroun / burkina-faso = 0.54 (> 0.25)
- Similarité burkina-faso / congo-brazzaville = 0.53 (> 0.25)
- Similarité togo / reunion = 0.52 (> 0.25)
- Similarité burkina-faso / gabon = 0.52 (> 0.25)
- Similarité gabon / togo = 0.52 (> 0.25)
- Similarité burkina-faso / tchad = 0.52 (> 0.25)
- Similarité tchad / togo = 0.52 (> 0.25)
- Similarité togo / congo-brazzaville = 0.51 (> 0.25)
- Similarité cote-d-ivoire / cameroun = 0.51 (> 0.25)
- Similarité cote-d-ivoire / senegal = 0.51 (> 0.25)
- Similarité burkina-faso / reunion = 0.51 (> 0.25)
- Similarité cote-d-ivoire / mali = 0.50 (> 0.25)
- Similarité cote-d-ivoire / maroc = 0.49 (> 0.25)
- Similarité togo / madagascar = 0.49 (> 0.25)
- Similarité maroc / burkina-faso = 0.49 (> 0.25)
- Similarité burkina-faso / madagascar = 0.49 (> 0.25)
- Similarité maroc / mali = 0.48 (> 0.25)
- Similarité cameroun / maroc = 0.48 (> 0.25)
- Similarité maroc / togo = 0.47 (> 0.25)
- Similarité senegal / maroc = 0.47 (> 0.25)
- Similarité cote-d-ivoire / burkina-faso = 0.47 (> 0.25)
- Similarité maroc / reunion = 0.46 (> 0.25)
- Similarité mali / tchad = 0.46 (> 0.25)
- Similarité mali / reunion = 0.46 (> 0.25)
- Similarité mali / gabon = 0.45 (> 0.25)
- Similarité cote-d-ivoire / togo = 0.45 (> 0.25)
- Similarité cote-d-ivoire / reunion = 0.45 (> 0.25)
- Similarité mali / congo-brazzaville = 0.45 (> 0.25)
- Similarité senegal / reunion = 0.44 (> 0.25)
- Similarité cameroun / reunion = 0.44 (> 0.25)
- Similarité senegal / gabon = 0.43 (> 0.25)
- Similarité cameroun / gabon = 0.43 (> 0.25)
- Similarité cameroun / congo-brazzaville = 0.43 (> 0.25)
- Similarité senegal / congo-brazzaville = 0.43 (> 0.25)
- Similarité cameroun / tchad = 0.43 (> 0.25)
- Similarité mali / madagascar = 0.43 (> 0.25)
- Similarité senegal / tchad = 0.42 (> 0.25)
- Similarité madagascar / reunion = 0.42 (> 0.25)
- Similarité cameroun / madagascar = 0.41 (> 0.25)
- Similarité congo-brazzaville / reunion = 0.40 (> 0.25)
- Similarité senegal / madagascar = 0.40 (> 0.25)
- Similarité tchad / reunion = 0.40 (> 0.25)
- Similarité gabon / reunion = 0.40 (> 0.25)
- Similarité maroc / gabon = 0.38 (> 0.25)
- Similarité maroc / tchad = 0.37 (> 0.25)
- Similarité maroc / congo-brazzaville = 0.37 (> 0.25)
- Similarité cote-d-ivoire / gabon = 0.35 (> 0.25)
- Similarité maroc / madagascar = 0.35 (> 0.25)
- Similarité cote-d-ivoire / congo-brazzaville = 0.35 (> 0.25)
- Similarité cote-d-ivoire / tchad = 0.35 (> 0.25)
- Similarité cote-d-ivoire / madagascar = 0.35 (> 0.25)
- cote-d-ivoire : 25 % de 5-grammes propres (< 60 %)
- senegal : 21 % de 5-grammes propres (< 60 %)
- cameroun : 21 % de 5-grammes propres (< 60 %)
- maroc : 29 % de 5-grammes propres (< 60 %)
- mali : 18 % de 5-grammes propres (< 60 %)
- burkina-faso : 13 % de 5-grammes propres (< 60 %)
- tchad : 15 % de 5-grammes propres (< 60 %)
- gabon : 15 % de 5-grammes propres (< 60 %)
- togo : 16 % de 5-grammes propres (< 60 %)
- congo-brazzaville : 15 % de 5-grammes propres (< 60 %)
- madagascar : 20 % de 5-grammes propres (< 60 %)
- reunion : 22 % de 5-grammes propres (< 60 %)
