# LONACI — Enrichissement & dédoublonnage des courses

**Date** : 2026-05-31
**Statut** : design validé (brainstorming)
**Branche** : `feat/lonaci-enrichment-dedup`
**Lié** : PR #135 (fix cron lonaci-sync), `lib/sync/lonaci.ts`, `lib/sync/geny-programme.ts`

## 1. Contexte & problème

LONACI (`runLonaciSync`) et Geny (`runGenyProgrammeSync`) écrivent tous deux dans la table `courses`, dédupliquée par la contrainte unique `(hippodrome_id, date_course, numero_reunion, numero_course)`.

Or `hippodrome_id` est résolu par **match exact du nom** contre `hippodromes.nom`, avec **3 normalisations différentes** selon la source :

| Source | Fonction | Format produit |
|---|---|---|
| Geny | `cleanHippodromeName` | garde les accents (`Châteaubriant`) |
| LONACI | `normalizeHippoName` | sans accents, chaque mot capitalisé (`La Teste De Buch`) |
| PMU | `normalizeHipName` | strip accents + MAJUSCULES |

Trois formats ≠ → noms variants → hippodromes séparés → **courses dupliquées** pour la même épreuve.

**Doublons déjà constatés en base** (avant même LONACI) :
- `La Teste De Buch` vs `La Teste-de-Buch`
- `Le Lion D'angers` vs `Le Lion-d&#039;Angers`

`runLonaciSync` (réparé en PR #135) n'a **jamais** tourné avec succès jusqu'ici ; dès son 1er run réussi, il créerait massivement des doublons (14/138 hippodromes France ont des accents → mismatch garanti avec la version LONACI sans accents).

**Décision produit** : on **ne publie pas** les courses exclusivement africaines (Sénégal/Côte d'Ivoire/Tunisie) absentes de Geny. Elite Turf se concentre sur les courses France/Maroc relayées vers l'Afrique.

## 2. Objectif

`runLonaciSync` devient **enrichisseur, jamais créateur** : il marque les courses Geny **existantes** comme jouables-Afrique + Nationale, de façon **autoritaire** (LONACI = source de vérité, vs l'heuristique actuelle dérivée des types de paris Geny). **Zéro doublon par construction** (aucun INSERT).

## 3. Décisions validées

- **Approche A** — enrichissement autoritaire (peut confirmer ET corriger l'heuristique).
- **Correction des faux positifs : autoritaire avec garde-fou** — on ne marque `jouable_afrique = false` que si le programme LONACI du jour semble complet ; sinon on laisse `NULL` (heuristique).
- **Pas de publication** des courses africaines exclusives → LONACI ne crée aucune course.

## 4. Modèle de données

Deux colonnes ajoutées à `courses` (migration rétro-compatible, nullable) :

| Colonne | Type | Sens |
|---|---|---|
| `jouable_afrique` | `boolean NULL` | `NULL` = pas encore évalué par LONACI → fallback heuristique. `true`/`false` = verdict autoritaire LONACI. |
| `nationale` | `smallint NULL` | Niveau Nationale LONACI (1/2/3), sinon `NULL`. |

**Lecture du badge** :
```
jouable        = course.jouable_afrique ?? isJouableAfrique(course.paris_disponibles)
nationaleLabel = course.nationale ? `Nationale ${n} — …` : getNationaleLabel(course.paris_disponibles)
```
→ Les courses non encore enrichies (`NULL`) gardent le comportement actuel : **aucune régression**.

## 5. Composants

1. **`lib/sync/hippodrome-canonical.ts`** (nouveau, pur, testé) — `canonicalHippodrome(name)` : décode entités HTML → minuscules → retire accents (NFD) → ne garde que `[a-z0-9]`.
   `SAINT-CLOUD` = `Saint-Cloud` → `saintcloud` ; `La Teste De Buch` = `La Teste-de-Buch` → `latestedebuch` ; `Chateaubriant` = `Châteaubriant` → `chateaubriant`.

2. **`lib/sync/lonaci.ts`** (`runLonaciSync` refactoré, enrich-only) :
   - fetch + `normalizeLonaciReunions` + filtre **France/Maroc** (drop le reste).
   - map `canonique → hippodrome_id` des hippodromes **existants** (aucun INSERT).
   - charge les courses Geny de la date ; rapproche par `(hippodrome_id, date, numero_reunion, numero_course)`.
   - verdicts : rapprochée → `jouable_afrique=true`, `nationale=int_National_Number` ; garde-fou (programme complet) → courses Geny France/Maroc du jour **non** rapprochées → `jouable_afrique=false`.
   - **bulk UPDATE uniquement** ; option `dryRun` ; renvoie un **rapport de matching**.

3. **`lib/pmu-api.ts`** — helper `resolveAfrique(course) → { jouable, nationaleLabel }` (autoritaire sinon heuristique). `isJouableAfrique`/`getNationaleLabel` conservés (fallback).

4. **UI** — `CourseCard.tsx`, `CoursesSection.tsx`, `PronosticsSection.tsx` : utilisent `resolveAfrique` et sélectionnent les 2 nouvelles colonnes dans leurs requêtes.

5. **Migration** — ajout des 2 colonnes (nullable, défaut `NULL`).

6. **Tests (vitest minimal)** — matcher canonique (cas du tableau + entités/accents/tirets/connecteurs) ; logique de verdict (fixtures LONACI+Geny → jouable/nationale/corrections + garde-fou partiel).

## 6. Clé de rapprochement & rollout sécurisé

- **Clé primaire** : `(hippodrome_id, date, numero_reunion, numero_course)`.
- **Risque** : LONACI pourrait renuméroter Réunion/Course (jamais observé — il n'a jamais tourné). **Mitigation** : run à blanc d'abord.
- **Clé de repli** si taux de match bas : `(hippodrome_id, date, heure_depart ± tolérance)`.

**Rollout** :
1. Migration (2 colonnes).
2. Déploiement du code enrich-only en `dryRun` forcé.
3. Run à blanc → inspecter le rapport (`cron_logs.details`) : taux de matched/unmatched + exemples.
4. Taux bon → activer les écritures (désactiver `dryRun`). Taux mauvais → clé de repli, re-tester.
5. Vérifier `cron_logs` (success) + badges en prod.

## 7. Garde-fou « programme complet »

On n'applique la correction `jouable_afrique=false` que si : LONACI a renvoyé **≥ 3 réunions** ET a rapproché **≥ 50 %** des réunions France/Maroc Geny du jour. Sinon (donnée LONACI partielle) → on laisse `NULL`.

## 8. Gestion d'erreurs

- Fetch LONACI KO → throw → `cron_logs` failure (inchangé).
- Calcul de tous les verdicts puis **un** bulk UPDATE ; **idempotent** (re-run = mêmes colonnes).
- Hippodrome/course non rapproché → skip + compté ; **jamais d'INSERT**.
- `dryRun` → n'écrit rien.

## 9. Périmètre / hors-scope

- **Ne touche pas** au pipeline IA : sa validation Afrique passe par `course_source_evidence` (crawler `source-crawlers/lonaci.ts`), indépendant du badge public.
- **Nettoyage des doublons hippodromes Geny déjà présents** (La Teste, Le Lion d'Angers…) = **follow-up séparé** (côté Geny, opération de fusion délicate).

## 10. Ordonnancement

`lonaci-sync` doit tourner **après** `pmu-sync`/Geny (pour que les courses existent à enrichir). Déjà le cas : lonaci `41 7`/`37 11` UTC > pmu-sync `10 5` UTC.
