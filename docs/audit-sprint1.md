# Audit Sprint 1 — Elite Turf · « Réparer la confiance »

> **Phase 1 — Audit en lecture seule.** Aucune modification de code n'a été faite.
> Branche : `fix/sprint1-trust-repairs`. Méthode : 8 investigations parallèles (agents read-only `Explore`).
> Note : pas de `CLAUDE.md` / `CLAUDE.local.md` à la racine du repo (absents). Principes appliqués : skill *elite-turf-premium-engineer* (source unique, contrats propres, data fiable).

## Synthèse

| # | Problème | Sévérité | Effort | Bloquant Phase 2 |
|---|---|---|---|---|
| P1 | Compteurs hero affichent « … » (fetch client silencieux) | 🔴 Critique | ~30 min | non |
| P2 | 3 versions contradictoires de l'offre Starter | 🔴 Critique | ~2-3 h | ❓ **Question** |
| P3 | 2 numéros WhatsApp en conflit (~15 fichiers) | 🔴 Critique | ~2-3 h | ❓ **Question** |
| P4 | 4 liens sociaux morts (`href="#"`) footer + emails | 🟠 Majeur | ~5 min | non |
| P5 | « 847 » dupliqué sur 5 emplacements | 🟠 Majeur | ~2 h | ❓ **Question** |
| P6 | SEO /abonnements : title doublé + 2 blocs FAQ | 🟡 Mineur | ~15 min | non |
| P7 | « Vedette du Jour » : état basé sur l'heure (Paris) pas la donnée | 🟡 Mineur | ~3-4 h | non |
| Bonus | Témoignages sans disclaimer + valeurs en dur | ⚪ Signalé | — | sprint conformité |

---

## P1 · Compteurs de crédibilité vides (CRITIQUE)

**Fichiers**
- `components/home/HeroSection.tsx` — ligne 1 (`"use client"`), 49-54 (`fetch("/api/stats").catch(() => {})` silencieux), 62-66 / 73-77 / 91-97 (affichent `…` quand `liveStats === null`)
- `components/home/StatsSection.tsx` — ligne 17 (async server component), 112-114 (fallbacks chiffrés `68% / 79% / 120+ / 82+` → n'affiche **jamais** « … »)
- `app/api/stats/route.ts` — `revalidate=1800` (ISR correct) mais dépend du fetch client
- `app/(public)/page.tsx` — l.82 HeroSection (client, échoue) / l.83 StatsSection (server, OK)

**Cause racine** — Architecture asymétrique. Le **hero** est un composant client qui fetch `/api/stats` en `useEffect` avec un `.catch(() => {})` **silencieux** et un placeholder `…`. Le bloc « Nos Résultats Prouvés » plus bas est un **server component** qui requête Supabase directement avec fallbacks. Sur Cloudflare (latence Afrique / limite CPU), le fetch client échoue → `…` reste affiché indéfiniment.

**Correctif proposé** — Convertir HeroSection au même pattern que StatsSection : retirer `"use client"`, remplacer le `useEffect/fetch` par une **requête Supabase côté serveur** (ou réutiliser `computeRecentPerf` / la logique de `/api/stats`), et **toujours fournir un fallback chiffré** (jamais « … »). ISR via `export const revalidate`. Les animations parallax éventuelles peuvent être isolées dans un petit wrapper client.

**Risque de régression** — Faible. StatsSection prouve que le pattern server marche déjà ; `page.tsx` est déjà en ISR.

**Effort** — ~30 min.

---

## P2 · Trois versions contradictoires de l'offre Starter (CRITIQUE) ❓

**Fichiers / occurrences**
- `types/index.ts:218-220` — **PLAN_CONFIG (autorité actuelle du code)** : « 1 pronostic expert par jour (Tiercé / Quarté+) » sur 7 jours
- `components/home/FAQSection.tsx:28` — « Le Pack Starter donne accès à **7 pronostics/semaine** »
- `app/(public)/abonnements/page.tsx:556` — tableau comparatif : Starter = « **7 / semaine** »
- `supabase/migrations/001_initial_schema.sql:166-168` — seed DB **legacy** : « **3 pronostics** Tiercé/semaine » (historique, non consommé par l'app)
- `docs/superpowers/specs/2026-06-01-...md:34` — spec mentionne « 3 pronostics »

**Cause racine** — Pas de source unique. Le repositionnement récent (PLAN_CONFIG → « 1/jour ») n'a pas propagé : la FAQ home et le tableau /abonnements disent encore « 7/semaine », le seed DB dit « 3/semaine ». *Note : « 1 par jour sur 7 j » et « 7/semaine » décrivent en fait la même offre — c'est surtout le « 3/semaine » qui contredit, + un wording à uniformiser.*

**Correctif proposé** — Centraliser dans **`lib/pricing.ts`** (source de vérité : features + libellés courts par plan), consommé par FAQSection, le tableau /abonnements, PricingSection, et toute metadata. PLAN_CONFIG (`types/index.ts`) référence ce fichier. **Ne pas modifier la migration SQL** (historique, déjà déployée). Optionnel : test de cohérence en CI.

**Risque de régression** — Moyen-élevé (messaging commercial + légal). Déployer avec QA des 3 vues (home / /abonnements / checkout).

**Effort** — ~2-3 h. **⛔ Bloqué sur ta réponse (voir Questions).**

---

## P3 · Deux numéros WhatsApp en conflit (CRITIQUE) ❓

**Fichiers (extrait — ~15 occurrences au total)**
- `.env.local.example:49` — `NEXT_PUBLIC_WHATSAPP=+33644686720` (legacy)
- `components/public/WhatsAppFloatingButton.tsx:17` — `'33644696806'` (WABA prod, en dur)
- `components/layout/WhatsAppFloatingButton.tsx:20-23` + `components/layout/Footer.tsx:8-11` — logique conditionnelle `NEXT_PUBLIC_USE_WABA_API_NUMBER` (644696806 vs 644686720)
- `app/layout.tsx:131` — JSON-LD `contactPoint` : `+33644686720` en dur
- **wa.me/+33644686720 codé en dur** dans : `components/home/FAQSection.tsx:85`, `TestimonialsSection.tsx:216`, `app/(public)/mentions-legales:55`, `paiement/echec:62`, `paiement/succes:206`, `espace-membre:635`, `contact:37`, `abonnements:614`, `lib/email/templates/confirmation-pack.ts:319`, `welcome-series-j7.ts:58`, `components/membre/TransactionsHistory.tsx:151`

**Cause racine** — Deux composants `WhatsAppFloatingButton` (un dans `components/public/`, un dans `components/layout/`) + numéro legacy `644686720` codé en dur partout, alors que le widget pointe vers le WABA prod `644696806`. Aucune constante unique.

**Correctif proposé** — Constante/​helper unique **`lib/constants/whatsapp.ts`** : `getWhatsAppNumber()` + `getWhatsAppUrl(message?)`, pilotés par le flag `NEXT_PUBLIC_USE_WABA_API_NUMBER`. Remplacer **toutes** les occurrences (composants, pages, templates email, JSON-LD). Vérifier s'il faut **dédupliquer** les 2 composants flottants.

**Risque de régression** — Moyen-élevé (routage client + rendu emails server-side). QA de tous les liens `wa.me` en mode WABA et legacy.

**Effort** — ~2-3 h. **⛔ Bloqué sur ta réponse (voir Questions).**

---

## P4 · Liens sociaux morts dans le footer (MAJEUR)

**Fichiers**
- `components/layout/Footer.tsx:205-236` — 4 `<a href="#">` (Facebook 207, YouTube 214, TikTok 222, X 229) + texte « Retrouvez-nous bientôt sur les réseaux sociaux » (236)
- `lib/email/base.ts:72-87`, `app/api/guide/telechargement/route.ts:178-193`, `lib/email/templates/newsletter.ts` — mêmes liens morts dans les templates email

**Cause racine** — Comptes sociaux inexistants, mais présentés comme cliquables (`#`) → signal « site inachevé ».

**Correctif proposé** — **Supprimer le bloc entier** (footer + 3 templates email). Réintroduire plus tard via variables d'env (`NEXT_PUBLIC_FACEBOOK_URL`…) quand les comptes existent.

**Risque de régression** — Faible (suppression d'UI non fonctionnelle).

**Effort** — ~5 min.

---

## P5 · Chiffre « 847 » dupliqué (MAJEUR) ❓

**Fichiers / occurrences (5, pas 2)**
- `components/home/TestimonialsSection.tsx:106` — « 847+ » Abonnés satisfaits
- `components/home/GuideBlocSection.tsx:45` — « 847 parieurs francophones » · `:115` — « 847 téléchargements »
- `app/(public)/guide-initie/page.tsx:83` — « 847+ parieurs formés »
- `app/(public)/performances/page.tsx:680` — « 847+ turfistes »

**Cause racine** — Placeholder statique jamais branché sur la donnée réelle. **L'infra existe** : table `leads` (téléchargements guide, `source='guide-gratuit'`) + pattern de comptage déjà utilisé dans `app/api/newsletter/counts/route.ts:20-40`.

**Correctif proposé** — Utilitaire serveur (ex. `lib/metrics/getDashboardStats.ts`) : `COUNT(leads WHERE source='guide-gratuit')` (téléchargements) + `COUNT(profiles WHERE statut_abonnement IN STARTER/PRO/ELITE)` (abonnés). Brancher les 5 emplacements, avec cache ISR. **Différencier** les deux métriques (abonnés ≠ téléchargements).

**Risque de régression** — Faible (remplace des placeholders par du réel).

**Effort** — ~2 h. **⛔ Question : vrais chiffres OU brancher au réel ?**

---

## P6 · Pollution SEO sur /abonnements (MINEUR)

**Fichiers**
- `app/(public)/abonnements/page.tsx:63` — `title` se termine déjà par « | Elite Turf » alors que…
- `app/layout.tsx:26-29` — …le template racine est `"%s | Elite Turf"` → **suffixe doublé**
- `app/(public)/abonnements/page.tsx` — **2 blocs FAQ** : accordéon manuel (591-606, array `FAQ` 100-129) **+** `FaqSection`/`FaqJsonLd` (625-626, array `ABONNEMENTS_FAQ` 18-54) → **2× JSON-LD `FAQPage`** + questions qui se recoupent
- `components/seo/FaqJsonLd.tsx:66-97` — rend l'accordéon ET injecte le JSON-LD

**Cause racine** — (a) suffixe ajouté manuellement en plus du template. (b) deux sources FAQ rendues à la suite.

**Correctif proposé** — (a) retirer « | Elite Turf » du title page (le template l'ajoute). (b) **fusionner** en un seul array dédupliqué → un seul `FaqSection` + un seul JSON-LD `FAQPage`.

**Risque de régression** — Faible (sortie identique, schema plus propre).

**Effort** — ~15 min.

---

## P7 · « Vedette du Jour » incohérente (MINEUR)

**Fichiers**
- `components/home/PronosticsSection.tsx` — logique CASE A (141-161) / B (163-232, bouton « Pronostic disponible bientôt » l.192) / C (234-378) ; helpers `getNowParisMins()` (26-34), `getTodayParis()` (36-41), `isCourseTerminee()` (46-51)
- `components/home/FAQSection.tsx:8` — annonce « publiés entre 8h30 et 9h30 (heure **GMT**) »
- `lib/paris-date.ts` — `todayParisISO()` (helper robuste **non utilisé** ici)

**Cause racine** — L'état repose sur l'**heure de Paris** (`getNowParisMins`) et le temps écoulé depuis le départ, **pas sur la fenêtre GMT annoncée** ni sur l'état réel de publication. Le message « Pronostic disponible bientôt » (CASE B) persiste après 9h30 GMT car aucune fenêtre temporelle n'est calculée.

**Correctif proposé** — États explicites **basés sur la donnée réelle** (le pronostic existe-t-il publié en base aujourd'hui ?) + un repère **GMT** clair : (1) « Publié — réservé aux abonnés » ; (2) « Publication en cours » (courses du jour, pas encore de prono, dans la fenêtre 8h30-9h30 GMT) ; (3) « Pas de vedette aujourd'hui » (après 9h30 GMT, toujours rien). Réutiliser `lib/paris-date.ts`.

**Risque de régression** — Faible (UX uniquement). Tester le calcul de fenêtre en GMT (pas Europe/Paris → décalage DST).

**Effort** — ~3-4 h.

---

## Bonus (SIGNALÉ uniquement — sprint contenu/conformité, NE PAS corriger maintenant)

- **Conformité témoignages (risque légal ANJ)** — `components/home/TestimonialsSection.tsx:4-101` : 6 témoignages affichent des gains précis (+1 850€, +3 200€, +680€, +430€, +4 800€, +1 950€) **sans aucune mention** « résultat individuel, non garanti / le jeu comporte des risques ». À encadrer (disclaimer global au-dessus de la grille, recommandé).
- **Valeurs en dur à brancher au réel** — `GLOBAL_STATS` (TestimonialsSection:103-107 : « 180 000€+ gains cumulés », « 847+ abonnés ») ; claim non sourcé « 80% des parieurs perdent » (GuideBlocSection:10) ; « 5 ans d'expertise » (HeroSection:84).
- **Note** : les fallbacks chiffrés de `StatsSection.tsx:112-114` (68%/79%/120+/82+) ne sont **pas** un défaut — c'est précisément le pattern « jamais de … » à répliquer en P1.

---

## ❓ Questions pour toi (avant Phase 2)

1. **P2 — Offre Starter officielle** : on garde **« 1 pronostic expert par jour (Tiercé/Quarté+) »** (= version actuelle du code PLAN_CONFIG, cohérente avec le repositionnement) et on supprime les « 7/semaine » et « 3/semaine » ? Ou tu veux un autre wording officiel ?
2. **P3 — Numéro WhatsApp officiel** : lequel est le canal client de prod — **+33 6 44 69 68 06** (644696806, le WABA, vers lequel pointe déjà le widget) ou **+33 6 44 68 67 20** (644686720, le legacy) ? Et on route par défaut vers lequel ?
3. **P5 — Compteurs** : tu me donnes les **vrais chiffres** (abonnés satisfaits / téléchargements guide), ou je **branche au réel** (table `leads` + `profiles`) avec un libellé honnête ?
4. **Bonus conformité** : OK pour traiter les disclaimers témoignages dans un **sprint contenu** séparé (pas dans Sprint 1) ?

---

## Ordre d'exécution Phase 2 (après ton GO)
`P1 → P3 → P2 → P5 → P4 → P6 → P7` · 1 commit atomique/correctif · `npm run build` + lint à chaque étape · diff + impact montrés avant chaque commit · **aucun push/merge sans GO**.

**⛔ STOP — En attente de tes réponses (Q1-Q4) et de ton GO pour la Phase 2.**
