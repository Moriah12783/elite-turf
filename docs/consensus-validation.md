# Validation du bloc consensus (Lot 1 — contrat de données v2.4)

**Objectif** : rendre techniquement impossible la corruption des sélections par un bloc
mal formé (incident du 01/07/2026 : cote « 144 » en 3ᵉ colonne lue comme « bases » →
cheval cité 2/33 tagué Base → injecté dans l'Elite-6).

## Architecture

- **Module unique** : `lib/consensus/validate.ts` (`validateConsensusBlock`) — PUR, testé.
  Consommé par : (a) « Analyser » de l'admin via `POST /api/admin/consensus/validate`,
  (b) l'API d'ingestion (Lot 2). Le frontend ne fait qu'afficher le rapport.
- **Défense en profondeur** : R01 vit AUSSI dans le moteur (`lib/consensus/engine.ts`,
  `seuilBase()` + filtre des slots base) — même un bloc qui contournerait la
  validation ne peut pas placer un cheval sous-cité en « Base ».
- **Traçabilité** : chaque tentative (ok ou non) est journalisée dans
  `consensus_imports` (bloc brut + hash SHA-256 + rapport + source `manuel|api`).

## Règles

| Code | Sévérité | Règle |
|---|---|---|
| E00 | bloquant | `nb_partants` et `nb_sources` requis (entiers ≥ 1) ; bloc non vide |
| E01 | bloquant | chaque ligne de données = exactement 3 entiers `numero citations bases` — **jamais de cote** |
| E02 | bloquant | `numero ∈ [1, nb_partants]` |
| E03 | bloquant | `numero` unique |
| E04 | bloquant | `citations ∈ [0, nb_sources]` et `bases ∈ [0, citations]` — une ligne à **0 citation** est ignorée (non listée), pas une erreur |
| E05 | **warning** (ack) | `Σ citations ≈ 8 × nb_sources` — avertissement seulement : les sources citent souvent 5-8 chevaux, un écart est légitime (l'anti-cote reste couvert par E01/E04) |
| E06 | bloquant si `Σ bases > nb_sources` ; warning (ack) si `<` | `Σ bases == nb_sources` (1 base par avis) |
| E07 | warning (ack) | `nb_sources < 15` → `echantillon_reduit`, propagé jusqu'à l'affichage abonnés |
| R01 | règle moteur | `citations < max(3, ceil(0.30 × nb_sources))` → jamais tagué « Base » auto |

Lignes ignorées silencieusement : vides, `#…`, prose/méta dont le 1ᵉʳ token n'est pas un
entier (`Date : …`, `Nb sources : …`). Une ligne qui COMMENCE par un entier doit être
conforme (E01 sinon) — c'est le compromis sécurité > tolérance choisi après l'incident.

**Rupture assumée (v2.4)** : l'ancien format 2 colonnes (29/06) et le collage
« email entier avec prose numérotée » sont rejetés. On colle uniquement le bloc.

## Endpoint

`POST /api/admin/consensus/validate` (auth ADMIN)
Body : `{ date_course?, course_id?, nb_partants, nb_sources, texte }`
→ `{ report: { ok, errors[], warnings[], partants[], seuil_base, echantillon_reduit } }`
Les `partants` ne sont renvoyés que si `ok`. Toute tentative est journalisée.

## Fixtures de test (réelles)

- `lib/consensus/validate.test.ts` : bloc corrigé du 01/07 (Enghien R1C8, 33 sources,
  Σ=264, Σbases=33 — Google Doc de référence), ligne buguée `3 2 144 12`, bloc 7 sources
  du 30/06 (reconstitué depuis le rapport réel), bloc 2 colonnes du 29/06 (legacy rejeté).
- `lib/consensus/engine.test.ts` : R01 — cheval cité 2/33 avec score gonflé jamais en base.
