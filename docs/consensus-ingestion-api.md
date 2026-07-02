# API d'ingestion consensus (Lot 2 — contrat v2.4)

Objectif : le pipeline dépose ses consensus + commentaires par API ; l'admin passe
de « coller » à « **relire & publier** ». **Rien ne se publie sans action humaine** —
un POST crée un BROUILLON (`consensus_drafts`, status `draft`) qui atterrit dans
`/admin/consensus/brouillons`, puis l'admin l'ouvre dans l'atelier existant.

## Endpoint

`POST /api/v1/ingest/consensus`

### Auth
- `Authorization: Bearer <ELITE_INGEST_KEY>` (obligatoire ; **fail-closed** si le
  secret serveur est absent → 401).
- `X-Signature: <HMAC-SHA256(rawBody, ELITE_INGEST_SECRET) en hex>` — **obligatoire
  dès que `ELITE_INGEST_SECRET` est posé** (recommandé). Lie la requête au corps EXACT.
- Comparaisons à temps constant. 401 = auth absente/mauvaise · 403 = signature mauvaise.

Secrets (posés dans Cloudflare → Worker `elite-turf` → Settings → Variables, type **Secret**) :
`ELITE_INGEST_KEY`, `ELITE_INGEST_SECRET`. Les mêmes valeurs côté pipeline.

### Corps (contrat v2.4, stable)
```json
{
  "contract_version": "2.4",
  "run_type": "matin | filet_j1 | sentinelle",
  "course": { "date": "2026-07-02", "reunion_course": "R1C2", "hippodrome": "Cabourg", "nb_partants": 16 },
  "consensus": {
    "nb_sources": 33, "nb_sources_brut": 35, "echantillon_reduit": false,
    "citations": [ { "numero": 7, "citations": 33, "bases": 12 } ]
  },
  "commentaires": {
    "elite": { "confiance": 3, "selection": [7,8,4,6,11,15], "analyse_courte": "≤160", "analyse_complete": "…" },
    "pro":   { "confiance": 2, "selection": [7,8,4,6,11,15,13,9], "analyse_courte": "…", "analyse_complete": "…" }
  },
  "meta": { "genere_le": "ISO8601", "sources": ["stats-quinte"] }
}
```
Les `citations` sont des ENTIERS stricts (`numero citations bases`) — **jamais de cote**
(la cote vient de la course liée). Un flottant/valeur non entière est rejeté à la validation.

### Réponses
| Code | Cas | Corps |
|---|---|---|
| 401 | Bearer absent/mauvais, ou secret serveur non posé | `{ error }` |
| 403 | Signature HMAC absente/mauvaise | `{ error }` |
| 400 | JSON illisible | `{ error }` |
| 422 | Enveloppe invalide (contrat) ou bloc rejeté (validation Lot 1) | `{ error, code, validation_report? }` |
| 200 | OK, course rattachée | `{ draft_id, status:'draft', validation_report, admin_review_url }` |
| 202 | OK mais course inconnue (à rattacher) | `{ draft_id, status:'orphan_draft', … }` |
| 409 | Run déjà **publié** par l'admin — jamais écrasé | `{ draft_id, status:'already_published', error }` |

Toute tentative (OK ou non) est journalisée dans `consensus_imports` (source `api`).

### Idempotence & machine à états
- Clé unique `(date_course, reunion_course, run_type)` : re-POST du même run **remplace**
  le brouillon (upsert), jamais de doublon. `created_at` préservé.
- États : `draft` (déposé) → `reviewed` (ouvert dans l'atelier) → `rejected` (écarté)
  → `published`. Le passage `published` reste **humain** (atelier existant).
- Re-POST sur un run `draft`/`reviewed`/`rejected` → le brouillon est remplacé et
  **re-surface en `draft`** (un re-POST = données corrigées, à relire).
- Re-POST sur un run **`published`** → **409 `already_published`**, la ligne n'est
  jamais touchée : la décision humaine est finale.
- Jamais de course fantôme : une course inconnue reste `orphan_draft` (rattachement manuel).

### HMAC — exemple (Node, pour le pipeline)
```js
const crypto = require("crypto");
const body = JSON.stringify(payload); // le corps EXACT envoyé
const sig = crypto.createHmac("sha256", process.env.ELITE_INGEST_SECRET).update(body).digest("hex");
// headers: { Authorization: `Bearer ${KEY}`, "X-Signature": sig, "Content-Type": "application/json" }
```

## Lecture

`GET /api/v1/consensus?date=YYYY-MM-DD` (auth ADMIN) — consensus PUBLIÉS d'une date
(pour le futur Track Record / archivage).

## Modules
- `lib/consensus/ingest.ts` — parse/mappe le contrat → bloc validable (PUR).
- `lib/consensus/ingest-auth.ts` — Bearer + HMAC (temps constant, fail-closed).
- Validation métier : `lib/consensus/validate.ts` (Lot 1, source unique).
- Tests : `lib/consensus/ingest.test.ts` (parse + auth + rejet 01/07 par l'API).
