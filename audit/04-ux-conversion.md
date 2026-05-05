# 04 — UX & conversion (CRO)

## Données de funnel actuelles (30 derniers jours)

```
Leads (guide gratuit)        : 17
Profiles inscrits (auth)     : ~5 (delta sur 30j approximatif)
Transactions tentées         : 9
Transactions SUCCES          : 0
Abonnés actifs (snapshot)    : 3 / 22 inscrits = 13,6 %
```

**Constat #1** : le funnel se vide spectaculairement entre l'intention de paiement et la conversion. **9 EN_ATTENTE / 0 SUCCES sur 30 jours.**

## 🚨 Funnel paiement cassé

[`app/api/paiement/webhook/route.ts`](../app/api/paiement/webhook/route.ts) traite les webhooks CinetPay :

```ts
// Ligne 11
const body = await req.json();
const { cpm_trans_id } = body;
// ❌ Aucune vérification de signature HMAC CinetPay
// ❌ Aucune idempotence (table webhook_events absente)

// Ligne 19 — re-check via API CinetPay (bonne pratique)
const checkRes = await fetch(CINETPAY_CHECK_URL, { ... });
// Mais si checkRes échoue silencieusement, la transaction reste EN_ATTENTE pour toujours
```

Hypothèses sur les 9 EN_ATTENTE non finalisés :
1. **Le webhook n'est pas configuré côté CinetPay** sur le bon URL après migration Cloudflare. Le user paie, CinetPay ne notifie pas, la transaction reste EN_ATTENTE.
2. **Le checkRes timeout** sur Cloudflare Worker (limite ~30 s) → réponse 500 au webhook → CinetPay arrête de retry.
3. **Le user abandonne** avant de valider le mobile money. Mais alors on devrait avoir des retries CinetPay vers ECHEC.

**Action urgente** :
1. Logger en DB chaque webhook reçu (table `webhook_events`).
2. Tester un paiement complet en mode sandbox CinetPay → vérifier que le webhook arrive bien.
3. Vérifier le `notify_url` configuré dans le code [`app/api/paiement/initier/route.ts`](../app/api/paiement/initier/route.ts) : pointe-t-il vers la bonne URL prod ?

## UX : parcours visiteur → abonné

### Page d'accueil (audit heuristique)

[`app/(public)/page.tsx`](../app/(public)/page.tsx) : structure très complète, on voit que l'auteur a réfléchi à la conversion. Sections :
1. Hero (clarté + 2 CTAs)
2. WhyChooseUs
3. Courses à venir (preuve)
4. Pronostics (preuve)
5. Stats (preuve)
6. Pricing
7. OperateursANJ (réassurance)
8. Testimonials
9. FAQ (8 questions)
10. GuideBloc (lead magnet)
11. HowItWorks

**Bonnes pratiques présentes** :
- ✅ Lead magnet (guide gratuit) → 25 leads en 30 j (relativement OK).
- ✅ FAQ complète + JSON-LD.
- ✅ Mention paiement Orange Money / MTN / Wave dès le hero.
- ✅ Testimonials.

**Manquants** :
- ❌ Pas de **preuve quantitative live** : « ROI cumulé : +XX % » avec graphique. La page Performances existe mais le hero n'en parle pas.
- ❌ Pas de **scarcity** : « Pronostic Quinté+ du jour publié dans 2 h 13 ».
- ❌ Pas d'**exit intent popup** ou de capture mail au scroll 75 %.
- ❌ Pas de **chat live** ou WhatsApp button (pourtant on a `NEXT_PUBLIC_WHATSAPP` dans l'env).

### Page abonnements

[`app/(public)/abonnements/page.tsx`](../app/(public)/abonnements/page.tsx) : 166 KB HTML, charge rapide (0,36 s). Mais funnel paiement cassé en aval.

Vérifier visuellement (capture d'écran à faire après l'audit) :
- 3 plans en parallèle (STARTER, PRO, ELITE) ?
- Mention « Sans engagement » ?
- Comparatif features ?
- Prix en EUR + FCFA équivalent ?
- Choix opérateur mobile money + Stripe en parallèle ?

### Paywall sur fiches course

Audit code : [`components/courses/CourseTabsClient.tsx:135-189`](../components/courses/CourseTabsClient.tsx#L135) — quand `isVedette && !isSubscribed`, on affiche un aperçu blurry + CTA `S'abonner dès 65 €`. Bon pattern.

**À améliorer** :
- Le bouton CTA pointe vers `/abonnements` (page tarifs). Conversion généralement meilleure si on pointe vers une **page de checkout one-click** spécifique au plan le plus populaire.
- Pas de **« 7 jours gratuits »** ou trial. Important sur un produit où la confiance se construit.

## Notifications OneSignal

Tables :
- `notifications` : 2 lignes seulement.
- Volume push réel sur 30 j inconnu (cf [OneSignal dashboard](https://app.onesignal.com)).

**Question critique** : combien d'utilisateurs ont opté in pour les notifs push ? Si <30 %, le canal est sous-exploité. Si >70 %, super, et la fréquence d'envoi devient le levier.

**Recommandations** :
- Push **avant chaque réunion** (heure -1 h) pour les abonnés : « Quinté+ Vincennes dans 1 h — Pronostic disponible ».
- Push **après chaque arrivée** : « Notre pronostic Quinté+ est tombé : 4-9-12-7-1. Voir les rapports ».
- Push **récupération** : « Tu as commencé un paiement il y a 1 h. Finalise en 30 secondes ».

## Mobile-first

Site déclare `viewport: { width: "device-width", initialScale: 1 }` dans [`app/layout.tsx:13`](../app/layout.tsx#L13). Bon.

Mesure capture mobile (à faire dans Chrome DevTools mobile emulation) :
- Tap targets ≥ 48 px ?
- Scroll horizontal sur tableaux ?
- Bottom sticky CTA présent ?

[`components/mobile/StickyMobileCTA.tsx`](../components/mobile/StickyMobileCTA.tsx) (probable) — à vérifier qu'il s'affiche bien et n'occlut pas le contenu.

## Accessibilité (WCAG 2.1 AA)

Mesure non faite (axe à approfondir avec axe DevTools).

Points à vérifier en priorité :
- Contraste du gold-light sur bg-primary (#C9A84C sur fond sombre) → probablement OK mais à mesurer.
- Labels sur tous les `<input>` et `<button>` icon-only (lucide-react icons).
- Hiérarchie sémantique `<h1>`-`<h6>` cohérente.
- Navigation clavier : focus visible (Tailwind `focus:` styles ?).
- Lecteur d'écran : `aria-label` sur les CTAs avec emoji/icon seulement.

## Recommandations

| # | Reco | Effort | Impact conversion |
|---|---|---|---|
| 1 | **Réparer webhook CinetPay** (signature + idempotence + logs) | 1 j | ★★★★★ (déblocage business) |
| 2 | Page checkout dédiée par plan + paiement one-click | 2 j | ★★★★ |
| 3 | Trial 7 jours gratuit (PRO) | 1 j | ★★★★ |
| 4 | Push abandon panier 1 h (paiement EN_ATTENTE > 1 h) | 1 j | ★★★ |
| 5 | Hero : ROI cumulé live (calculé from `pronostics.gains_theoriques`) | 1 j | ★★★ |
| 6 | Compteur countdown sur prochaine publication pronostic | 4 h | ★★ |
| 7 | Sticky WhatsApp button (utilisé en CI/Sénégal) | 4 h | ★★★ |
| 8 | Audit a11y axe-core + corrections | 1 j | ★★ |
| 9 | A/B test plan « PRO » par défaut « le plus populaire » | 1 j | ★★ |
| 10 | Email post-inscription : 7 jours de coaching gratuit | 1 j | ★★★ |
