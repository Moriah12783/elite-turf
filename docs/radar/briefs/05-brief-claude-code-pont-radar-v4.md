# Brief Claude Code — Pont `RADAR_V4` (Radar → turf-engine)

**But** : faire entrer les probabilités scellées de Radar (`v4-labels`) dans `turf-engine` comme un **quatrième moteur**, `RADAR_V4`, verrouillé aux mêmes horizons et jugé par le même banc que `NEW_VALUE_ENGINE`, `ETPE_ENGINE` et `MARKET_BASELINE`. Le banc F3 par horizon compare alors les cerveaux **aux mêmes cotes, aux mêmes instants**. Aucun moteur n'est modifié ; on ajoute, on ne remplace pas.

**Dépôts** : Radar = Supabase `kkwfaxxyzttooqhdglgk` (migration) · `Moriah12783/turf-engine` (Python, livraison patch + zip via `publier_vers_github.bat`).

## Règles absolues

1. **Aucune fuite temporelle** : une ligne Radar n'alimente un verrou `RADAR_V4` que si `scelle_a ≤ lock_time_utc` du verrou. Jamais de verrou rétroactif, jamais de rattrapage après départ (règles existantes de `due_horizons()` conservées).
2. **Même porte de fraîcheur** : `RADAR_V4` n'est verrouillé que si `priced_ratio ≥ MIN_PRICED_RATIO` (cotes réelles), comme les trois autres — sinon la comparaison ne serait pas à cotes égales.
3. **Radar reste fermé** : aucune policy RLS, aucune clé service hors Supabase. L'accès passe par une fonction `security definer` protégée par un **jeton de pont** stocké en base (table privée), transmis en secret GitHub. La clé publiable seule ne donne rien.
4. **Ne toucher ni au journal Radar, ni à `fn_journal_seal`, ni aux moteurs existants, ni aux métriques historiques** : le rapport régénéré doit être identique pour les trois moteurs actuels.

---

## Partie 1 — Radar (migration `radar_v4_bridge`)

```sql
-- Jeton de pont : table privée, jamais lisible via l'API
create table if not exists public.bridge_secrets (
  name   text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
alter table public.bridge_secrets enable row level security;
revoke all on public.bridge_secrets from anon, authenticated, public;
-- Insérer le jeton (générer 32+ caractères aléatoires ; le MÊME sera mis en secret GitHub RADAR_BRIDGE_TOKEN) :
-- insert into public.bridge_secrets(name, secret) values ('radar_v4', '<jeton>');

create or replace function public.fn_journal_du_jour(p_date date, p_token text)
returns table (
  num_reunion int, num_course int, num_pmu int, nom text,
  p_win numeric, p_top2 numeric, p_top3 numeric, cote_au_scelle numeric,
  rang_note int, edition text, modele text, scelle_a timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_token is null or p_token <> (select s.secret from bridge_secrets s where s.name = 'radar_v4') then
    raise exception 'jeton de pont invalide' using errcode = '28000';
  end if;
  -- Fenêtre bornée : pas d'extraction d'historique par ce canal
  if p_date < current_date - 1 or p_date > current_date + 1 then
    raise exception 'date hors fenetre' using errcode = '22023';
  end if;
  return query
  select jp.num_reunion, jp.num_course, jp.num_pmu, jp.nom,
         jp.p_win, jp.p_top2, jp.p_top3, jp.cote_au_scelle,
         jp.rang_note, jp.edition, jp.modele, jp.scelle_a
  from journal_predictions jp
  where jp.date_course = p_date
    and jp.modele = (select version from ml_model_weights where id = 1)
  order by jp.num_reunion, jp.num_course, jp.rang_note;
end $$;

revoke all on function public.fn_journal_du_jour(date, text) from public, authenticated;
grant execute on function public.fn_journal_du_jour(date, text) to anon;
```

Contrôles d'acceptation Radar : `has_function_privilege('anon', 'public.fn_journal_du_jour(date,text)', 'execute')` = true · appel avec mauvais jeton → erreur 28000 · `select count(*) from bridge_secrets` impossible sous `anon` · `journal_predictions` toujours 0 policy.

Noter la création dans `project_memory` (clé `pont_radar_v4`) : date, nom de la fonction, règle du jeton, rappel qu'aucune clé service n'est sortie.

---

## Partie 2 — turf-engine

### 2.1 `turf_lab/radar_bridge.py` (nouveau)

- Config par variables d'environnement : `RADAR_SUPABASE_URL`, `RADAR_PUBLISHABLE_KEY`, `RADAR_BRIDGE_TOKEN`. Si l'une manque → le pont est **désactivé proprement** (log `RADAR_BRIDGE_DISABLED`, aucun verrou `RADAR_V4`, rien d'autre ne change).
- `fetch_radar_journal(date_iso) -> list[dict]` : `POST {RADAR_SUPABASE_URL}/rest/v1/rpc/fn_journal_du_jour`, en-têtes `apikey` et `Authorization: Bearer <RADAR_PUBLISHABLE_KEY>`, corps `{"p_date": date_iso, "p_token": RADAR_BRIDGE_TOKEN}`. Réutiliser `urllib.request` comme `daily_sync.get_json`. Timeout 10 s, une tentative + un retry. **Cache mémoire par date et par passe** (une requête par passe, pas par course).
- `class RadarV4Engine` avec `engine_name = "RADAR_V4"` et le **même contrat** que `MarketOddsEngine.predict(race, runners)` :
  - clé de jointure : `(race["meeting_number"], race["race_number"], runner["num"])` ↔ `(num_reunion, num_course, num_pmu)`, sur `race["date"]` (AAAA-MM-JJ) ;
  - partants actifs = `not is_non_partant` ; lignes utilisables = celles dont `scelle_a ≤ now_utc` (paramètre `as_of_utc` passé par l'appelant) ;
  - couverture = partants actifs appariés / partants actifs ; si `< 0.90` → retourner `{"engine_name": "RADAR_V4", "selection": [], "bases": [], "outsider_num": None, "probabilities": {}, "metadata": {"type": "radar_v4", "status": "ABSENT", "coverage": x}}` ;
  - sinon : `selection` = 8 premiers par `p_win` décroissant, `bases` = 2 premiers, `outsider_num` = 8ᵉ, `probabilities` = `p_win` **renormalisées** sur les partants actifs (clé `str(num)`), `metadata` = `{"type": "radar_v4", "status": "OK", "edition": …, "scelle_a": …, "modele": …, "coverage": x, "value_indices": {num: p_win × cote_du_moment}}` — la cote du moment est celle des runners (`odds_t15` puis `final_odds`), exactement comme le marché la voit à cet horizon.

### 2.2 `turf_lab/daily_sync.py`

- Importer et instancier `RadarV4Engine` dans `__init__` (désactivé si config absente).
- **Nouvelle méthode `_lock_radar(race_data, runners, horizon, ratio, lock_time_utc)`**, appelée juste après `_lock_horizon()` dans la même boucle course × horizon, et **indépendante** de son résultat (un horizon déjà verrouillé pour les trois moteurs peut recevoir `RADAR_V4` à une passe ultérieure, une seule fois) :
  - `if self.db.has_prediction(race_id, "RADAR_V4", horizon): return 0` ;
  - même porte : `priced_ratio(runners) ≥ MIN_PRICED_RATIO`, sinon `GATE_REFUSED` avec `"engine": "RADAR_V4"` ;
  - `p = radar.predict(race_data, runners, as_of_utc=now)` ; si `status == "ABSENT"` → **ne rien enregistrer** (log `RADAR_ABSENT {race_id, horizon, coverage}`) ; les lignes du soir (`edition = SOIR`) arrivent d'elles-mêmes à une passe suivante ;
  - sinon `prediction_id = f"{race_id}_RADAR_{horizon}"`, `odds_real = True`, `priced_ratio`, `lock_time_utc`, puis `save_prediction`.
- Ne pas modifier `_lock_horizon()` ni `due_horizons()`. Pas de snapshot de cotes supplémentaire (celui de `_lock_horizon` suffit, mêmes cotes au même instant).

### 2.3 `turf_lab/benchmark.py` et `turf_lab/html_report.py`

- `generate_comparative_report` : `engines = ["NEW_VALUE_ENGINE", "ETPE_ENGINE", "MARKET_BASELINE", "RADAR_V4"]` ; ajouter `horizon_breakdown_radar = self.evaluate_by_horizon("RADAR_V4")` et `discipline_breakdown_radar`.
- Ajouter au rapport un bloc **`courses_communes`** : par horizon, nombre de courses où `NEW_VALUE_ENGINE`, `MARKET_BASELINE` et `RADAR_V4` ont tous un verrou, et les métriques des trois **recalculées sur cette intersection** (c'est la seule comparaison loyale ; les métriques « toutes courses » restent affichées pour continuité).
- `html_report.py` : colonne « Radar v4 (labo) » dans le tableau principal et dans le banc par horizon ; note de bas de tableau : « Radar v4 : probabilités scellées le matin (07h35) ou le soir, jugées aux cotes de chaque horizon ». Aucun changement d'affichage des sélections abonnés : `RADAR_V4` est un moteur de banc, pas une sélection publiée.

### 2.4 Workflow et secrets

- `.github/workflows/daily_sync.yml` : ajouter au `env` des étapes de sync `RADAR_SUPABASE_URL`, `RADAR_PUBLISHABLE_KEY`, `RADAR_BRIDGE_TOKEN` depuis `secrets.*` (le dépôt est public : rien en clair dans le code, même la clé publiable).
- Steph pose les trois secrets dans GitHub → Settings → Secrets and variables → Actions.

### 2.5 Tests (`tests/test_radar_bridge.py`)

- Appariement `(R, C, num)` correct ; partant non-partant ignoré.
- Couverture 8/10 → `ABSENT`, rien d'enregistré ; 10/10 → `OK`, sélection de 8, bases de 2.
- Ligne avec `scelle_a` postérieur à `as_of_utc` → ignorée (test du garde anti-fuite).
- Config absente → pont désactivé, aucune exception, aucun verrou `RADAR_V4`.
- Rapport régénéré sur copie de la base réelle : métriques des trois moteurs existants **strictement identiques**, `RADAR_V4` absent de l'historique (jamais de rétroactif).

### 2.6 Livraison

Commit unique, patch + zip via `publier_vers_github.bat`. Pas de renommage, pas de modification d'URL.

---

## Partie 3 — Pré-enregistrement de la comparaison (à écrire dans `project_memory`, clé `preregistration_pont_radar_v4`, AVANT la première lecture)

```
HYPOTHÈSE : sur les courses communes et par horizon, RADAR_V4 est au moins aussi bien calibré que MARKET_BASELINE (Brier des probabilities vs arrivée) et fait au moins aussi bien que NEW_VALUE_ENGINE sur « gagnant dans le top 3 » et « gagnant dans les 8 ».
MÉTRIQUES : Brier par horizon (probabilities du moteur vs arrivée) ; taux top1 / top3 / top8 ; ROI simple gagnant flat à titre d'information (jamais un critère).
FENÊTRE : 28 jours à compter du premier jour avec ≥ 20 courses communes ; aucune lecture décisionnelle avant.
DÉCISION (règle gelée) : le cerveau qui alimente les sélections abonnés ne change QUE si un moteur bat les deux autres sur Brier avec t ≥ 2 sur les courses communes ET n'est pas inférieur sur top3/top8 ; sinon, étude d'un blend, elle-même pré-enregistrée.
INTERDITS : aucune modification de RADAR_V4 ni des autres moteurs pendant la fenêtre ; aucune promesse publique tirée du banc avant l'échéance.
```

## Ordre recommandé

1. Partie 1 (migration + jeton) — 15 minutes, risque nul.
2. Secrets GitHub (Steph).
3. Partie 2 avec tests, livraison patch + zip.
4. Partie 3 le jour de la mise en production (clé de pré-enregistrement datée).
5. Consigne auditeur (session Cowork) : ajouter « verrous RADAR_V4 posés la veille par horizon, courses communes, RADAR_ABSENT / GATE_REFUSED RADAR ».
