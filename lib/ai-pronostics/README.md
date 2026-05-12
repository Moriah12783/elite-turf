# Multi-Agents IA Elite Turf — Documentation architecture

> **Statut actuel** : Phase 1 (fondations posées, agents non implémentés).
> L'ancien cron `app/api/cron/ia-pronostics` (monolithique, 2 pronostics)
> reste actif tant que la Phase 2 + 3 ne sont pas terminées.

## 🎯 Objectif

Remplacer la publication manuelle quotidienne des 3 pronostics (Elite, Pro,
Gratuit) par un système IA qui :

1. Tourne automatiquement chaque nuit à 4h Paris
2. Sélectionne les 3 meilleures courses du jour selon le niveau d'accès
3. Analyse les fields avec nos données enrichies (stats historiques BDD)
4. Génère une sélection chevaux selon stratégie par niveau
5. Rédige une analyse_courte style Elite Turf
6. Valide la qualité avant insertion BDD
7. **Stocke avec `publie=false`** → attend review/édition de Stéphane
8. Notifie Stéphane sur Slack/WhatsApp

L'humain garde le contrôle éditorial final (publication = action manuelle).

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
                  │ INSERT en BDD       │
                  │ source='AI-MULTI'   │
                  │ publie=false ⚠️     │  ← attend review humaine
                  └─────────────────────┘
```

## 📁 Structure des fichiers

```
lib/ai-pronostics/
├── README.md                        ← ce fichier
├── types.ts                         ← types partagés (NiveauAcces, agents I/O)
├── claude-client.ts                 ← wrapper API Anthropic (retry, JSON parsing)
├── director.ts                      ← orchestrateur principal
└── agents/
    ├── course-selector.ts           ← Agent 1 : choisit 3 courses (LLM)
    ├── field-analyzer.ts            ← Agent 2 : enrichit le field (déterministe)
    ├── selection-builder.ts         ← Agent 3 : construit la sélection (LLM)
    ├── analyse-writer.ts            ← Agent 4 : rédige l'analyse (LLM)
    └── quality-validator.ts         ← Agent 5 : valide avant INSERT (déterministe)

app/api/cron/ia-pronostics-v2/
└── route.ts                         ← endpoint cron (auth Bearer)
```

## 🤖 Détail des 5 Agents

### Agent 1 — Course Selector

| Aspect | Détail |
|---|---|
| **Modèle** | Claude Sonnet 4.5 (reasoning éditorial) |
| **Input** | Liste des courses du jour (Supabase) |
| **Output** | 3 courses choisies (Elite, Pro, Gratuit) + raisonnement |
| **Coût** | ~$0.015 / run |

**Stratégie de sélection** :
- **ELITE** : Quinté+ + hippodrome prestigieux (Vincennes, Longchamp, Chantilly, Auteuil, Cagnes, Deauville, Saint-Cloud) + 12-18 partants
- **PRO** : Quinté+ ou Quarté+ hors elite, ≥ 10 partants
- **GRATUIT** : Tiercé accessible (LONACI/Maroc en bonus), ≥ 8 partants

### Agent 2 — Field Analyzer

| Aspect | Détail |
|---|---|
| **Modèle** | Aucun — pur TypeScript déterministe |
| **Input** | course_id |
| **Output** | Partants enrichis (score composite + badges + stats historiques) |
| **Coût** | $0 |

**Réutilise** `lib/courses/getCourseStatsEnrichies.ts` qu'on a déjà construit
pour la section Statistiques de la page course. Croise partants × tables
chevaux/jockeys/entraîneurs.

### Agent 3 — Selection Builder

| Aspect | Détail |
|---|---|
| **Modèle** | Claude Sonnet 4.5 (validation éditoriale + ajustement) |
| **Input** | Field enrichi + niveau d'accès |
| **Output** | Sélection finale (numéros) + confiance |
| **Coût** | ~$0.02 / run × 3 = ~$0.06 |

**Stratégies par niveau** :
- **ELITE (Quinté+, 6 chevaux)** : sélection serrée, base top 3 + 3 ajustements
- **PRO (Quinté+, 8 chevaux)** : couverture large, 4 base + 4 outsiders raisonnables
- **GRATUIT (Tiercé libre, 6 chevaux)** : mix favori + outsider

Le LLM intervient pour valider/ajuster la sélection algo initiale (max 2
substitutions avec raisonnement).

### Agent 4 — Analyse Writer

| Aspect | Détail |
|---|---|
| **Modèle** | Claude 3.5 Haiku (rédaction structurée, économique) |
| **Input** | Selection + field + niveau + course info |
| **Output** | analyse_courte (150-300 chars, style Elite Turf) |
| **Coût** | ~$0.005 / run × 3 = ~$0.015 |

**Charte éditoriale** :
- Ton : professionnel, analytique, rassurant
- 2-4 phrases, 150-300 chars
- Référence aux chevaux par leur numéro (#N)
- Justification analytique brève (musique, cote, taux historique)
- **Mots interdits** : "garanti", "sûr", "imbattable", etc.

### Agent 5 — Quality Validator

| Aspect | Détail |
|---|---|
| **Modèle** | Aucun — pur TypeScript déterministe |
| **Input** | PronosticDraft + field |
| **Output** | { ok: boolean, errors[], warnings[] } |
| **Coût** | $0 |

**Checks effectués** :
- ✅ Tous les numéros existent dans le field
- ✅ Pas de doublons
- ✅ Taille selection valide selon type_pari
- ✅ Au moins 1 favori (cote ≤ 10)
- ✅ analyse_courte longueur OK (100-400 chars)
- ✅ Pas de mots interdits dans analyse

## 💰 Coûts estimés

| Composant | Tokens/run | Coût/run | Coût/mois |
|---|---|---|---|
| CourseSelector (Sonnet) | ~1.1k | $0.015 | $0.45 |
| FieldAnalyzer × 3 | 0 | $0 | $0 |
| SelectionBuilder × 3 (Sonnet) | ~6k | $0.06 | $1.80 |
| AnalyseWriter × 3 (Haiku) | ~3k | $0.015 | $0.45 |
| QualityValidator × 3 | 0 | $0 | $0 |
| **TOTAL** | **~10k** | **~$0.09** | **~$2.70** |

Très abordable. À comparer au temps gagné par Stéphane (~10-15 min/jour =
5-7h/mois économisées).

## 🚦 Phases d'implémentation

### ✅ Phase 1 — Fondations (TERMINÉ, ce commit)

- Structure de dossiers `lib/ai-pronostics/`
- Types TypeScript complets
- Helper claude-client (retry, JSON parsing)
- 5 stubs d'agents avec TODO détaillés
- Director stub avec workflow commenté
- Endpoint `/api/cron/ia-pronostics-v2` (désactivé en pratique car les agents
  ne sont pas encore implémentés)
- Cette doc

### 📋 Phase 2 — Implémentation agents (3-4h, à faire)

Implémenter les TODO de chaque agent dans l'ordre :
1. FieldAnalyzer (le plus simple, déterministe, base de données)
2. QualityValidator (déterministe, validation)
3. AnalyseWriter (Haiku, simple prompt rédaction)
4. SelectionBuilder (Sonnet, plus complexe)
5. CourseSelector (Sonnet, le plus complexe — sélection multi-critères)

Pour chaque agent :
- Implémenter la fonction principale
- Écrire un test unitaire (peut être simple : input fixture → output attendu)
- Tester via curl `/api/cron/ia-pronostics-v2?dry_run=1`

### 📋 Phase 3 — Production + monitoring (2-3h, à faire)

- Activer le cron Cloudflare à 4h Paris
- Désactiver l'ancien cron `ia-pronostics`
- Slack notification après chaque run (success + erreurs)
- Page admin `/admin/pronostics/ai-review` pour valider/éditer les drafts
- Monitoring coûts API (alerter si dépasse $5/mois)

## 🔧 Tester en local (après Phase 2)

```bash
# Dry-run : exécute les agents mais n'insert PAS en BDD
curl https://www.elite-turf.fr/api/cron/ia-pronostics-v2?dry_run=1 \
  -H "Authorization: Bearer $CRON_SECRET"

# Run réel (insert publie=false)
curl https://www.elite-turf.fr/api/cron/ia-pronostics-v2 \
  -H "Authorization: Bearer $CRON_SECRET"

# Force une date spécifique
curl "https://www.elite-turf.fr/api/cron/ia-pronostics-v2?date=2026-05-13" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 🔄 Migration depuis l'ancien cron

1. Phase 2 + 3 terminées et testées en dry-run pendant 7 jours
2. Comparer manuellement les sélections IA-v2 vs IA-v1 vs sélections expertes
3. Si v2 > v1 sur la qualité éditoriale → bascule :
   - Désactiver cron `ia-pronostics` dans wrangler/cron-triggers
   - Activer cron `ia-pronostics-v2`
4. Garder l'ancien code 1 mois pour rollback safe, puis supprimer

## 📚 Références

- **Pattern Director + Workers** : inspiré de l'architecture Anthropic
  Computer Use + adaptations multi-agents (cf. blog post Anthropic 2024)
- **Pas de framework Mastra.ai** : décision pour rester léger Cloudflare
  Workers + contrôle des coûts API
- **stats enrichies réutilisées** : `lib/courses/getCourseStatsEnrichies.ts`
  (déjà construit pour la section Statistiques de page course)
