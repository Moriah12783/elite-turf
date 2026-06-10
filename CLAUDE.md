# Elite Turf — Guide projet (CLAUDE.md)

Plateforme de pronostics hippiques premium — **elite-turf.fr**. Marché : Afrique francophone + France/Maghreb (GA : France #1, Maroc #2, Mali/Burkina forts).

## Stack
- **Next.js 14.2.5** (App Router) · React 18 · TypeScript 5 (strict)
- **Supabase** (Postgres + Auth, projet `cpzjjnmszbyizeqhgrat`) — `lib/supabase/server.ts` : `createClient()` (RLS) / `createServiceClient()` (service role, serveur uniquement)
- Tailwind CSS · Resend (email) · Twilio (SMS) · WhatsApp Cloud API
- **Déploiement Cloudflare** (OpenNext) via CI GitHub sur `main` + **cron-worker/** séparé (Cloudflare Worker, triggers dans son `wrangler.toml`, auto-déployé via GitHub Action sur modif `cron-worker/**`)

## Commandes
```bash
npm run dev          # dev server
npx tsc --noEmit     # type-check
npm run build        # next build (~989 pages) — GATE PRINCIPAL
npm run lint         # next lint (.eslintrc.json : next/core-web-vitals)
npx vitest run       # tests (lib/**/*.test.ts)
```
**Gate qualité avant tout commit : `tsc` + `build` verts (+ vitest si lib/ touché).**

## ⚠️ Sources de vérité (NE JAMAIS re-coder ces valeurs en dur)
| Fichier | Rôle |
|---|---|
| `lib/constants/whatsapp.ts` | Numéro WhatsApp support UNIQUE (+33 6 44 68 67 20) — `whatsappUrl(message?)` |
| `lib/pricing.ts` | Copy marketing des offres. **Starter = « 1 pronostic expert par jour (Tiercé/Quarté+) »** |
| `lib/stats/home-stats.ts` | Stats home (`getHomeStats()`, SSR) — consommé par la home ET `/api/stats` |
| `lib/metrics/public-counters.ts` | Compteurs publics RÉELS (leads/profiles) — preuve sociale |
| `types/index.ts` (`PLAN_CONFIG`) | Structure des plans (prix, durées, features) |

## 🔒 Règles non négociables
1. **Paiement intouchable** sans QA dédiée : `app/api/paystack/*`, `app/api/paiement/stripe/*`, `app/api/cinetpay/*`, webhooks, pages `paiement/succes|echec`.
2. **Aucune donnée inventée** sur le site (audits Sprint 1 & 1.5) : pas de chiffres marketing en dur, pas de témoignages fabriqués, pas de promesse non tenable. Compteurs → `public-counters` ; stats → `home-stats` ; témoignages → table `testimonials` (modérés, affichés seulement si `approved`, avec disclaimer).
3. **Jamais de fetch client pour des données critiques d'affichage** (le hero a déjà cassé comme ça) : SSR + prop, fallback chiffré, jamais « … ».
4. **Aucun envoi marketing automatique** (email/SMS/WABA) sans décision humaine. Séquence de réactivation : templates `lib/email/templates/reactivation-r*.ts` + `scripts/export-reactivation-list.ts` (dry-run) — l'envoi est manuel.
5. Promesse support officielle : « **sous 2h en moyenne** » (pas de « 20/30 min »).

## Base de données (Supabase)
- **Migrations dans `supabase/migrations/`, appliquées À LA MAIN** (MCP Supabase ou SQL Editor) — pas de migration auto en CI. Toujours : fichier versionné + application manuelle + vérification.
- ⚠️ Le trigger `handle_new_user` (profil auto à l'inscription) a déjà divergé du fichier de migration — en cas de doute, vérifier en base : `SELECT pg_get_functiondef('public.handle_new_user'::regproc);`
- Tables clés : `profiles` (consentements `sms_opt_in/sms_opted_out/email_opted_out` + `sms_unsub_token` → page `/stop` = opt-out SMS+email), `pronostics`, `courses`, `partants`, `leads`, `transactions`, `sms_log`, `email_sent_log`, `testimonials`, `whatsapp_conversations`.

## Particularités à connaître
- **Deux** `WhatsAppFloatingButton` montés (root layout → `components/layout/`, layout public → `components/public/`) — les deux consomment la constante unique.
- ISR : home `revalidate=60` ; `/api/stats` cache CDN 30 min. Après deploy, ~1-2 min (ou purge Cloudflare) pour voir un changement.
- Heures : les crons Cloudflare sont en **UTC fixe** ; la fenêtre de publication annoncée est **8h30–9h30 GMT** (= heure Abidjan/Dakar).
- Emails : Resend (`lib/email/index.ts`, sandbox si clé absente) ; idempotence des séquences via `email_sent_log` / `sms_log` (UNIQUE user_id+type).
- ESLint : config minimale `next/core-web-vitals` ; `react/no-unescaped-entities` et `@typescript-eslint/no-explicit-any` désactivées (choix documenté : contenu FR plein d'apostrophes ; codebase utilise `any` aux frontières Supabase).
- Scripts CLI : `npx tsx scripts/<nom>.ts` (chargement manuel de `.env.local`, voir `send-test-email.ts`).
- Garantie commerciale active : « **1ᵉʳ pronostic expert perdant = 7 jours offerts** » (1×/abonné, via WhatsApp, prolongation manuelle admin) — affichée home + FAQ /abonnements.

## Process de travail attendu
Audit lecture seule → questions si donnée métier inconnue (**jamais d'invention**) → implémentation par commits atomiques (conventional commits) → gate tsc+build → diff + impact montrés → validation humaine → push/merge uniquement sur GO explicite.
