# Audit Sprint 1.5 — Elite Turf · « Intégrité de la preuve sociale »

> **Phase 1 — lecture seule** (aucune modification). Branche `fix/sprint15-social-proof-integrity` (base `aae7514` = Sprint 1 mergé).
> Méthode : 6 investigations parallèles read-only. Chiffres business de référence : **78 leads · 59 inscrits · 1 abonné payant**.

---

## A · Preuve sociale NON vérifiable — inventaire exhaustif

### A1. Les 6 témoignages avec gains chiffrés
**Source unique : `components/home/TestimonialsSection.tsx:6-102`** — rendus **uniquement sur la home** (`app/(public)/page.tsx:113`). Vérifié : PAS dupliqués sur les 10 landing pays (`GeoLandingPage.tsx` ne les importe pas), PAS dans les OG/metadata, PAS dans les seeds SQL consommés.

| Nom | Pays | Pack | Gain affiché | Claim notable |
|---|---|---|---|---|
| Kouassi A. | 🇨🇮 | Pro | **+1 850€** (1 213 000 FCFA) | conversion FCFA précise |
| Mamadou D. | 🇸🇳 | Elite | **+3 200€** | « 4 mois d'abonnement », « service exceptionnel » |
| Jean-Baptiste O. | 🇫🇷 | Pro | **+680€** | ⚠️ « Le support WhatsApp répond en **moins de 20 min** » |
| F. Konaté | 🇨🇮 | Starter | **+430€** | « le plan se rembourse en une seule course ! » |
| Ibrahim T. | 🇲🇦 | Elite | **+4 800€** | « mon plus grand gain au turf » |
| Brice N. | 🇨🇮 | Pro | **+1 950€** | « 3 Tiercés gagnants consécutifs », « ROI exceptionnel » |

🔴 **Risque** : gains chiffrés, identités, dates, FCFA — **invérifiables** (1 seul abonné payant réel). Aucun disclaimer. Exposition DGCCRF (pratique commerciale trompeuse) + blocage certification Google Ads jeux d'argent.

### A2. Agrégats & claims non sourcés (toutes surfaces)

| # | Claim | Localisation(s) | Reco |
|---|---|---|---|
| 1 | « **180 000€+** gains cumulés abonnés » | TestimonialsSection:111 | **Supprimer** (incalculable, aucune table source) |
| 2 | « **4.8 / 5** note moyenne » | TestimonialsSection:112 | **Supprimer** sauf source réelle (→ Q3) |
| 3 | « font perdre **80% des parieurs** » | GuideBlocSection:11 | **Reformuler** sans chiffre (« la majorité des parieurs jouent sans méthode ») |
| 4 | « **5 ans** d'expertise » | HeroSection:56 · WhyChooseUsSection:14 · **methodologie:58,121,317** (×3) | **Clarifier** (→ Q1) : ancienneté du fondateur ≠ ancienneté du service (lancé ~mars 2026) |
| 5 | Promesses support **contradictoires** : « 20 min » (témoignage + email welcome-j7:58) · « 30 min » (abonnements:187,587 + email confirmation-pack:319) · « **sous 2h en moyenne** » (FAQ abonnements) | 5 fichiers | **Harmoniser** sur une seule formulation prudente — la FAQ (« sous 2h en moyenne ») est la plus défendable |
| 6 | Fallback `StatsSection.tsx:67-73` : 5 résultats **fictifs datés « 25-29 Mars »** (+380%, +127%…) si la requête échoue | StatsSection | **Remplacer** par un état honnête (« résultats en cours de chargement » / rien) — des dates figées de mars trahissent le factice |
| 7 | CTA « Partagez votre gain » + incentive « mois offert » | TestimonialsSection:212-229 | **Reformuler** (→ Lot 2) : témoignage d'expérience (pas de « gain »), conditions claires |

✅ **Bonne nouvelle** : « 847 » a bien disparu (Sprint 1) ; les montants/noms sont **mono-sources** (TestimonialsSection uniquement) → le retrait est chirurgical. Les emails ne contiennent PAS de témoignages, seulement les promesses « 20/30 min » (2 templates).

---

## B · Ce qu'on possède de VRAI (actifs de confiance)

### B1. Données Performances (table `pronostics`)
Stats **honnêtes calculables en temps réel** (colonnes `resultat`, `rapport_gagnant`, `gains_theoriques`, `date_publication`, `publie`, `type_pari`, `niveau_acces`) :
- **Taux de réussite global** + taux du mois + série en cours + total gagnants (déjà sur /performances, 4 KPI cards)
- **Répartition** gagnant/partiel/perdant · taux **par type de pari** · top **hippodromes**
- Nb **pronostics publiés** (horodatage `date_publication` infalsifiable = publié AVANT course)
- ROI : ⚠️ fiable **seulement si** `rapport_gagnant` renseigné — `computeRecentPerf` retourne déjà `roi=null` sinon (pattern à conserver)
- **Lien Geny par ligne** du tableau historique = vérifiabilité externe (déjà en place)

### B2. Garanties réelles (formulations exactes, FAQ /abonnements)
- Remboursement : « *problème technique majeur dans les 24h suivant votre paiement → remboursement intégral sous 48h ouvrées* »
- « *annuler à tout moment… **aucun renouvellement automatique** sans confirmation explicite* »
- Activation : « *immédiatement après confirmation du paiement* »
- Transparence : résultats publiés victoires ET défaites (/performances, aucun cherry-picking)

### B3. Méthodologie (`/methodologie` — existe, riche)
Page E-E-A-T complète : 5 piliers (sources officielles → analyse 30+ critères → validation humaine → publication horodatée → vérifiabilité totale) + FAQ JSON-LD qui annonce un **taux honnête « 30-40% »**. **Réutilisable** comme mini-bloc de confiance sur la home avec lien vers la page.

---

## C · Mécanisme témoignages réels — conception

**Constat infra** : admin riche existant (`app/(admin)/admin/*`, 15 modules), layout protégé (session + `profiles.role==='ADMin'` via service client), pattern mutation = **route API `/api/admin/...` + `createServiceClient()` + `revalidatePath`** (ex. `api/admin/courses/[id]`), helper `requireAdminAuth` dispo pour les routes sensibles. Aucune table témoignages existante.

**Architecture proposée (Lot 3)** :
1. **Migration `testimonials`** (conventions du repo : header commenté, `gen_random_uuid()`, CHECK, index, RLS service_role only) :
   `id, nom_affiche, ville, pays, pack (CHECK Starter/Pro/Elite), texte, note (1-5, nullable), preuve_url (nullable), statut (CHECK 'pending'/'approved'/'rejected', défaut pending), source (CHECK 'whatsapp'/'formulaire'/'email'), created_at, approved_at`
2. **Affichage conditionnel** : `TestimonialsSection` requête `statut='approved'` → **section entièrement masquée si 0 approved** (le bloc « Preuve par les résultats » du Lot 2 prend la place dans tous les cas).
3. **Saisie admin** : page `admin/temoignages` minimale (liste pending/approved + formulaire d'ajout + boutons approve/reject), calquée sur le pattern notifications. Collecte réelle = via WhatsApp (CTA reformulé) → saisie manuelle admin.
4. Tout témoignage approuvé s'affiche avec le **disclaimer global** (« résultats individuels, non garantis — le jeu comporte des risques »).

---

## D · Séquence de réactivation des 59 inscrits — conception

**Constat infra** :
- **Email = Resend** (`lib/email/index.ts`, FROM noreply@elite-turf.fr) · **16 templates existants** dont la welcome series J1/J3/J7 orchestrée par cron avec **idempotence `email_sent_log` (UNIQUE user_id+type)** — patron parfait à réutiliser.
- ⚠️ **Trou de consentement email** : `profiles` a `sms_opt_in/sms_opted_out/sms_unsub_token` mais **AUCUNE colonne email** (pas d'opt-out email, pas de lien de désinscription dans le footer email). `leads` est minimaliste (prenom, email, source) sans consentement.
- **WABA** : `lib/whatsapp/client.ts` (`sendTemplate`) prêt, mais **aucun template Meta documenté** dans le repo ; Phase A = logging only.
- **Scripts CLI** : pattern `npx tsx scripts/*.ts` établi (send-test-email.ts charge .env.local manuellement) → modèle pour `export-reactivation-list.ts`.
- **Requête des éligibles** : `profiles WHERE statut_abonnement IN ('GRATUIT','EXPIRE')` (+ exclusion opt-out).

**Séquence proposée (Lot 4 — préparée, JAMAIS envoyée)** :
| Msg | Timing | Contenu | Lien |
|---|---|---|---|
| R1 « Valeur » | J0 | Notre sélection gratuite du jour + comment la lire | /programme + /performances |
| R2 « Preuve » | J+3 | Bilan transparent de la semaine (chiffres réels `computeRecentPerf` — pas d'envoi si 0 gagnant) | /performances |
| R3 « Essai » | J+7 | Pack Starter 7 jours (« 1 pronostic expert par jour ») + garanties réelles | /abonnements |

**Pré-requis propreté inclus au Lot 4** : migration `email_opt_in` (défaut TRUE) + `email_opted_out` + réutilisation du token `sms_unsub_token` → renommé d'usage en page `/stop` déjà existante (1 lien de désinscription unique SMS+email) **OU** colonne dédiée — à trancher à l'implémentation ; lien désinscription ajouté au footer des 3 templates. Script `scripts/export-reactivation-list.ts` **dry-run par défaut** (CSV : email, nom, pays, date_inscription, consentements). Si Q4 = WhatsApp aussi : corps des templates WABA rédigés dans `docs/waba-templates.md` pour soumission Meta (aucun appel API).

---

## E · Hygiène repo

- **ESLint** : deps **déjà installées** (`eslint ^8`, `eslint-config-next 14.2.5`) — il ne manque QUE le fichier de config. Proposition : `.eslintrc.json` = `{ "extends": "next/core-web-vitals" }` (zéro règle exotique). `next lint` devient non-interactif.
- **CLAUDE.md** : absent — contenu proposé : stack (Next 14.2.5/React 18/Supabase/Cloudflare), commandes (`dev/build/start/lint/test` — **vitest existe déjà** : 15+ fichiers de tests `lib/**/*.test.ts`), les 4 sources de vérité Sprint 1 (+ celles de ce sprint), règle « paiement intouchable », migrations appliquées **à la main** (MCP/Dashboard), gate qualité tsc+build, particularités (2 WhatsAppFloatingButton, ISR home 60s, cron-worker auto-déployé, images unoptimized).
- Découverte bonus : `husky` est dans package.json (`prepare`) — hooks à vérifier/documenter.

---

## ❓ Questions obligatoires (réponses requises avant Phase 2)

1. **« 5 ans d'expertise »** : quelle est la vraie ancienneté à afficher ? (expertise personnelle du fondateur ≠ ancienneté du service — proposition : « *Notre fondateur analyse les courses PMU depuis N ans* »)
2. **Garantie remboursement** : on garde « 24h technique / remboursement 48h ouvrées » tel quel, ou tu veux l'élargir (ex. « 1er pronostic perdant = 7 jours offerts ») comme substitut de preuve sociale ?
3. **Note « 4.8/5 »** : existe-t-il une source réelle (avis Google/Trustpilot/autre) ? Sinon → suppression.
4. **Réactivation des 59** : canal **email seul**, ou **email + WhatsApp (WABA)** ?

## Plan Phase 2 (après réponses + GO)
Lot 1 `content:` retrait preuve inventée (témoignages, 180k, 4.8, 80%, harmonisation support, fallback StatsSection) → Lot 2 `feat:` bloc « La preuve par les résultats » (stats réelles SSR + garanties + méthodologie + CTA expérience) → Lot 3 `feat:` mécanisme témoignages (table + affichage conditionnel + admin) → Lot 4 `feat:` séquence réactivation (templates + consentement email + export dry-run) → Lot 5 `chore:` ESLint + CLAUDE.md.
Gate par lot : `tsc --noEmit` + `next build` (+ `npm run test` — vitest dispo). Diff + impact avant chaque commit.

**⛔ STOP — en attente des réponses Q1-Q4 et du GO.**
