# 07 — Sécurité, conformité, légal

## 🚨 Vulnérabilité critique #1 — Clé `service_role` Supabase publique

**Localisation** : [`.env.local.example`](../.env.local.example), ligne 4.

**JWT décodée** :
```json
{"iss":"supabase","ref":"cpzjjnmszbyizeqhgrat","role":"service_role","iat":1774263873,"exp":2089839873}
```

**Faits** :
- Le repo `Moriah12783/elite-turf` est **public** (vérifié via API GitHub : `"private": false`).
- Le fichier est tracké dans git (commit historique : `088b795 Elite Turf v1 - Phase D complete`).
- La clé est valide jusqu'au timestamp `2089839873` = année 2036.
- Le project ref `cpzjjnmszbyizeqhgrat` correspond bien au projet Supabase live.

**Capacités d'un attaquant** :
- Lecture intégrale de toutes les tables (profils, emails, téléphones, transactions, leads…).
- Modification arbitraire (changer son rôle en `ADMIN`, donner `statut_abonnement = 'ELITE'` à un compte qu'il a créé).
- Suppression de toutes les données.
- Création/modification d'utilisateurs auth via l'API admin.

**RGPD** : si la clé a déjà été utilisée par un tiers (impossible à savoir sans logs Supabase API), c'est une **violation de données personnelles** notifiable à la CNIL (FR) et autorités locales sous 72 h.

**Action immédiate (≤2 h)** :

1. **Rotation** :
   - Supabase Dashboard → Settings → API → **Reset service_role key**.
   - Récupérer la nouvelle clé.
   - Mettre à jour dans : Cloudflare Workers env vars + Vercel env vars + `.env.local` local.
   - Tester un endpoint admin qui utilise `createServiceClient()` (ex : `/api/admin/cron-status`) : doit toujours marcher.

2. **Nettoyage du fichier** :
   ```bash
   # Remplacer la valeur dans .env.local.example par un placeholder
   sed -i 's/SUPABASE_SERVICE_ROLE_KEY=.*/SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>/' .env.local.example
   git add .env.local.example
   git commit -m "fix(security): redact service_role key from env example"
   git push
   ```

3. **Purge optionnelle de l'historique git** (si on veut éviter qu'un attaquant qui clone le repo récupère l'ancienne clé) :
   ```bash
   # BFG Repo-Cleaner approach
   bfg --delete-files .env.local.example
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```
   ⚠️ Force-push réécrit l'historique — coordonner avec tous les contributeurs.
   *Note* : pas obligatoire si la rotation est faite ; la clé en historique sera invalide.

4. **Prévention** :
   ```bash
   # Pre-commit hook gitleaks
   npm install --save-dev husky gitleaks
   echo "gitleaks detect --staged --no-banner" > .husky/pre-commit
   chmod +x .husky/pre-commit
   ```

5. **Audit Supabase** :
   - Si Supabase Pro : `auth_audit_log` à examiner pour détecter une activité anormale.
   - Vérifier les logs `auth.users` : créations suspectes ?

## 🚨 Vulnérabilité critique #2 — `default role = 'ADMIN'` dans `profiles`

[`supabase/migrations/...`](../supabase/migrations/) — la colonne `profiles.role` a un default value qui s'évalue à la string `'ADMIN'::text` (avec apostrophes incluses) à cause d'un quoting bug :

```sql
-- vérifié via pg_attrdef
default_expression: '''ADMIN''::text'::text
-- évalué : 'ADMIN'::text
-- mais le check constraint exige role IN ('USER', 'ADMIN', 'MODERATEUR')
-- → la string littérale "'ADMIN'::text" ne match pas → INSERT default échoue
```

**État réel** :
```sql
SELECT role, COUNT(*) FROM profiles GROUP BY role;
-- ADMIN : 1
-- USER  : 21
```

Donc en pratique, le code `handle_new_user` insère sans role et… les inserts marchent quand même (probablement parce que PostgreSQL n'évalue pas l'expression mais stocke la résultante d'évaluation, qui finit par être `'USER'` ou bien le default échoue silencieusement et le profile n'est jamais créé).

**Risque** : confusion totale, comportement non déterministe. Si quelqu'un force le default à s'évaluer (ex : INSERT sans role explicite via SQL direct) et que le bug se résout différemment, le rôle peut devenir `ADMIN` par défaut.

**Action** :
```sql
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'USER';
-- Et idéalement remplacer le check par un type ENUM
```

## Vulnérabilité majeure #3 — Webhook CinetPay sans HMAC ni idempotence

[`app/api/paiement/webhook/route.ts`](../app/api/paiement/webhook/route.ts) :
- Aucune vérification de signature HMAC.
- Pas d'idempotence (même `cpm_trans_id` traité 2× = 2 updates).
- Re-vérification API CinetPay avec la `apikey` (mitigation partielle, mais potentiel DDoS car appel API à chaque webhook).

**Exploitation** : un attaquant qui devine un `cpm_trans_id` peut envoyer 1 000 webhooks/sec → 1 000 calls CinetPay API → quota épuisé, paiements légitimes ne sont plus traités.

**Action** :
```ts
// 1. Vérification HMAC (consulter docs CinetPay, généralement signature sur cpm_trans_id+apikey)
const expectedSig = crypto
  .createHmac("sha256", process.env.CINETPAY_API_KEY!)
  .update(body)
  .digest("hex");
if (req.headers.get("x-cinetpay-signature") !== expectedSig) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
}

// 2. Idempotence
const { data: existing } = await supabase
  .from("webhook_events")
  .select("id")
  .eq("provider", "cinetpay")
  .eq("event_id", cpm_trans_id)
  .single();
if (existing) return NextResponse.json({ received: true, idempotent: true });
await supabase.from("webhook_events").insert({ provider: "cinetpay", event_id: cpm_trans_id });
```

## Vulnérabilités majeures #4 — RLS pronostics avec valeurs obsolètes

Policy `Premium pronostics for subscribers` sur `pronostics` :
```sql
((niveau_acces = 'PREMIUM'::text) AND ... statut_abonnement = ANY (ARRAY['PREMIUM'::text, 'VIP'::text]))
((niveau_acces = 'VIP'::text) AND ... statut_abonnement = 'VIP'::text)
```

Or les valeurs réelles dans le code et le check constraint actuel sont :
- `niveau_acces` : `GRATUIT`, `STARTER`, `PRO`, `ELITE`
- `statut_abonnement` : `GRATUIT`, `STARTER`, `PRO`, `ELITE`, `EXPIRE`

Donc cette policy ne fonctionne **plus du tout** pour les abonnés. Le code applicatif contourne avec `createServiceClient()` (bypass RLS) — mais ça veut dire que toute la logique d'autorisation se retrouve en code applicatif côté Server Components, sans filet RLS.

**Risque** : si une nouvelle route oublie de filtrer côté code, des pronostics premium fuitent à des utilisateurs gratuits.

**Action** : refaire la policy avec les bons noms :
```sql
DROP POLICY "Premium pronostics for subscribers" ON pronostics;
CREATE POLICY "Premium pronostics for subscribers" ON pronostics FOR SELECT
USING (
  publie = true AND (
    niveau_acces = 'GRATUIT'
    OR (niveau_acces = 'STARTER' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND statut_abonnement IN ('STARTER','PRO','ELITE')))
    OR (niveau_acces = 'PRO'     AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND statut_abonnement IN ('PRO','ELITE')))
    OR (niveau_acces = 'ELITE'   AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND statut_abonnement = 'ELITE'))
  )
);
```

## Vulnérabilité moyenne #5 — Bypass middleware admin via direct route

[`middleware.ts:44-48`](../middleware.ts#L44) ne vérifie que `user existe`, pas le rôle ADMIN :
```ts
if (request.nextUrl.pathname.startsWith("/admin")) {
  if (!user) return NextResponse.redirect(...);
  // ❌ pas de check role
}
```

Heureusement [`app/(admin)/admin/layout.tsx:31`](../app/(admin)/admin/layout.tsx#L31) re-vérifie le role. Mais si quelqu'un crée une page admin sans passer par le layout (oubli), elle est exposée à tout user connecté.

**Action** : ajouter le check role aussi dans le middleware (en utilisant service_role pour lire `profiles.role`) :
```ts
if (pathname.startsWith("/admin")) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.redirect(new URL("/", request.url));
}
```

## Conformité légale

### RGPD (utilisateurs UE / France)

- ❌ Pas de bannière de consentement cookies visible (à vérifier visuellement).
- ❌ Page `/confidentialite` existe mais est en `noindex` ; à vérifier le contenu (DPO, durées, droits, base légale).
- ❌ Pas de mécanisme « droit à l'oubli » self-service dans `/espace-membre`.

### Jeu d'argent

**Côte d'Ivoire** : Loi 2018-715 sur les jeux d'argent. La LONACI a le monopole. Un site qui propose des **pronostics** (pas la prise de pari elle-même) est dans une zone grise plus permissive, mais doit afficher des avertissements jeu responsable.

**France** : ARJEL/ANJ régule les opérateurs de paris. Elite Turf ne prend pas de paris donc pas d'agrément ANJ requis. Mais les **mentions légales obligatoires** :
- « Jouer comporte des risques : endettement, dépendance… »
- Lien vers numéro vert addiction (Joueurs Info Service 09 74 75 13 13).
- Mention de l'âge minimum (18 ans).

**État actuel** : présence de [`OperateursANJ`](../components/home/OperateursANJ.tsx) sur la home (composant à auditer). À vérifier.

**Action** :
- Bandeau footer : « Jouer comporte des risques. Joueurs Info Service : 09 74 75 13 13 ».
- Page `/jeu-responsable` indexable.
- Modal de confirmation âge à la première visite (cookie 30 jours).

### CGU et droits d'auteur

[`/cgu`](https://www.elite-turf.fr/cgu) en `noindex`. Légalement, les CGU **doivent être accessibles** mais ne doivent pas être dans le sitemap (elles le sont déjà sortie). OK.

À vérifier dans le contenu :
- Clause de non-engagement de résultat (« Les pronostics sont fournis à titre informatif, ne garantissent aucun gain »).
- Clause sur le scraping Geny (le scraping est dans une zone légalement floue, à formaliser dans des conditions de service).

## Recommandations priorisées

| # | Reco | Sévérité | Effort | À faire avant |
|---|---|---|---|---|
| 1 | **Rotation service_role key + redaction `.env.local.example`** | 🚨 P0 | 2 h | TOUT le reste |
| 2 | Pre-commit gitleaks + vérification absence d'autres secrets | P0 | 1 h | Cette semaine |
| 3 | Webhook CinetPay : HMAC + idempotence | 🚨 P0 | 1 j | Cette semaine |
| 4 | Fix default `role = 'USER'` dans profiles | P1 | 30 min | Ce sprint |
| 5 | Refaire RLS pronostics avec bonnes valeurs | P1 | 2 h | Ce sprint |
| 6 | Vérification rôle ADMIN dans middleware | P2 | 2 h | Ce sprint |
| 7 | Bannière cookies + jeu responsable footer | P1 (légal) | 1 j | Ce mois |
| 8 | Page `/jeu-responsable` indexable + modal âge | P2 | 1 j | Ce mois |
| 9 | Mécanisme droit à l'oubli dans `/espace-membre` | P2 (RGPD) | 2 j | Ce mois |
| 10 | Audit régulier Supabase auth audit log | P2 | 30 min/sem | Process |
