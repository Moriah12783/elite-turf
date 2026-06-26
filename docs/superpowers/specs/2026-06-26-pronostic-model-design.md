# Spec — Refonte du modèle de pronostic Elite Turf (Sélection stats / Pro / Elite)

- **Date** : 2026-06-26
- **Auteur** : Stéphane (PO) + Claude
- **Statut** : Design validé (sections 1-3) — en attente relecture spec
- **Déclencheur** : 1er vrai abonné (Nabassom, Elite). Le modèle actuel ne différencie Pro et Elite que par la **taille** de sélection (`SELECTION_SIZES = { PRO: 8, ELITE: 6 }`) → Elite = « Pro réduit ». De plus le pronostic « du jour » ressemble à la Sélection stats. Avec un client payant, il faut une **différence de nature** entre les 3 niveaux, et tenir compte de l'audience **burkinabè (LONAB/PMUB)**, pas seulement LONACI (CI).

---

## 1. Objectifs / Non-objectifs

**Objectifs**
1. Donner à **Sélection stats / Pro / Elite** une différence **fondamentale de nature et de structure** (pas un simple nombre de chevaux).
2. Aligner la **génération** (pipeline IA `lib/ai-pronostics/` + affinage humain) sur ce modèle.
3. Rendre le **choix des courses conscient de l'audience** (Burkina via PMUB/LONAB), pas centré LONACI.
4. Orienter les pronostics vers le **gain** de façon **honnête** (value + structure de jeu, **aucune promesse**).

**Non-objectifs**
- Aucune promesse de gain, aucun « coup sûr / garanti » (ligne anti-fabrication maintenue).
- Pas de montants en € dans les conseils de mise (jeu responsable) → **unités** uniquement.
- Pas de refonte des paiements/abonnements (le gating `canAccess` reste : escalier GRATUIT < PRO < ELITE).
- Phase 1 ne dépend PAS d'un nouveau scraper LONAB (voir §4).

---

## 2. Le modèle : anatomie des 3 niveaux (échelle de **jouabilité**)

### 2.1 Sélection stats — *« Comprendre la course »* (gratuit)
- **Portée** : toutes les courses du programme.
- **Contenu** : top ~8 par **lecture statistique** (favoris marché, drivers/entraîneurs reconnus, forme/musique). Réutilise l'existant (`buildNotreSelection` / `lib/turf`).
- **Interdits** : aucune hiérarchie de jeu, aucun conseil de mise, aucun ticket. C'est un **outil de lecture**, repositionné comme tel dans l'UI.

### 2.2 Pro — *« Le pronostic jouable »*
- **Portée** : les grandes courses jouables en Afrique (Quinté+/Quarté+/Tiercé), ~3-5/jour.
- **Structure en RÔLES** (pas une liste plate) : **Base** (2 chevaux sûrs) · **Chances** (3-4 réguliers) · **Outsiders/value** (1-2). Total ~8.
- **Ticket jouable** : ordre conseillé + combinaisons de base (Tiercé/Quarté+).
- **Analyse** rédigée du *pourquoi* des chevaux-clés.

### 2.3 Elite — *« Le plan de jeu »* (le coup du jour)
- **Portée** : le(s) **coup(s) du jour** (1-2 courses à plus forte conviction) **+ le Quinté+ systématiquement**.
- **Cœur de sélection resserré** : **1 banker** (cheval pivot) + base resserrée (3-4) orientée **value** (cote > probabilité estimée).
- **Stratégie de pari précise** : type de pari recommandé (Quinté+ **ordre/désordre**, Quarté+), **champ réduit** conseillé, **répartition de mise en UNITÉS** (ex. « 5u base / 2u champ » — **jamais de €**).
- **Quinté+ travaillé** : base + champ + stratégie ordre/désordre.
- **Niveau de confiance** + risque assumé.
- **Touche humaine** : l'admin (Stéphane/Claude via skill) affine le coup du jour avant publication.

**Synthèse** : Stat = **QUOI** sort · Pro = **COMMENT jouer** · Elite = **LE PLAN COMPLET** (banker + mise + value + Quinté+) sur le meilleur coup.

---

## 3. Choix des courses — *audience-aware* + LONAB

**Réalité technique constatée**
- `lib/sync/lonaci.ts` scrape **réellement** LONACI (CI) → marque `courses.jouable_afrique` + `nationale`.
- LONAB/PMUB est **whitelisté** (`lib/ai-pronostics/sources.ts`, type `AFRICA_CORROBORATION`) mais **non interrogé** activement.
- Palier existant **`VALIDATION_PMU_INTERNATIONAL`** : les grandes courses PMU France (Quinté+/Quarté+/Tiercé, R1) sont jouables sur **tous** les opérateurs africains, **PMUB/LONAB inclus**.

**Décision (option recommandée, validée par défaut)**
- **Phase 1/2 : pas de scraper LONAB.** On s'appuie sur `VALIDATION_PMU_INTERNATIONAL` (les courses France SONT sur PMUB) **+ un réglage « pays d'audience »** (Burkina) qui **priorise** ces courses dans le score de sélection (`course-selector.ts`) au lieu de sur-favoriser le match LONACI-direct (CI).
- **Phase 3 (optionnelle, si besoin)** : `fetchLonabProgramme` (scrape `lonab.bf`) **sur GitHub Actions** (règle d'or : ne jamais scraper depuis le Worker — cf. [[reference_eliteturf_sync_github_actions]]), pour confirmer la dispo Burkina en direct + marquer `jouable_afrique` depuis LONAB.

---

## 4. Génération — changements par agent (pipeline hybride conservé)

Pipeline inchangé dans son flux : `CourseSelector → FieldAnalyzer → SelectionBuilder → AnalyseWriter → QualityValidator → review humaine → publication`.

1. **CourseSelector** (`agents/course-selector.ts`)
   - Réglage `audience_country = "BF"` → priorise les grandes courses PMU France (jouables PMUB) ; ne pénalise plus l'absence de match LONACI-direct.
   - **Elite = 1-2 courses du jour à plus forte conviction** (le « coup ») **+ Quinté+** ; **Pro = les grandes courses** (~3-5).

2. **SelectionBuilder** (`agents/selection-builder.ts`)
   - **Pro** : sélection hiérarchisée Base(2)/Chances(3-4)/Outsiders(1-2) — les rôles `BASE/APPUI/OUTSIDER/COMPLEMENT` existent déjà ; on les rend **structurants** (et exposés).
   - **Elite** : **banker (1) + base resserrée (3-4)** orientée **value** (privilégier `value_score` élevé = cote > proba), pas « top 5 + 1 outsider ». Cœur resserré (~4-5) ; le champ Quinté+ est géré dans le plan de jeu.
   - `SELECTION_SIZES` : Pro reste 8 ; **Elite passe d'une simple liste de 6 à un cœur resserré + champ** (la différenciation devient **structurelle**, pas le nombre).

3. **AnalyseWriter** (`agents/analyse-writer.ts`) — *le gros ajout*
   - **Pro** : analyse + `suggested_ticket` enrichi (Tiercé/Quarté+, combinaisons de base).
   - **Elite** : nouveau bloc **`plan_de_jeu`** dans `subscriber_content` (Elite uniquement) :
     - `banker` (cheval pivot + justification)
     - `bet_strategy` : `{ type_pari, champ_reduit, mise_unites[] }` (unités, pas €)
     - `value_picks` : chevaux sous-cotés ciblés
     - `quinte_plan` : base + champ + stratégie ordre/désordre
     - `confidence_level` + `responsible_note` (déjà existants)

4. **QualityValidator** (`agents/quality-validator.ts`)
   - Nouveaux checks **« structure conforme au niveau »** : Pro a des rôles + un ticket ; Elite a `banker` + `bet_strategy` + `quinte_plan`.
   - **Garde-fous conservés** (blocants) : zéro promesse de gain, sources whitelistées, validation Afrique présente, runners existent, pas de non-partant en base.

5. **Humain** : affinage du coup du jour Elite via `/admin/pronostics/ai-review` (mode review déjà en place).

---

## 5. Modèle de données

- **`AnalyseWriterResult.subscriber_content`** (`lib/ai-pronostics/types.ts`) : ajouter un champ **optionnel** `plan_de_jeu` (peuplé pour Elite uniquement) avec la structure du §4.3.
- **`ai_pronostic_drafts`** : le `plan_de_jeu` voyage dans `subscriber_content` (jsonb) → aucune migration de schéma lourde.
- **Table `pronostics`** (publiée) : le contenu publié doit transporter le `plan_de_jeu` pour l'affichage Elite (colonne contenu jsonb existante ou champ dédié — à confirmer au plan).
- **`courses`** : réutilise `jouable_afrique` / `nationale` (existants). Aucun nouveau champ Phase 1.

---

## 6. Affichage public (différenciation VISIBLE)

L'abonné doit **voir** la différence de nature :
- **Sélection stats** (`/courses/[id]`, onglet) : présentée comme **lecture** (« favoris stats », pas un conseil de jeu).
- **Pro** (`/pronostics/[id]`, `PronosticCard`) : afficher la **hiérarchie Base/Chances/Outsiders** + le **ticket**.
- **Elite** : afficher le **plan de jeu** distinctement (banker mis en avant, bloc « stratégie de mise » en unités, bloc « Quinté+ travaillé »). Gating via `canAccess` inchangé (Elite voit aussi Pro).
- Fichiers concernés : `app/(public)/pronostics/[id]/page.tsx`, `app/(public)/courses/[id]/page.tsx`, `components/pronostics/PronosticCard.tsx`, `components/home/PronosticsSection.tsx`.

---

## 7. « Viser le gain » — méthodologie honnête

Aucune garantie. Ce qui maximise **réellement** les chances :
- **Value** (Elite) : cibler les chevaux dont la **cote dépasse la probabilité estimée** (`value_score`) — le seul *edge* mesurable.
- **Hiérarchie propre** (Pro) : base = forte confiance, outsiders = value contrôlée.
- **Confiance honnête** : `confidence_level` reflète la vraie solidité du field (le backtest a montré que l'IA n'ajoute pas de pouvoir prédictif → la valeur vient de la **structure de jeu**, pas d'une prédiction « magique »).

---

## 8. Garde-fous (non négociables)
- Anti-fabrication absolue (sources whitelistées, jamais de faux bilans).
- Aucune promesse de gain ; vocabulaire « garanti/sûr/100% » interdit (déjà appliqué).
- Conseils de mise en **unités**, jamais en €.
- Validation Afrique obligatoire avant publication.
- Publication = **review humaine** (jamais 100% auto pour l'Elite).

---

## 9. Phasage
- **Phase 1** (impact immédiat Nabassom) : Elite « plan de jeu » (SelectionBuilder banker/value + AnalyseWriter `plan_de_jeu` + affichage Elite) + réglage audience BF dans CourseSelector.
- **Phase 2** : Pro hiérarchisé visible (rôles + ticket) + checks QualityValidator + affichage Pro.
- **Phase 3** (optionnelle) : scraper LONAB/PMUB sur GitHub Actions.

---

## 10. Risques / questions ouvertes
- **BDD chevaux jeune** : `value_score` / `confidence` peu fiables sur chevaux peu courus → l'affinage humain Elite reste essentiel (assumé par le mode hybride).
- **Champ « plan de jeu »** : confirmer au plan où le stocker dans la table `pronostics` publiée (contenu jsonb vs champ dédié).
- **LONAB scrapable ?** : à vérifier seulement si Phase 3 déclenchée (structure `lonab.bf` inconnue).
- **Sélection stats vs pronostic FREE quotidien** : clarifier l'UI pour que « Sélection stats » (lecture, toutes courses) ne soit pas confondue avec le pronostic gratuit du jour.
