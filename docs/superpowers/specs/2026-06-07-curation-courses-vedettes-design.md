# Spec — Épuration des courses : hippodromes vedettes (scraping + affichage)

**Date :** 2026-06-07 · **Statut :** approuvé (verbal, « oui pour ta reco »)

## Problème
Le programme du jour ≈ **80 courses**, dont beaucoup d'**étrangères** (Hong Kong, Chili, USA, Irlande…) et de **petits hippodromes locaux FR** qui intéressent peu les visiteurs et alourdissent le scraping de cotes (pages inutiles). Le champ `hippodromes.pays` est **inexploitable** : tout est étiqueté « France » (y compris Sha Tin, Happy Valley, Concepcion, Churchill Downs…).

## Objectif
Ne garder — au **scraping** ET à l'**affichage** — que les courses pertinentes :
**hippodrome FR vedette (+ Maroc) avec > 10 partants**, **plus** la grande course du
jour (pari national) où qu'elle soit, en **excluant** l'étranger (HK, Chili, USA…).

## Filtre central (source unique)
`lib/turf/course-eligibility.ts` — `isCourseEligible(c)` décide **dans l'ordre** :
1. **Pronostic publié** (`aPronostic`) → gardée (garde-fou : jamais zapper une course qu'on a pronostiquée).
2. **Hippodrome étranger** (denylist `HIPPODROMES_ETRANGERS` : Sha Tin, Happy Valley, Concepcion, Churchill Downs, Curragh…) → **exclue**.
3. **Pari national** (`aPariNational` : Quinté+/Quarté+/Tiercé) sur piste FR/Maroc → gardée (la grande course du jour, même hors liste vedette — couvre les jours provinciaux).
4. **Hippodrome vedette** (`HIPPODROMES_PRIORITAIRES`) **ET** nb_partants > 10 → gardée.

Sinon exclue. Matching via `normHippodrome` (minuscule, sans accents/espaces/tirets).
`hasPariNational(paris_disponibles)` détecte le pari national côté appelants.

**Liste FR** (validée, d'après les hippodromes qui portent des pronostics + grands hippodromes PMU) :
Vincennes, ParisLongchamp, Auteuil, Chantilly, Saint-Cloud, Deauville, Maisons-Laffitte,
Cagnes-sur-Mer, Compiègne, Vichy, Lyon-Parilly, Caen, Enghien, Marseille-Borély,
Marseille-Vivaux, Strasbourg, Nantes, Toulouse, Le Croisé-Laroche, Laval, Pau,
Bordeaux-Le Bouscat.
**Maroc** (anticipé — 0 course en base aujourd'hui) : Casablanca-Anfa, Rabat.

## Application
1. **Scraping** — `scripts/geny-enrich-cli.ts` : la requête courses joint `nb_partants` + `hippodrome.nom` + présence de pronostic publié, puis filtre via `isCourseEligible`. Effet : ~25-30 courses au lieu de 80 → **moins de jobs matrix / minutes GitHub**. Réduction matrix **12 → 6 lots**.
2. **Affichage** — appliquer le même `isCourseEligible` aux listes de courses :
   - `app/(public)/programme/[date]/page.tsx`
   - `app/(public)/courses/page.tsx`
   - `components/home/CoursesSection.tsx`
   (chacune charge déjà `nb_partants` + `hippodrome` ; on ajoute le flag `aPronostic` si pas déjà là.)

## Hors scope (séparé)
- Correction du champ `pays` en base (migration distincte).
- Cas cotes Sha Tin / HK.
- Pipeline IA de sélection (déjà curaté côté agent).

## Tests
`lib/turf/course-eligibility.test.ts` : normalisation (accents/casse/tirets), denylist étranger (Sha Tin, Happy Valley, Curragh…), `hasPariNational`, inclusion FR vedette, seuil 10/11, **filet pari-national** (Bollène + Quinté+ → gardée ; Sha Tin + Quinté+ → exclue), garde-fou `aPronostic`.
