# Elite-Turf IA — Système Multi-Agents (v2 conforme spec Afrique)

> **Statut actuel** : Session 1 — Alignement avec le cahier des charges
> `elite-turf-specification-multi-agent-afrique.md` (v1.0, 2 328 lignes).
>
> Tous les agents sont **encore stubs** et désactivés en production.
> L'ancien cron `app/api/cron/ia-pronostics` (1 agent monolithique, 2
> pronostics France-centric) reste actif tant que les Sessions 2-5 ne
> sont pas terminées.

---

## 🎯 Vision produit (cahier des charges §1)

Elite-Turf n'est **pas** un site de pronostics standard. C'est une **machine
éditoriale premium orientée Afrique francophone**, fondée sur :

- la sélection intelligente des courses ;
- **la validation de disponibilité Afrique** (cœur du système) ;
- la qualité des sources ;
- le croisement des données ;
- l'analyse factuelle ;
- la prudence éditoriale ;
- la **validation humaine avant publication** ;
- la segmentation claire entre Gratuit, Starter, Pro et Elite.

> 🚫 La promesse "Nous garantissons les gains" est INTERDITE.
> ✅ La promesse correcte est : "Nous garantissons une **méthode**
>    exigeante de sélection, d'analyse, de validation et de contrôle qualité."

---

## 🌍 Audience prioritaire

**~90% des visiteurs viennent d'Afrique francophone** — la logique produit
doit donc partir de ce marché, et non du marché français.

Ordre de priorité (cahier §2) :

1. Côte d'Ivoire (cœur de l'audience)
2. Afrique subsaharienne francophone
3. Sénégal, Burkina, Bénin, Mali, Gabon, Cameroun, Togo, Tchad
4. Maghreb (Maroc, Algérie, Tunisie)
5. Outre-mer
6. France
7. Belgique

---

## 🚨 Règle maîtresse Elite-Turf (cahier §3)

```txt
Une course ne peut être publiée QUE si :

1. Sa pertinence sportive du jour est claire.
2. Sa disponibilité Afrique est confirmée OU fortement corroborée.
3. Sa présence LONACI est validée directement
   OU sa présence Afrique est corroborée par des sources officielles
   whitelistées.
4. Sa discipline est confirmée par la source officielle adaptée :
   - Trot : LeTROT
   - Galop/Plat/Haies/Steeple : France Galop
   - Courses marocaines : SOREC / e-SOREC
5. Les données PMU, Afrique et discipline ne se contredisent pas.
6. Le croisement des sources permet une lecture solide.
7. Le contenu final affiche obligatoirement :
   - « Validation LONACI directe »
   OU
   - « Validation Afrique corroborée »

Si ces conditions ne sont pas remplies → REJET automatique.
```

**Formule produit** : *Pas de validation Afrique, pas de pronostic Elite-Turf.*

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Cron /api/cron/ia-pronostics-v2  (4h00 Paris quotidien)        │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
                  ┌─────────────────────┐
                  │  DIRECTOR Agent     │  ← orchestrateur
                  │  (director.ts)      │
                  └──────────┬──────────┘
                             ↓
       ┌─────────────────────┼─────────────────────┐
       ↓                     ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. Course    │    │ 2. Field     │    │ 3. Selection │
│  Selector    │ →  │  Analyzer    │ →  │   Builder    │
│ (Sonnet 4.5) │    │  (no LLM)    │    │ (Sonnet 4.5) │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                                ↓
                    ┌──────────────┐    ┌──────────────┐
                    │ 5. Quality   │ ←  │ 4. Analyste  │
                    │  Validator   │    │   Writer     │
                    │  (no LLM)    │    │ (Haiku 3.5)  │
                    └──────┬───────┘    └──────────────┘
                           ↓
                  ┌─────────────────────┐
                  │ 6. Notification     │  ← nouveau (vs Phase 1)
                  │     Builder         │
                  │ (no LLM)            │
                  └──────────┬──────────┘
                             ↓
                  ┌─────────────────────┐
                  │ INSERT ai_pronostic │
                  │       _drafts       │  ← nouvelle table BDD
                  │ status=APPROVED_    │
                  │ FOR_ADMIN_REVIEW    │
                  └──────────┬──────────┘
                             ↓
                  ┌─────────────────────┐
                  │  Slack notif        │
                  │  + email admin      │
                  └──────────┬──────────┘
                             ↓
                  ┌─────────────────────┐
                  │ /admin/pronostics/  │  ← review humaine
                  │     ai-review       │     OBLIGATOIRE
                  └─────────────────────┘
```

---

## 📁 Structure des fichiers

```
lib/ai-pronostics/
├── README.md                          ← ce fichier (v2 conforme spec)
├── types.ts                           ← types stricts conformes schémas JSON spec
├── sources.ts                         ← whitelist sources (LONACI, PMU, LeTROT…)
├── forbidden-expressions.ts           ← filtre "gain garanti", "tuyau sûr"…
├── claude-client.ts                   ← wrapper API Anthropic (retry, JSON)
├── director.ts                        ← orchestrateur principal
└── agents/
    ├── course-selector.ts             ← Agent 1 (à refondre Session 4)
    ├── field-analyzer.ts              ← Agent 2 (à refondre Session 3)
    ├── selection-builder.ts           ← Agent 3 (à refondre Session 4)
    ├── analyse-writer.ts              ← Agent 4 (à refondre Session 4)
    ├── quality-validator.ts           ← Agent 5 (à refondre Session 3)
    └── notification-builder.ts        ← Agent 6 (à créer Session 4)

app/api/cron/ia-pronostics-v2/
└── route.ts                           ← endpoint cron (auth Bearer)
```

---

## 🎚 Les 4 niveaux d'accès (cahier §11.2)

| Niveau | Sélection | Type pari | Audience | Particularité |
|---|---|---|---|---|
| **FREE** | 6 chevaux | TIERCE/QUINTE | Visiteurs gratuits | Course **différente** des courses ELITE |
| **STARTER** | 8 chevaux | QUINTE+ | Nouveaux abonnés 7j | Équivalent PRO pendant période active |
| **PRO** | 8 chevaux | QUINTE+ | Abonnés Pro | Couverture large, sécurité places |
| **ELITE** | 6 chevaux | QUINTE+ | Abonnés Elite | Sélection resserrée, courses vedettes |

---

## 🤖 Détail des 6 Agents

### Agent 1 — CourseSelector (cahier §9)

| Aspect | Détail |
|---|---|
| **Modèle** | Claude Sonnet 4.5 (raisonnement éditorial) |
| **Input** | Courses du jour (Supabase) + preuves sources |
| **Output** | `CourseSelectorResult` (3 courses + raisonnement + rejets) |
| **Coût** | ~$0.015 / run |

**Mission** : sélectionner 3 courses ET valider leur disponibilité Afrique.

Scoring (cahier §9.3) :
```txt
africa_course_score =
  0.25 * africa_availability_score
+ 0.20 * source_crosscheck_score
+ 0.15 * data_completeness_score
+ 0.15 * field_readability_score
+ 0.10 * discipline_confirmation_score
+ 0.10 * subscriber_relevance_score
+ 0.05 * value_opportunity_score
- 0.15 * contradiction_risk_score
- 0.10 * source_fragility_score
```

Seuils minimum par niveau : FREE=68, STARTER/PRO=75, ELITE=85.

### Agent 2 — FieldAnalyzer (cahier §10)

| Aspect | Détail |
|---|---|
| **Modèle** | Aucun (pur TypeScript déterministe) |
| **Input** | `course_id` + validation_status confirmée |
| **Output** | `FieldAnalyzerResult` (analyse partants + scores) |
| **Coût** | $0 |

**Réutilise** `lib/courses/getCourseStatsEnrichies.ts` qu'on a déjà construit.
**Bloque** si validation Afrique absente.

### Agent 3 — SelectionBuilder (cahier §11)

| Aspect | Détail |
|---|---|
| **Modèle** | Sonnet 4.5 (validation éditoriale + ajustement marginal) |
| **Input** | Field enrichi + niveau d'accès |
| **Output** | `SelectionBuilderResult` (sélection finale + raisons) |
| **Coût** | ~$0.02 / run × 3 courses = $0.06 |

**Pondération déterministe** (cahier §11.4) :
```txt
global_selection_score =
  0.25 * confidence_score
+ 0.20 * regularity_score
+ 0.15 * form_score
+ 0.10 * distance_score
+ 0.10 * terrain_score
+ 0.10 * jockey_driver_score
+ 0.05 * trainer_score
+ 0.05 * value_score
- 0.20 * risk_score
```

### Agent 4 — AnalyseWriter (cahier §12)

| Aspect | Détail |
|---|---|
| **Modèle** | Haiku 3.5 (rédaction structurée, économique) |
| **Input** | Selection + field + niveau |
| **Output** | `AnalyseWriterResult` (contenu rédigé adapté au niveau) |
| **Coût** | ~$0.005 / run × 3 = ~$0.015 |

**Templates différents** par niveau (Free/Starter/Pro/Elite) avec structure
imposée — voir cahier §12.4 à §12.6 pour les templates exacts.

### Agent 5 — QualityValidator (cahier §13)

| Aspect | Détail |
|---|---|
| **Modèle** | Aucun (déterministe) |
| **Input** | Draft + field + selection |
| **Output** | `QualityValidatorResult` (status APPROVED / NEEDS_REVIEW / REJECTED) |
| **Coût** | $0 |

**19 règles de rejet automatique** (cahier §13.2) — protection critique
de la marque et des abonnés.

### Agent 6 — NotificationBuilder (cahier §16) — ⭐ Nouveau vs Phase 1

| Aspect | Détail |
|---|---|
| **Modèle** | Aucun |
| **Output** | Message court pour Slack + email admin |
| **Coût** | $0 |

---

## 💰 Coûts estimés du système complet

| Composant | Tokens/run | Coût/run | Coût/mois |
|---|---|---|---|
| CourseSelector (Sonnet) | ~1.1k | $0.015 | $0.45 |
| FieldAnalyzer × 3 | 0 | $0 | $0 |
| SelectionBuilder × 3 (Sonnet) | ~6k | $0.06 | $1.80 |
| AnalyseWriter × 3 (Haiku) | ~3k | $0.015 | $0.45 |
| QualityValidator × 3 | 0 | $0 | $0 |
| NotificationBuilder | 0 | $0 | $0 |
| **TOTAL** | **~10k** | **~$0.09** | **~$2.70/mois** |

---

## 📋 Plan d'implémentation (5 sessions)

### ✅ Session 1 — Alignement métier (ce commit)

Sortie de cette session :
- [x] `types.ts` réécrit selon les schémas JSON spec (4 niveaux, validation Afrique, disciplines, statuts pipeline)
- [x] `sources.ts` créé (whitelist statique LONACI/PMU/LeTROT/SOREC/LONASE/LONAB/PMUC/PMUG/PMU Mali + sources interdites)
- [x] `forbidden-expressions.ts` créé (19 patterns interdits + notes responsables)
- [x] `README.md` v2 conforme spec
- [x] Stubs d'agents conservés mais marqués "à refondre"
- [x] Aucun impact production (tout est stub désactivé)

### 📋 Session 2 — BDD (1h30)

3 migrations Supabase :
- `source_whitelist` (cahier §21) — whitelist dynamique éditable
- `course_source_evidence` (cahier §22) — preuves sources par course
- `ai_pronostic_drafts` (cahier §23) — drafts AI séparés des pronostics live

Seed initial de `source_whitelist` depuis `lib/ai-pronostics/sources.ts`.

### 📋 Session 3 — Agents déterministes (2h)

Implémentation complète :
- **FieldAnalyzer** (réutilise `getCourseStatsEnrichies`)
- **QualityValidator** (19 règles spec §13.2)

### 📋 Session 4 — Agents LLM (3h)

Implémentation complète :
- **CourseSelector** (scoring Afrique + arbitrage Claude)
- **SelectionBuilder** (algo + validation Claude)
- **AnalyseWriter** (4 templates Free/Starter/Pro/Elite)
- **NotificationBuilder** (message Slack)

### 📋 Session 5 — Production (2h)

- **Orchestrateur** complet (workflow + sauvegarde drafts)
- **Cron Cloudflare** 4h Paris (check timezone Worker UTC)
- **Page admin** `/admin/pronostics/ai-review` (badges 🟢🟡🔴⚠️🔒⭐)
- **Bascule** ancien cron `ia-pronostics` → désactivé

---

## ✅ Mentions publiques obligatoires (cahier §4)

Chaque pronostic publié DOIT contenir l'une de ces deux mentions
visibles dans le contenu :

```txt
Validation LONACI directe
```

```txt
Validation Afrique corroborée
```

Ces mentions doivent apparaître dans :
- Le contenu abonné (premium)
- Le contenu gratuit
- La page admin `/admin/pronostics/ai-review`
- Les logs de validation
- Les objets JSON des drafts

---

## 🚫 Expressions interdites (cahier §24)

Toute détection = REJECTED automatique :

```txt
- gain garanti
- sûr à 100%
- tuyau sûr
- impossible à battre
- banque absolue
- misez gros
- all-in
- certitude du jour
- base infaillible
- cadeau des dieux
```

✅ Expressions recommandées (vocabulaire Elite-Turf) :

```txt
- base intéressante
- profil solide
- chance régulière
- outsider à surveiller
- possibilité intéressante
- sélection prudente
- lecture favorable
- risque à intégrer
- course ouverte
- prudence nécessaire
```

---

## 🔒 Anti-cannibalisation Free / Elite (cahier §18)

```txt
Le pronostic gratuit doit être différent des courses vedette Elite.
free.course_id NOT IN elite_featured.course_ids
```

Interdiction stricte :
- Même `course_id`
- Même réunion + même course
- Même `race_number`
- Même hippodrome + même heure + même nom de prix

> *Le gratuit attire. L'Elite convertit. Les deux ne doivent pas se
> marcher dessus.*

---

## 📚 Références

- 📜 **Cahier des charges complet** :
  `~/Downloads/elite-turf-specification-multi-agent-afrique.md`
  (v1.0, 2 328 lignes, 31 sections)
- **Pattern Director + Workers** : inspiré architecture multi-agents
  Anthropic (cf. blog post 2024)
- **Stack tech** : Anthropic SDK natif via fetch (pas de Mastra.ai
  pour rester léger Cloudflare Workers)
- **Réutilise** : `lib/courses/getCourseStatsEnrichies.ts` (FieldAnalyzer)
- **Auth endpoints** : `lib/auth/checkAdminAuth.requireBearerOnly` (cron)
