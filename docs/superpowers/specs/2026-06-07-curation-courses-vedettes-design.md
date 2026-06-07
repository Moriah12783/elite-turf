# Spec — Curation des courses : exclure le lointain étranger + mettre en avant les vedettes

**Date :** 2026-06-07 · **Statut :** approuvé (verbal)

## Problème
Le programme PMU/Geny du jour ≈ 80 courses contient du **lointain étranger**
(Hong Kong, Chili, USA, Australie, Afrique du Sud…) qui n'intéresse pas
l'audience (France + un peu Europe + DOM-TOM/Outre-mer + Maghreb + Afrique
francophone). Le champ `hippodromes.pays` est inexploitable (tout = "France").

**Contrainte SEO (décisive)** : chaque course = une page indexable
(`app/sitemap.ts` liste ~1000 URLs via requête directe). On NE veut donc PAS
cacher le provincial français ni l'Europe → perte de long-tail. On exclut
**uniquement** le lointain étranger. (Première version « vedettes + >10 » trop
agressive : 6/80 un dimanche → abandonnée.)

## Objectif
- **Scraping + affichage** : garder tout (France, Europe, Maghreb, DOM-TOM),
  exclure **uniquement le lointain étranger**.
- **Mettre en avant** (tri en tête) les hippodromes **vedettes** et les courses
  à **pari national** — sans cacher le reste.

## Filtre central — `lib/turf/course-eligibility.ts`
- `isHippodromeLointain(nom)` : denylist `HIPPODROMES_LOINTAINS` (Asie / Golfe /
  Amériques / Océanie / Afrique du Sud). **Garde l'Europe** (UK, Irlande,
  Pays-Bas, Scandinavie) et le **Maghreb**.
- `isCourseEligible(c)` = `aPronostic || !isHippodromeLointain(nom)` → on n'exclut
  QUE le lointain.
- `isCourseVedette(c)` = `isHippodromePrioritaire(nom) || aPariNational` → MISE EN
  AVANT (tri), pas un filtre.
- `hasPariNational(paris_disponibles)` détecte Quinté+/Quarté+/Tiercé.
- Matching via `normHippodrome` (sans accents/casse/tirets).

## Application
1. **Scraping** — `scripts/geny-enrich-cli.ts` : filtre `isCourseEligible` (hors
   lointain) → ~50-70 courses → matrix **8 lots**.
2. **Affichage** — `isCourseEligible` (hors lointain) + **tri vedettes-en-tête**
   (`isCourseVedette` / `isHippodromePrioritaire`) :
   `app/(public)/courses/page.tsx`, `app/(public)/programme/[date]/page.tsx`,
   `components/home/CoursesSection.tsx`.

## Hors scope
- `app/sitemap.ts` : **inchangé** — toutes les courses restent indexées (SEO
  préservé). Un éventuel `noindex` du lointain serait une étape séparée.
- Badge visuel « vedette » : tri fait, badge = polish à ajouter ensuite.
- Correction du champ `pays`.

## Tests
`lib/turf/course-eligibility.test.ts` : `isHippodromeLointain` (exclut
HK/Chili/USA/Australie/Afrique du Sud, **garde** Irlande/UK/Pays-Bas/Maroc/FR),
`hasPariNational`, `isCourseEligible` (garde FR/Europe/Maghreb, exclut lointain,
garde-fou pronostic), `isCourseVedette`.
