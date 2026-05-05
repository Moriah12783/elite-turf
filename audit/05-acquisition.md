# 05 — Acquisition / growth / trafic

C'est l'axe « comment on remplit le funnel ». Aujourd'hui, Elite Turf reçoit ce que Google veut bien lui envoyer (probablement <1 K visites/mois vu la taille du sitemap). Il faut activer plusieurs leviers en parallèle.

## SEO programmatique : le levier #1

**État actuel** : 40 URLs indexables. Tables `chevaux`, `jockeys`, `entraineurs` **vides** (0 ligne) malgré le schéma déjà créé.

### Pages à créer

| Type de page | URL pattern | Volume | Source data | Effort estim. |
|---|---|---|---|---|
| Programme du jour | `/programme/[YYYY-MM-DD]` | 365/an + historique | `courses` joined `hippodromes` | 1 j |
| Fiche course | `/courses/[date]/[hippodrome]/[ref]` | ~30 K/an | `courses` + `partants` + `arrivees` | 2 j (déjà en partie) |
| Fiche hippodrome | `/hippodromes/[slug]` | 106 | `hippodromes` + agrégats `courses` | 1 j |
| Fiche cheval | `/chevaux/[slug]` | À peupler | À extraire depuis `partants` | 3 j |
| Fiche jockey | `/jockeys/[slug]` | À peupler | À extraire depuis `partants` | 2 j |
| Fiche entraîneur | `/entraineurs/[slug]` | À peupler | À extraire depuis `partants` | 2 j |
| Quinté+ du jour | `/quinte-plus/[date]` | 365/an | `courses` filtré sur `paris_disponibles` ⊃ QUINTE_PLUS | 1 j |
| Arrivée du jour | `/arrivees/[date]` | 365/an | `arrivees` + `courses` | 1 j |
| Pronostic du jour | `/pronostic/[date]` | 365/an | `pronostics` du jour | 1 j |
| Performances cumulées | déjà existant — à enrichir | — | — | — |

**Volume potentiel total à 6 mois** : ~50 000 pages indexables (vs 40 actuelles) — soit **×1 250**.

### Code de référence pour la peuplement automatique

Les chevaux/jockeys/entraîneurs n'ont aujourd'hui pas de table peuplée. Pourtant `partants.jockey` et `partants.entraineur` sont remplis (cf fix Geny). Il faut créer un cron qui upsert depuis `partants` vers `chevaux`, `jockeys`, `entraineurs` :

```ts
// Pseudo-code app/api/cron/peupler-entites/route.ts
const { data: partants } = await supabase
  .from("partants")
  .select("nom_cheval, jockey, entraineur")
  .not("nom_cheval", "is", null);

// Dédupliquer
const chevaux = [...new Set(partants.map(p => p.nom_cheval))];
const jockeys = [...new Set(partants.map(p => p.jockey).filter(Boolean))];
// ...

// Upsert
await supabase.from("chevaux").upsert(chevaux.map(nom => ({ nom, slug: slugify(nom) })));
```

Ensuite, créer pages `/chevaux/[slug]` qui agrègent : courses passées du cheval, ROI Elite Turf si pronostic, performances...

## Réseaux sociaux

Code mentionné dans [`app/layout.tsx:110-113`](../app/layout.tsx#L110) :
```ts
sameAs: [
  "https://www.facebook.com/eliteturf",
  "https://www.youtube.com/@eliteturf",
],
```

À vérifier :
- Le compte Facebook est-il actif ? Combien d'abonnés ? Posts par semaine ?
- Le compte YouTube : vidéos analyses ? Reels Quinté+ du jour ?
- Pas de Twitter/X ? Pas d'Instagram ? Pas de TikTok ?

**Recommandations social** :
- **YouTube** : 1 vidéo analyse Quinté+ par jour (~3 min). Format : « Le Quinté+ du jour décrypté en 3 min ».
- **TikTok / Reels Instagram** : extraits de 30s avec selection. Usage massif en Afrique francophone.
- **WhatsApp Channels** (lancé 2023, énorme adoption en CI/Sénégal) : channel public Elite Turf avec pronostic gratuit du jour.
- **Twitter/X** : signal ROI quotidien après chaque arrivée (« +312 € sur le Quinté+ aujourd'hui »).

## Newsletter & email

[`lib/email/`](../lib/email/) montre qu'il y a déjà des templates Resend. À auditer :
- Welcome series (J0, J1, J3, J7) ? Probablement non.
- Newsletter quotidienne pronostic gratuit ? Voir cron `pronostic-gratuit` qui est en SKIP 13/13 — donc non actif.
- Récupération paiement EN_ATTENTE ? Non.

**Action** :
- Welcome series à activer immédiatement. Template style :
  - J0 : « Bienvenue + le pronostic gratuit du jour ».
  - J1 : « Comment on travaille — méthodologie ».
  - J3 : « ROI public de la semaine + témoignage ».
  - J7 : « Code promo -20 % sur le 1er mois — exclusivité bienvenue ».

## Programme de parrainage

Pas vu dans le code. Énorme levier en Afrique francophone (mode communautaire fort).

**Action MVP** :
- Code parrainage par utilisateur (visible dans `/espace-membre`).
- Récompense : 1 mois offert pour le parrain et 50 % de réduction pour le filleul.
- Tracking via colonne `source_acquisition` déjà présente sur `profiles`.

## Acquisition payante

À court terme (3 mois) : déconseillé tant que le funnel paiement est cassé. **Tout € dépensé en ads est perdu si le paiement n'aboutit pas.**

Une fois funnel fixé (chantier critique #2 du README) :
- **Google Ads search** sur « pronostic Quinté+ », « pronostic PMU », « pronostic gagnant » (cibler CI/Sénégal/CM en priorité — CPC bien plus bas qu'en France).
- **Meta Ads (Facebook/Instagram)** : retargeting des leads + lookalike sur les abonnés actifs.
- **Influenceurs turf YouTube** : sponsoring 200–500 € par vidéo sur les chaînes turf francophones moyennes.

## Partenariats

- **LONACI** (Côte d'Ivoire) : vu dans le code, intégration LONACI sync. Ce serait énorme d'avoir un lien éditorial officiel ou un partenariat de visibilité avec eux.
- **Hippodromes** : Cagnes-sur-Mer, Vincennes, Longchamp — probablement difficile, mais possible pour les hippodromes africains (Abidjan).
- **Médias locaux** : Fraternité Matin (CI), Le Patriote, etc.

## Discover-friendly

Google Discover récompense les sites avec :
- **Images haute qualité** (≥1200 px) avec `max-image-preview:large` (✅ déjà).
- **E-E-A-T fort** (cf axe SEO).
- **Updates fréquents et pertinents** (cron pronostic-gratuit qui ne tourne pas → red flag).
- **Balise `<meta name="news_keywords">`** (deprecated mais sitemap-news.xml + Schema NewsArticle l'aide).

## Recommandations

| # | Reco | Effort | Volume URL / Trafic potentiel 6m |
|---|---|---|---|
| 1 | Pages programmatiques (programme/hippodrome/cheval/jockey/quinté+/arrivée) | 10 j | +50 K URLs · +30–80 K vis/mois |
| 2 | Cron peuplement chevaux/jockeys/entraîneurs | 1 j | (prérequis) |
| 3 | Welcome email series 4 mails | 2 j | +5–10 % conversion lead → abonné |
| 4 | YouTube : 1 vidéo/jour pronostic Quinté+ | running | +5–15 K vis/mois (organic + watch) |
| 5 | TikTok/Reels : 3/sem extraits sélection | running | +10–30 K vis/mois |
| 6 | WhatsApp Channel | 4 h | +1–5 K abonnés Channel |
| 7 | Programme de parrainage | 2 j | +20–40 % growth viral |
| 8 | Twitter/X : signal ROI quotidien | 1 h/j | +2–5 K vis/mois |
| 9 | (Après funnel fix) Google Ads CI/Sénégal | running | dépend budget |
| 10 | Partenariat LONACI / médias CI | 2–4 sem | levier qualitatif fort |
