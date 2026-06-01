# Spec — « Notre sélection » (lecture statistique par course)

- **Date** : 2026-06-01
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-01) — spec à valider avant plan d'implémentation
- **Type** : Feature publique gratuite (lecture stats), distincte du pronostic premium

## 1. Problème / Objectif

Sur la page course (`/courses/[id]`), à côté des onglets existants **Partants · Côtes en direct · Statistiques · Arrivées & Rapports**, ajouter un onglet **« Notre sélection »** : une sélection automatique de **8 chevaux** basée sur les **statistiques de la course**, pour donner de la **lisibilité** au visiteur (comme le font Geny, Zone-Turf, Equidia).

⚠️ **Ce n'est PAS le pronostic premium Elite Turf** (qui porte sur **3 courses/jour**, analyse senior, réservé/mis en avant). C'est une **aide à la lecture gratuite et automatique**, disponible sur (presque) toutes les courses. Les deux doivent rester **clairement distincts** pour ne pas brouiller — ni cannibaliser — le produit payant.

**Critère éditorial (PO)** : la sélection doit faire la part belle aux **chevaux favoris** (cote), aux **drivers “joker”/reconnus** et aux **entraîneurs reconnus**.

## 2. Décisions validées (Q&A de cadrage)

| Sujet | Décision |
|---|---|
| Visibilité | **Gratuit, 100% visible par tous** + encart discret « Voir le pronostic premium du jour » |
| Taille | **8 chevaux fixes** ; si `< 8` partants → afficher **tout le champ classé** |
| Cote / dispo | **Dernière cote dispo** (favoris = cotes courtes), recalcul à l'affichage ; **repli** sur forme/historique + réputation driver/entraîneur si pas de cote → onglet présent sur **TOUTES** les courses |
| Identité | **Pas de vocabulaire premium** (« base », « joker », « indice de confiance ÉLEVÉ ») → ton « stats », sobre |

## 3. Architecture (réutilisation maximale, déterministe, $0)

**Moteur réutilisé** : `getCourseStatsEnrichies(partants)` (`lib/courses/getCourseStatsEnrichies.ts`) calcule déjà, par partant, un **`score_composite`** = `0.35·cote + 0.30·historique cheval + 0.20·musique + 0.15·historique jockey`, plus `quinte_probable` / `vedettes` / `value_bets`. C'est déjà l'ossature : favoris (cote) + forme + historique.

**Nouvelle couche** `buildNotreSelection(enriched, opts)` :
1. Part du `score_composite` de chaque partant.
2. **Bonus réputation driver** : liste curée de grands drivers. **Réutiliser `ELITE_JOCKEYS`** de `lib/ai-pronostics/agents/field-analyzer.ts` → l'**extraire dans un module partagé** `lib/turf/reputation.ts` (dé-duplication ; le field-analyzer l'importera ensuite).
3. **Bonus réputation entraîneur** : nouvelle petite liste curée d'entraîneurs reconnus (`RECOGNIZED_TRAINERS`).
4. **Repli sans cote** : si aucune cote présente dans le champ → re-pondérer **sans** la composante cote (historique + musique + réputation), pour que la sélection existe quand même.
5. Trie, prend le **top 8** (ou **tout le champ** si `< 8`).
6. Attribue à chaque cheval une **étiquette courte** déterministe : `Favori marché` (cote la plus courte) · `Driver reconnu : X` · `Bonne forme` · `Régulier` · `Outsider value`.

**Coût/perf** : 100% déterministe, **aucun appel LLM**, calculé au rendu (la page appelle déjà `getCourseStatsEnrichies` pour l'onglet Stats → on réutilise le même calcul), mis en cache via la revalidation de la page course.

## 4. UI / UX

- **Onglet** « Notre sélection » sur la page course, **même pattern** que les onglets existants (à localiser : composant d'onglets de `/courses/[id]`).
- **Bandeau de tête (obligatoire)** :
  > 📊 **Lecture statistique automatique** — ce n'est pas notre pronostic du jour (réservé aux 3 courses analysées par nos experts).
  + bouton CTA **« Voir le pronostic premium → »** (vers `/pronostics`).
- **Liste des 8** : tableau/cartes scannables → `N° · Nom du cheval · étiquette` (+ driver). Mettre légèrement en avant les 2-3 premiers.
- **Champ `< 8`** : afficher tout le champ classé, même structure.
- **Aucune promesse de gain** (cohérent avec la charte éditoriale Elite Turf).

## 5. Cas limites

- **Pas de partants en BDD** (programme non encore enrichi) → l'onglet **reste présent** et affiche un message court « Sélection bientôt disponible — partants en cours de chargement » (cohérence UI + SEO).
- **Pas de cote** → repli stats (cf. §3.4).
- **Champ `< 8`** → tout le champ classé.
- **Non-partants** → exclus de la sélection.

## 6. Non-objectifs (YAGNI)

- ❌ Pas de flux de cotes **temps réel** (streaming) — on prend le dernier snapshot au rendu.
- ❌ Pas d'IA/LLM **par visite**.
- ❌ Ce **n'est pas un pronostic** : pas d'analyse rédigée senior, pas de structure « base/joker/confiance » premium.

## 7. SEO

Contenu **unique par course** → renforce la matière des pages course **indexables** (cf. `isIndexable`). Veiller à ce que ce soit **substantiel** (étiquetage + ordre = contenu réel), pas du boilerplate vide.

## 8. Fichiers impactés (à finaliser au plan d'implémentation)

- **+ `lib/turf/reputation.ts`** : listes curées `ELITE_DRIVERS` (extrait de `ELITE_JOCKEYS`) + `RECOGNIZED_TRAINERS`.
- **+ `lib/courses/notre-selection.ts`** : `buildNotreSelection()` + étiquetage.
- **~ `lib/ai-pronostics/agents/field-analyzer.ts`** : importer la liste depuis `lib/turf/reputation.ts` (dé-duplication, comportement inchangé).
- **~ composant page course** (`app/.../courses/[id]/...`) : ajouter l'onglet + le rendu + bandeau + CTA.
- **+ tests** : unitaires `buildNotreSelection`.

## 9. Tests

- **Unitaires `buildNotreSelection`** : taille (8 vs tout-le-champ `< 8`), repli sans cote, bonus driver/entraîneur appliqué, étiquetage cohérent, exclusion des non-partants.
- **Vérif visuelle** : re-rendu sur une course réelle, comparaison avec l'onglet Stats existant.

## 10. Garde-fou opérationnel (dépôt multi-agents)

Le dépôt `elite-turf` est **très actif en parallèle** (plusieurs sessions/agents). Toute la feature (spec + code) est développée dans un **worktree isolé** (`feat/notre-selection`, branché sur `origin/main`) puis livrée en **une PR**, pour éviter les conflits avec le répertoire de travail partagé.
