# Brouillons automatiques du Quinté+ (T-90) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** à ~T-90 du Quinté+ du jour, créer deux brouillons non publiés (Pro et Elite), avec la sélection, les rôles, la confiance et les commentaires tirés des faits PMU. Prévenir Steph par e-mail. Steph relit puis publie.

**Architecture :**
- Une route cron `GET /api/cron/brouillons-quinte`, appelée toutes les 5 min par le Worker `elite-turf-crons`, orchestre les entrées-sorties : base, PMU, e-mail, journal.
- Toute la logique métier vit dans des fonctions pures testées, sous `lib/brouillons-quinte/` : lecture PMU, musique, fenêtre et garde-fous, sélection, commentaires, e-mails, assemblage.
- Les brouillons sont des lignes `pronostics` (`publie = false`, `source = 'AUTO-MARCHE'`). Steph les publie par le circuit existant (« Modifier » → « Publier »).
- Avant toute écriture, la **tâche 0** rend le site étanche aux brouillons : ils ne sont jamais montrés, notifiés, ni publiés par une autre route. Elle ferme aussi une faille de la route de publication, déjà ouverte aujourd'hui.

**Tech Stack :** Next.js 14 (App Router, route handler), TypeScript strict, Supabase (`createServiceClient`, client non typé), Vitest (`lib/**/*.test.ts` seulement), Cloudflare Workers (cron-worker), Resend (`sendEmail`).

**Spec :** `docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md` (validée par Steph le 07/10/2026). Lire la spec avant chaque tâche, puis la section « Écarts assumés » ci-dessous.

## Global Constraints

**Règles métier**
- **Jamais de publication automatique** : `publie = false`, `date_publication = null`. Ne pas toucher `IA_AUTO_PUBLISH_ENABLED` ni le pipeline `ia-pronostics-v2`.
- **Étanchéité** : un brouillon n'est jamais montré, compté, notifié ni repris par une autre route. Toutes les lectures du site passent par le client service, qui ignore la RLS ; seul un filtre explicite sur `publie` cache un brouillon. Voir la tâche 0.
- **Interrupteur** `BROUILLONS_QUINTE_ENABLED` : comparaison stricte `=== "true"`. Absent = fermé = essai à blanc (aucune écriture dans `pronostics`).
- **Origine** des brouillons : `source = 'AUTO-MARCHE'`.
- **Fenêtre** : `60 ≤ minutes avant le départ ≤ 95`. Le dernier passage est `minutes < 65`. La base stocke l'heure de **Paris** : la convertir avec `parisVersUtc`.
- **Values Elite** :
  - candidats : rangs 4 à 8 ;
  - écarté si `fautes ≥ 2` sur les 5 dernières courses ;
  - on prend les 3 plus grosses cotes ; à égalité, le moins de fautes, puis le meilleur rang ;
  - s'il en manque, on complète avec les fautifs (moins de fautes, puis plus grosse cote, puis meilleur rang).
- **Confiance** (cote du favori) : `< 3` → `ELEVE` ; `3 à 6` → `MOYEN` ; `> 6` → `FAIBLE`. Jamais `TRES_ELEVE`.
- **Analyse courte** : 160 caractères au plus, jamais coupée au milieu d'un mot.
- **Noms** de chevaux, drivers et entraîneurs : recopiés tels que le PMU les écrit.
- **Mots interdits** dans les textes (sans tenir compte de la casse) : « garanti », « assuré », « sûr », « certain », « immanquable », « coup sûr », « 100 % », « jackpot », « gagnant à coup ».

**Règles techniques**
- **Répertoire** : toutes les commandes se lancent depuis le worktree `C:\Users\HP\etf-wt-brouillons` (branche `feat/brouillons-quinte`), par exemple `Push-Location C:\Users\HP\etf-wt-brouillons` puis `Pop-Location`, ou `git -C`.
- **tsconfig sans `target`** (ES5 par défaut) : pas de spread de `Map` ni de `Set`, pas de regex avec le drapeau `/u` ni de *lookbehind*. Le spread de tableaux et d'objets reste permis.
- **`isolatedModules: true`** : les imports de types passent par `import type` ou par le modificateur `type` dans l'accolade.
- **Les fichiers `*.test.ts` sont exclus de `tsc`** (tsconfig `exclude`), et Vitest ne vérifie pas les types. Une erreur de type dans un test ne sera signalée par personne : les écrire avec soin. Les fixtures `__fixtures__/*.ts`, elles, sont vérifiées par `tsc`.
- **Contrôles** :
  - à chaque tâche : `npx vitest run lib/brouillons-quinte` + `npx tsc --noEmit -p .` ;
  - à la tâche 9, avant la PR : `npx vitest run` complet, `npm run lint` et `npm run build`. Les tâches 1 à 7 n'ajoutent que du code `lib/` qu'aucune page n'importe encore : `tsc` le couvre.
- **Commits** : conventional commits en français, avec la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Push et PR** : seulement à la tâche 9. **Jamais de merge** sans « merge la N » de Steph.
- **Ne jamais toucher** :
  - les fichiers de paiement (`app/api/paystack/*`, `app/api/paiement/stripe/*`, `app/api/cinetpay/*`, webhooks, `paiement/succes|echec`) ;
  - `docs/analyse-arc-2026.md` ;
  - les envois marketing.

## Écarts assumés par rapport à la spec

Relevés en écrivant ce plan, sur pièces. Ce sont des précisions ou des protections ; aucune ne change une décision de Steph.

1. **§5, `categorie` en base n'est pas un repli.** La migration `20260515_backfill_discipline_trot.sql` montre que `geny-programme` écrivait `categorie = 'PLAT'` en dur, et que la correction est restée partielle. Si la réponse « course » du PMU manque, la discipline et le libellé driver/jockey sont **omis** plutôt que devinés. `distance_metres` reste un repli pour la distance.
2. **§7, « driver » au trot attelé seulement.** Au trot monté, au plat et en obstacle, on écrit « jockey ».
3. **§7.1, groupe reculé.** On cite les numéros quand ils forment une seule suite (« Les n°10 à 18 ») ou deux numéros (« Les n°10 et 12 »). Sinon, on donne le nombre (« 8 partantes »). Dans l'analyse complète, les suites de 3 numéros ou plus sont resserrées : « Les n°10, 11 et 13 à 18 ».
4. **§9, journal de l'essai à blanc.** Il a son propre type, `BROUILLONS_QUINTE_BLANC_{jour}`. Ainsi, ouvrir l'interrupteur le jour même n'étouffe pas l'e-mail « prêts ».
5. **§4 et §10, trois garde-fous ajoutés** (fonction pure `gardeFous`, testée) :
   - `echec_deja_signale` : une erreur n'est pas réessayée (§10). Une fois l'e-mail d'échec parti, l'outil s'arrête pour la journée ;
   - `brouillons_retires` : si Steph supprime les brouillons après l'e-mail « prêts », on ne les recrée pas ;
   - relance de l'e-mail « prêts » : si les brouillons existent mais que l'e-mail n'est pas parti (statut `FAILED`), le passage suivant l'envoie, en version courte avec les liens.
6. **§10, exception hors fenêtre** (par exemple une base indisponible à 3 h du matin) : pas d'e-mail d'échec, seulement le journal `cron_logs` et l'alerte Telegram du journal. Sinon un incident nocturne bloquerait la préparation de la journée.
7. **§11, un module de plus.** `assembler.ts` regroupe les contrôles d'entrée et l'assemblage des deux lignes, pour que la route ne fasse qu'orchestrer.
8. **§6.2, l'exemple de la spec** utilise les cotes de 11h30. Les tests utilisent aussi les cotes au départ (11h55), où le **n°12 JUNON DE LOU est non partant**, déclaré vers 11h34. C'est un vrai cas de non-partant tardif : voir le tableau ci-dessous.
9. **Tâche 0, hors spec.** L'audit du 07/10/2026 a montré que le site laisse passer un brouillon à sept endroits, dont une route de publication sans authentification. La spec supposait le site étanche ; il ne l'est pas.

## Données réelles de test : Quinté+ du 07/10/2026 au départ

Prix des Gobelins, Enghien R1C1, trot attelé, 2 875 m, juments de 7 et 8 ans. Les n°10 à 18 partent sur 2 900 m. Il y a **17 partantes : le n°12 JUNON DE LOU est NON PARTANT**, avec une cote figée à 6,8 depuis 11h34. Cotes relevées à 11h55 GMT.

| Rang | N° | Nom | Cote | 5 dernières | Fautes |
|---|---|---|---|---|---|
| 1 | 17 | IMAGE D'ATALANTE | 3,8 | 2a3a2a2a8a | 0 |
| 2 | 16 | JAIN MAB | 7,5 | 9a4a7a2a4a | 0 |
| 3 | 5 | JEUNE ORANGE COTON | 7,9 | 6a7aDaDa1a | 2 |
| 4 | 13 | IDOLE ELDE | 9,3 | 9a2a1a1a3a | 0 |
| 5 | 10 | JUSTICIA SMART | 10 | 4a0aDaDaDa | 3 |
| 6 | 15 | IXELLE BLEUE | 13 | 9a3a9a1aDa | 1 |
| 7 | 18 | JOIE DE LA COTE | 14 | 4a5m2a3a6a | 0 |
| 8 | 11 | JALOUZ D'OLIVERIE | 15 | 9a2a0a2a2a | 0 |

Les n°11 et n°14 sont à égalité à 15. La route les départage par la note composite (`buildNotreSelection`). La fixture n'a pas la base : c'est le numéro qui départage, et le n°11 est donc 8e.

**Attendus :**
- Pro : 17 ⭐, 16, 5 en base ; 13, 10, 15 en values.
- Elite : 17 ⭐, 16, 5 en base ; 15, 18, 11 en values.
- Aucun cheval écarté : le n°10 aurait été laissé de côté de toute façon, car sa cote est plus petite.
- Confiance : Moyen.

## Review Focus

1. **Non-partant déclaré au PMU après la base** (cas réel du n°12) : il sort des 8 favoris et n'est cité dans aucun texte. Tests en **tâche 4** (`appliquerCotesPmu`, données réelles) et en **tâche 7** (bout en bout).
2. **Réponse « course » du PMU indisponible** alors que les partants répondent : ni discipline ni libellé driver/jockey (`categorie` n'est pas utilisée), distance tirée des partants, 160 caractères au plus. Test en **tâche 5**.
3. **Driver ou entraîneur absent au PMU** : la ligne du cheval reste propre (ni « — , » ni « null »). Test en **tâche 5**.
4. **Champ mixte** (`conditionSexe` ≠ `FEMELLES`, chevaux mâles ou hongres) : « partants », « Favori du marché », « premiers », « Retenu ». Test en **tâche 5**.
5. **Musique absente pour un cheval** : 0 faute (aucun écart inventé) et aucune phrase de forme. Tests en **tâches 4 et 5**.

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `app/api/admin/pronostics/[id]/publie/route.ts` (modifié) | authentification admin obligatoire (faille actuelle) | 0 |
| `app/(public)/espace-membre/page.tsx` (modifié) | « Derniers pronostics » : publiés seulement | 0 |
| `app/(public)/pronostics/[id]/page.tsx` (modifié) | métadonnées construites sur un pronostic publié seulement | 0 |
| `app/api/admin/pronostics/notifier/route.ts` (modifié) | refuse de notifier un pronostic non publié | 0 |
| `app/api/cron/ia-auto-publish/route.ts`, `app/api/admin/ai-review/[id]/publish/route.ts`, `app/api/admin/pronostics/bulk/route.ts` (modifiés) | ne reprennent ni ne publient jamais une ligne AUTO-MARCHE | 0 |
| `lib/pmu-cotes.ts` (modifié) | extraire `fetchPmuJson` (relais puis direct), réutilisé par `fetchCotesPmu` | 1 |
| `lib/brouillons-quinte/pmu.ts` | `ParticipantPmu`, `CoursePmu`, `lireParticipantsPmu`, `lireCoursePmu`, `chargerDonneesPmu` | 1 |
| `lib/brouillons-quinte/__fixtures__/*.json` + `gobelins.ts` | vraies réponses PMU du 07/10/2026 + objets de test partagés | 1, 4, 5 |
| `lib/brouillons-quinte/musique.ts` | `analyserMusique` | 2 |
| `lib/brouillons-quinte/fenetre.ts` | fenêtre (`minutesAvantDepart`, `dansFenetre`, `dernierPassage`), `gardeFous`, `SOURCE_BROUILLON` | 3 |
| `lib/brouillons-quinte/selection.ts` | `appliquerCotesPmu`, `versChevauxClasses`, `decouperPro`, `choisirValuesElite`, `confianceDuMarche` | 4 |
| `lib/brouillons-quinte/commentaires.ts` | `analyseCourte`, `analyseComplete`, `heureGmt`, `MOTS_INTERDITS` | 5 |
| `lib/brouillons-quinte/email.ts` | `emailBrouillons`, `emailRelance`, `emailEchec`, `typeJournal`, `RAISONS_LISIBLES` | 6 |
| `lib/brouillons-quinte/assembler.ts` | `controlerDonneesPmu`, `assemblerBrouillons` | 7 |
| `supabase/migrations/20261007_pronostics_source_auto_marche.sql` | contrainte `source` + `AUTO-MARCHE` | 8 |
| `app/api/cron/brouillons-quinte/route.ts` | orchestration (§4 de la spec) + `?apercu=1` | 8 |
| `cron-worker/wrangler.toml` + `cron-worker/src/index.ts` | déclencheur toutes les 5 min | 9 |

Chaque module pur a son `*.test.ts` à côté de lui.

---

### Task 0 : Étanchéité des brouillons

**Pourquoi.** Un audit en lecture seule du 07/10/2026, vérifié dans le code, a montré ceci :
- toutes les lectures du site passent par `createServiceClient()`, qui ignore la RLS ;
- un brouillon (`publie = false`) n'est donc caché que là où le code filtre `publie` ;
- sept endroits le laissent passer, dont une faille déjà exploitable aujourd'hui.

Cette tâche doit être mergée **avant d'ouvrir l'interrupteur**. Tant qu'il est fermé, aucun brouillon n'est écrit.

| # | Endroit | Risque constaté |
|---|---|---|
| 1 | `PATCH /api/admin/pronostics/[id]/publie` | **Aucune authentification** : n'importe qui peut publier ou dépublier un pronostic. Les identifiants sont visibles dans le code source de `/courses` et dans les liens `/pronostics/{id}`. Le middleware ne protège que les pages `/admin`, pas `/api/admin`. |
| 2 | `espace-membre`, « Derniers pronostics » | Pas de filtre `publie`. Les brouillons, sans date de publication, passent **en tête**, et un abonné PRO/ELITE voit leur analyse courte. |
| 3 | `/pronostics/[id]`, `generateMetadata` | Pas de filtre `publie` : le titre et la description de la page, analyse courte comprise, sont construits à partir d'un brouillon. |
| 4 | `POST /api/admin/pronostics/notifier` | Envoie l'e-mail aux abonnés pour n'importe quel identifiant, publié ou non. Il n'est appelé qu'après une publication, mais il n'a pas de second garde-fou. |
| 5 | `GET /api/cron/ia-auto-publish` (v1, plus planifiée) | Publie **tous** les brouillons du jour, quelle que soit leur origine. Un seul appel avec le secret suffit. |
| 6 | `POST /api/admin/ai-review/[id]/publish` | Reprend la ligne existante (course, niveau) sans regarder son origine. Il remplacerait le contenu d'un brouillon AUTO-MARCHE par celui de l'IA, puis le publierait. |
| 7 | `POST /api/admin/pronostics/bulk` | Reprend la première ligne de la course, quelle que soit son origine, et la publie. |

Les corrections 5 à 7 ne visent que les lignes `source = 'AUTO-MARCHE'` (`.or("source.is.null,source.neq.AUTO-MARCHE")` garde les lignes sans origine). Pour tout le reste, ces routes se comportent comme aujourd'hui. Aucun mécanisme n'est réactivé.

Si la correction 1 a déjà été livrée à part (PR de sécurité séparée, recommandée), vérifier qu'elle est sur `main`, puis passer directement au Step 2.

**Files :**
- Modify : `app/api/admin/pronostics/[id]/publie/route.ts` (fichier entier, 45 lignes)
- Modify : `app/(public)/espace-membre/page.tsx:113-124`
- Modify : `app/(public)/pronostics/[id]/page.tsx:36-40`
- Modify : `app/api/admin/pronostics/notifier/route.ts:79-93`
- Modify : `app/api/cron/ia-auto-publish/route.ts:34-40`
- Modify : `app/api/admin/ai-review/[id]/publish/route.ts:244-249`
- Modify : `app/api/admin/pronostics/bulk/route.ts:186-188`

**Interfaces :**
- Consumes : `requireAdminAuth(req: NextRequest): Promise<NextResponse | null>` (`lib/auth/checkAdminAuth.ts` : session admin ou Bearer `CRON_SECRET` ; `null` = autorisé).
- Produces : rien de nouveau. Les routes gardent leurs entrées et leurs sorties.

Ces fichiers sont hors de `lib/` : Vitest ne les couvre pas. La vérification passe par `tsc`, une relecture ciblée (Step 8), l'appel local de la tâche 8 (Step 4) et le build de la tâche 9.

- [ ] **Step 1 : Authentification de la route de publication**

Le fichier `app/api/admin/pronostics/[id]/publie/route.ts` complet devient :

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

/**
 * PATCH /api/admin/pronostics/[id]/publie
 * Bascule le statut publié/brouillon d'un pronostic.
 * Utilise le service client (bypass RLS) : réservé aux admins (session admin
 * ou Bearer CRON_SECRET). Le middleware ne protège que les pages /admin, pas
 * /api/admin : sans cette vérification, n'importe qui pouvait publier ou
 * dépublier un pronostic à partir de son identifiant (constat du 07/10/2026).
 * Body: { publie: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const { publie } = await req.json();

    if (typeof publie !== "boolean") {
      return NextResponse.json({ error: "Le champ publie doit être un booléen" }, { status: 400 });
    }

    const { error } = await supabase
      .from("pronostics")
      .update({
        publie,
        date_publication: publie ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) {
      console.error("[PATCH /api/admin/pronostics/publie] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/admin/pronostics");
    revalidatePath("/pronostics");

    return NextResponse.json({ success: true, publie });
  } catch (err: any) {
    console.error("[PATCH /api/admin/pronostics/publie] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

Le bouton de l'admin appelle cette route depuis le navigateur, avec la session de Steph : `requireAdminAuth` l'accepte, rien ne change pour lui.

- [ ] **Step 2 : Espace membre, pronostics publiés seulement**

Dans `app/(public)/espace-membre/page.tsx`, la requête des lignes 113 à 124 devient (une ligne ajoutée, `.eq("publie", true)`) :

```ts
    serviceClient
      .from("pronostics")
      .select(`
        id, type_pari, confiance, analyse_courte, resultat, nb_vues,
        date_publication, niveau_acces,
        course:course_id(
          libelle, date_course,
          hippodrome:hippodrome_id(nom)
        )
      `)
      // Publiés seulement : un brouillon (date de publication vide) passait en tête.
      .eq("publie", true)
      .order("date_publication", { ascending: false })
      .limit(8),
```

- [ ] **Step 3 : Métadonnées de la page d'un pronostic**

Dans `app/(public)/pronostics/[id]/page.tsx`, `generateMetadata`, lignes 36 à 40 :

```ts
  const { data } = await supabase
    .from("pronostics")
    .select("analyse_courte, niveau_acces, type_pari, selection, confiance, resultat, course:courses(libelle, date_course, heure_depart, hippodrome:hippodromes(nom))")
    .eq("id", params.id)
    // Un brouillon n'a pas de métadonnées : la page renvoie 404 et son titre ne doit rien révéler.
    .eq("publie", true)
    .single();
```

Un brouillon donne alors `data = null`, donc `{ title: "Pronostic" }` (ligne 42, inchangée).

- [ ] **Step 4 : Le notifieur refuse un pronostic non publié**

Dans `app/api/admin/pronostics/notifier/route.ts`, lignes 79 à 93 :

```ts
    const { data: prono, error: pronoErr } = await supabase
      .from("pronostics")
      .select(`
        id, type_pari, niveau_acces, analyse_courte, selection, publie,
        course:courses (
          date_course, nb_partants,
          hippodrome:hippodromes ( nom )
        )
      `)
      .eq("id", pronosticId)
      .single();

    if (pronoErr || !prono) {
      return NextResponse.json({ error: "Pronostic introuvable" }, { status: 404 });
    }

    // Second garde-fou : on ne prévient jamais les abonnés d'un brouillon.
    if (!prono.publie) {
      return NextResponse.json({ error: "Pronostic non publié : notification refusée" }, { status: 409 });
    }
```

Les appelants (création, « Modifier » puis « Publier », bouton « Notifier ») appellent le notifieur **après** la publication : leur parcours ne change pas.

- [ ] **Step 5 : `ia-auto-publish` (v1) ne publie jamais un brouillon AUTO-MARCHE**

Dans `app/api/cron/ia-auto-publish/route.ts`, lignes 34 à 40 :

```ts
    const { data: drafts, error: fetchErr } = await supabase
      .from("pronostics")
      .select(`
        id,
        course:courses ( date_course )
      `)
      .eq("publie", false)
      // Les brouillons du Quinté+ préparés à T-90 attendent Steph : jamais publiés ici.
      .or("source.is.null,source.neq.AUTO-MARCHE");
```

- [ ] **Step 6 : la publication d'un brouillon IA ne reprend jamais un brouillon AUTO-MARCHE**

Dans `app/api/admin/ai-review/[id]/publish/route.ts`, lignes 244 à 249 :

```ts
  const { data: existing } = await supabase
    .from("pronostics")
    .select("id")
    .eq("course_id",    draft.course_id)
    .eq("niveau_acces", niveauLegacy)
    // Un brouillon AUTO-MARCHE (préparé à T-90) attend la relecture de Steph :
    // ne jamais le reprendre ni le publier avec le contenu de l'IA.
    .or("source.is.null,source.neq.AUTO-MARCHE")
    .maybeSingle();
```

- [ ] **Step 7 : l'import en masse ne reprend jamais un brouillon AUTO-MARCHE**

Dans `app/api/admin/pronostics/bulk/route.ts`, lignes 186 à 188, la recherche des pronostics existants devient :

```ts
      .from("pronostics")
      .select("id, course_id, selection")
      .in("course_id", courseIds)
      // Jamais de reprise d'un brouillon AUTO-MARCHE (préparé à T-90, en attente de Steph).
      .or("source.is.null,source.neq.AUTO-MARCHE");
```

- [ ] **Step 8 : Contrôles**

Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

Vérifier avec l'outil Grep (le chemin contient des crochets : ne pas passer par `Select-String -Path`) :
- `requireAdminAuth` dans `app/api/admin/pronostics/[id]/publie/route.ts` : 2 occurrences (l'import et l'appel) ;
- `source.neq.AUTO-MARCHE` dans `app/` : exactement 3 occurrences (ia-auto-publish, ai-review, bulk) ;
- `Publiés seulement` dans `app/(public)/espace-membre/page.tsx` : 1 occurrence, juste au-dessus de `.eq("publie", true)` ;
- `Un brouillon n'a pas de métadonnées` dans `app/(public)/pronostics/[id]/page.tsx` : 1 occurrence, juste au-dessus de `.eq("publie", true)` ;
- `Pronostic non publié` dans `app/api/admin/pronostics/notifier/route.ts` : 1 occurrence.

Le refus de la route de publication sans session (401) est vérifié en local à la tâche 8, Step 4.

- [ ] **Step 9 : Commits (deux, pour séparer la faille du reste)**

```powershell
git add "app/api/admin/pronostics/[id]/publie/route.ts"
git commit -m "fix(admin): authentification obligatoire pour publier ou dépublier un pronostic" -m "La route PATCH /api/admin/pronostics/[id]/publie ne vérifiait rien : le middleware ne protège que les pages /admin. N'importe qui pouvait publier ou dépublier un pronostic à partir de son identifiant (visible dans /courses et dans les liens /pronostics). Même garde que les autres routes admin : session admin ou Bearer CRON_SECRET." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add "app/(public)/espace-membre/page.tsx" "app/(public)/pronostics/[id]/page.tsx" app/api/admin/pronostics/notifier/route.ts app/api/cron/ia-auto-publish/route.ts "app/api/admin/ai-review/[id]/publish/route.ts" app/api/admin/pronostics/bulk/route.ts
git commit -m "fix(pronostics): un brouillon n'est ni montré, ni notifié, ni repris automatiquement" -m "Espace membre et métadonnées : publiés seulement. Notifieur : refuse un pronostic non publié. ia-auto-publish (v1), publication d'un brouillon IA et import en masse : ne reprennent ni ne publient jamais une ligne AUTO-MARCHE. Préalable aux brouillons du Quinté+ à T-90." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1 : Données réelles + lecteurs PMU

**Files :**
- Create : `lib/brouillons-quinte/__fixtures__/pmu-participants-20261007-R1C1.json`
- Create : `lib/brouillons-quinte/__fixtures__/pmu-course-20261007-R1C1.json`
- Create : `lib/brouillons-quinte/__fixtures__/gobelins.ts`
- Create : `lib/brouillons-quinte/pmu.ts`
- Create : `lib/brouillons-quinte/pmu.test.ts`
- Modify : `lib/pmu-cotes.ts:141-161` (extraire `fetchPmuJson`)

**Interfaces :**
- Consumes : `isoVersDdmmyyyy(iso: string): string` (`lib/sync/pmu-arrivees.ts`, lève une erreur sur une date invalide).
- Produces :
  - `fetchPmuJson(chemin: string, timeoutMs?: number): Promise<unknown | null>` (dans `lib/pmu-cotes.ts`) ;
  - `interface ParticipantPmu { numero: number; nom: string; nonPartant: boolean; cote: number|null; coteMaj: number|null; driver: string|null; entraineur: string|null; musique: string|null; sexe: string|null; age: number|null; distance: number|null }` ;
  - `interface CoursePmu { libelle: string|null; specialite: string|null; distance: number|null; conditionSexe: string|null; heureDepart: number|null }` ;
  - `lireParticipantsPmu(json: unknown): ParticipantPmu[]` ;
  - `lireCoursePmu(json: unknown): CoursePmu | null` ;
  - `chargerDonneesPmu(dateISO: string, R: number, C: number, timeoutMs?: number): Promise<{ participants: ParticipantPmu[] | null; course: CoursePmu | null }>` ;
  - fixtures `PARTICIPANTS`, `COURSE_PMU` dans `__fixtures__/gobelins.ts`.

- [ ] **Step 1 : Préparer le worktree et copier les vraies réponses PMU**

Le worktree `C:\Users\HP\etf-wt-brouillons` existe déjà et contient la spec et ce plan.

```powershell
$wt = "C:\Users\HP\etf-wt-brouillons"
if (-not (Test-Path "$wt\node_modules")) { New-Item -ItemType Junction -Path "$wt\node_modules" -Target C:\Users\HP\elite-turf\node_modules | Out-Null }
if (-not (Test-Path "$wt\.env.local")) { Copy-Item C:\Users\HP\elite-turf\.env.local "$wt\.env.local" }
New-Item -ItemType Directory -Force "$wt\lib\brouillons-quinte\__fixtures__" | Out-Null
$sp = "C:\Users\HP\AppData\Local\Temp\claude\C--Users-HP-elite-turf\29d5d521-d4a1-47f6-8e5e-d925546ab534\scratchpad"
Copy-Item "$sp\pmu-participants-20261007-R1C1.json" "$wt\lib\brouillons-quinte\__fixtures__\"
Copy-Item "$sp\pmu-course-20261007-R1C1.json" "$wt\lib\brouillons-quinte\__fixtures__\"
```

Si le scratchpad a été vidé, retélécharger : l'API rend les mêmes données, figées au départ.

```powershell
$f = "C:\Users\HP\etf-wt-brouillons\lib\brouillons-quinte\__fixtures__"
curl.exe -s -m 20 -A "Mozilla/5.0" -o "$f\pmu-participants-20261007-R1C1.json" "https://online.turfinfo.api.pmu.fr/rest/client/1/programme/07102026/R1/C1/participants"
curl.exe -s -m 20 -A "Mozilla/5.0" -o "$f\pmu-course-20261007-R1C1.json" "https://online.turfinfo.api.pmu.fr/rest/client/1/programme/07102026/R1/C1"
```

Vérifier qu'il y a 18 chevaux, et que le n°17 IMAGE D'ATALANTE a `dernierRapportDirect.rapport = 3.8` et `handicapDistance = 2900`. Le n°12 JUNON DE LOU doit avoir `statut = "NON_PARTANT"`.

- [ ] **Step 2 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/pmu.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { lireParticipantsPmu, lireCoursePmu } from "./pmu";
import participantsJson from "./__fixtures__/pmu-participants-20261007-R1C1.json";
import courseJson from "./__fixtures__/pmu-course-20261007-R1C1.json";

describe("lireParticipantsPmu — vraie réponse PMU, Quinté+ du 07/10/2026 au départ", () => {
  const p = lireParticipantsPmu(participantsJson);

  it("lit les 18 chevaux, dont un non-partant", () => {
    expect(p).toHaveLength(18);
    expect(p.filter((x) => x.nonPartant).map((x) => x.numero)).toEqual([12]);
  });

  it("lit cote, horodatage, driver, entraîneur, musique, sexe, âge et distance", () => {
    expect(p.find((x) => x.numero === 17)).toEqual({
      numero: 17,
      nom: "IMAGE D'ATALANTE",
      nonPartant: false,
      cote: 3.8,
      coteMaj: 1791374156000,
      driver: "F. NIVARD",
      entraineur: "D. CHERBONNEL",
      musique: "2a3a2a2a8a4a0a4a6a4a",
      sexe: "FEMELLES",
      age: 8,
      distance: 2900,
    });
  });

  it("n°12 JUNON DE LOU, non partant : sa dernière cote (11h34) reste lue, l'appelant l'écarte", () => {
    const x = p.find((x) => x.numero === 12)!;
    expect(x.nonPartant).toBe(true);
    expect(x.cote).toBe(6.8);
    expect(x.coteMaj).toBe(1791372870000);
  });

  it("les n°1 à 9 partent sur 2 875 m, les n°10 à 18 sur 2 900 m", () => {
    expect(p.find((x) => x.numero === 1)!.distance).toBe(2875);
    expect(p.find((x) => x.numero === 9)!.distance).toBe(2875);
    expect(p.find((x) => x.numero === 10)!.distance).toBe(2900);
  });

  it("champs absents → null", () => {
    const [x] = lireParticipantsPmu({ participants: [{ numPmu: 3, nom: "AAA", statut: "NON_PARTANT" }] });
    expect(x.nonPartant).toBe(true);
    expect(x.cote).toBeNull();
    expect(x.driver).toBeNull();
    expect(x.musique).toBeNull();
    expect(x.distance).toBeNull();
  });

  it("réponse vide ou illisible → liste vide", () => {
    expect(lireParticipantsPmu(null)).toEqual([]);
    expect(lireParticipantsPmu({})).toEqual([]);
    expect(lireParticipantsPmu({ participants: [{ numPmu: "x" }] })).toEqual([]);
  });
});

describe("lireCoursePmu", () => {
  it("lit libellé, spécialité, distance, sexe des partants et heure de départ", () => {
    expect(lireCoursePmu(courseJson)).toEqual({
      libelle: "PRIX DES GOBELINS",
      specialite: "TROT_ATTELE",
      distance: 2875,
      conditionSexe: "FEMELLES",
      heureDepart: 1791374100000,
    });
  });

  it("null si la réponse est vide", () => {
    expect(lireCoursePmu(null)).toBeNull();
    expect(lireCoursePmu({})).toBeNull();
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/pmu.test.ts`
Expected : FAIL, « Failed to resolve import "./pmu" ».

- [ ] **Step 4 : Extraire `fetchPmuJson` dans `lib/pmu-cotes.ts`**

Remplacer la fonction `fetchCotesPmu` (lignes 141 à 161) par :

```ts
/**
 * GET JSON sur l'API PMU : relais d'abord, accès direct ensuite. `null` = PMU
 * injoignable ou réponse illisible — jamais « pas de donnée ».
 */
export async function fetchPmuJson(chemin: string, timeoutMs = 4000): Promise<unknown | null> {
  for (const base of [PMU_PROXY, PMU_DIRECT]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + chemin, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      clearTimeout(timer);
      /* base suivante */
    }
  }
  return null;
}

/**
 * Cotes en direct d'une course. `null` = PMU injoignable : l'appelant NE DOIT
 * PAS en conclure « pas de cote ».
 */
export async function fetchCotesPmu(dateISO: string, R: number, C: number, timeoutMs = 4000): Promise<CotePmu[] | null> {
  const json = await fetchPmuJson(`/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}/participants`, timeoutMs);
  return json === null ? null : lireCotesPmu(json);
}
```

Le comportement est identique. Le `return await` reste dans le `try` : une réponse illisible fait toujours passer à la base suivante.

- [ ] **Step 5 : Écrire `lib/brouillons-quinte/pmu.ts`**

```ts
/**
 * lib/brouillons-quinte/pmu.ts
 *
 * Données PMU des brouillons du Quinté+ (spec
 * docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md, §5).
 * Lecteurs PURS, testés sur les vraies réponses du 07/10/2026, + accès réseau
 * (relais puis direct, comme les cotes en direct des fiches course).
 */
import { fetchPmuJson } from "@/lib/pmu-cotes";
import { isoVersDdmmyyyy } from "@/lib/sync/pmu-arrivees";

export interface ParticipantPmu {
  numero: number;
  nom: string;
  nonPartant: boolean;
  /** Cote directe (rapport probable simple gagnant) ; null tant que le PMU n'en publie pas. */
  cote: number | null;
  /** Horodatage PMU de cette cote (ms). */
  coteMaj: number | null;
  /** Driver (trot) ou jockey (galop) : le PMU range les deux dans `driver`. */
  driver: string | null;
  entraineur: string | null;
  musique: string | null;
  /** Valeurs PMU : "FEMELLES", "MALES", "HONGRES". */
  sexe: string | null;
  age: number | null;
  /** Distance du partant, recul compris (m). */
  distance: number | null;
}

export interface CoursePmu {
  libelle: string | null;
  /** TROT_ATTELE, TROT_MONTE, PLAT, HAIES, STEEPLECHASE, CROSS… */
  specialite: string | null;
  distance: number | null;
  /** "FEMELLES" quand la course est réservée aux juments. */
  conditionSexe: string | null;
  /** Départ prévu (ms UTC). */
  heureDepart: number | null;
}

function positif(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** PUR : réponse `/participants` du PMU → chevaux, non-partants compris. */
export function lireParticipantsPmu(json: unknown): ParticipantPmu[] {
  const liste = json && typeof json === "object" ? (json as { participants?: unknown }).participants : null;
  if (!Array.isArray(liste)) return [];
  const out: ParticipantPmu[] = [];
  for (const brut of liste as any[]) {
    const numero = Number(brut?.numPmu);
    if (!Number.isFinite(numero) || numero <= 0) continue;
    const direct = brut?.dernierRapportDirect ?? null;
    out.push({
      numero,
      nom: String(brut?.nom ?? "").trim(),
      nonPartant: String(brut?.statut ?? "").toUpperCase() === "NON_PARTANT",
      cote: positif(direct?.rapport),
      coteMaj: positif(direct?.dateRapport),
      driver: texte(brut?.driver),
      entraineur: texte(brut?.entraineur),
      musique: texte(brut?.musique),
      sexe: texte(brut?.sexe),
      age: positif(brut?.age),
      distance: positif(brut?.handicapDistance),
    });
  }
  return out;
}

/** PUR : réponse « course » du PMU → infos utiles ; null si rien d'exploitable. */
export function lireCoursePmu(json: unknown): CoursePmu | null {
  if (!json || typeof json !== "object") return null;
  const c = json as Record<string, unknown>;
  const out: CoursePmu = {
    libelle: texte(c.libelle),
    specialite: texte(c.specialite),
    distance: positif(c.distance),
    conditionSexe: texte(c.conditionSexe),
    heureDepart: positif(c.heureDepart),
  };
  return out.specialite || out.distance || out.heureDepart ? out : null;
}

/** Partants et course PMU. `participants: null` = PMU injoignable. */
export async function chargerDonneesPmu(
  dateISO: string,
  R: number,
  C: number,
  timeoutMs = 8000,
): Promise<{ participants: ParticipantPmu[] | null; course: CoursePmu | null }> {
  const base = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}`;
  const [jsonParticipants, jsonCourse] = await Promise.all([
    fetchPmuJson(`${base}/participants`, timeoutMs),
    fetchPmuJson(base, timeoutMs),
  ]);
  return {
    participants: jsonParticipants === null ? null : lireParticipantsPmu(jsonParticipants),
    course: jsonCourse === null ? null : lireCoursePmu(jsonCourse),
  };
}
```

- [ ] **Step 6 : Écrire les objets de test partagés `lib/brouillons-quinte/__fixtures__/gobelins.ts`**

```ts
/**
 * Quinté+ du 07/10/2026 — Prix des Gobelins, Enghien R1C1 : réponses PMU
 * RÉELLES, relevées après le départ (cotes figées à 11h55 GMT). Le n°12 JUNON
 * DE LOU a été déclaré non partant vers 11h34 : un vrai cas de non-partant
 * tardif. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261007-R1C1.json";
import courseJson from "./pmu-course-20261007-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu } from "../pmu";

export const PARTICIPANTS = lireParticipantsPmu(participantsJson);
export const COURSE_PMU = lireCoursePmu(courseJson);
```

- [ ] **Step 7 : Vérifier que les tests passent, et que les anciens tests PMU passent toujours**

Run : `npx vitest run lib/brouillons-quinte/pmu.test.ts lib/pmu-cotes.test.ts`
Expected : PASS (tous).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 8 : Commit**

```powershell
git add lib/pmu-cotes.ts lib/brouillons-quinte/pmu.ts lib/brouillons-quinte/pmu.test.ts lib/brouillons-quinte/__fixtures__
git commit -m "feat(brouillons-quinte): lecture des partants et de la course PMU" -m "Lecteurs purs testés sur les vraies réponses PMU du Quinté+ du 07/10/2026 (Prix des Gobelins, n°12 non partant) ; fetchPmuJson extrait de fetchCotesPmu (relais puis direct, comportement inchangé)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Lecture de la musique

**Files :**
- Create : `lib/brouillons-quinte/musique.ts`
- Create : `lib/brouillons-quinte/musique.test.ts`

**Interfaces :**
- Produces :
  - `interface BilanMusique { courses: number; victoires: number; top3: number; top5: number; fautes: number; derniereGagnee: boolean }` ;
  - `analyserMusique(musique: string | null | undefined): BilanMusique | null` ;
  - `NB_DERNIERES = 5`.

- [ ] **Step 1 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/musique.test.ts` (les musiques viennent de la fixture du 07/10) :

```ts
import { describe, it, expect } from "vitest";
import { analyserMusique } from "./musique";

describe("analyserMusique — 5 dernières courses, de la plus récente à la plus ancienne", () => {
  it("IMAGE D'ATALANTE : 2-3-2-2-8 → 4 fois dans les 3 premiers, sans faute", () => {
    expect(analyserMusique("2a3a2a2a8a4a0a4a6a4a")).toEqual({
      courses: 5, victoires: 0, top3: 4, top5: 4, fautes: 0, derniereGagnee: false,
    });
  });

  it("JUSTICIA SMART : 4-0-D-D-D → 3 fautes ; 0 = non placé", () => {
    expect(analyserMusique("4a0aDaDaDa5aDa5a4a4a")).toEqual({
      courses: 5, victoires: 0, top3: 0, top5: 1, fautes: 3, derniereGagnee: false,
    });
  });

  it("ignore les marqueurs d'année", () => {
    expect(analyserMusique("9a2a1a1a3a4a1a0a(25)6a")).toEqual({
      courses: 5, victoires: 2, top3: 4, top5: 4, fautes: 0, derniereGagnee: false,
    });
    expect(analyserMusique("(25)1a2a")).toEqual({
      courses: 2, victoires: 1, top3: 2, top5: 2, fautes: 0, derniereGagnee: true,
    });
  });

  it("monté et attelé mêlés (JOIE DE LA COTE)", () => {
    expect(analyserMusique("4a5m2a3a6a5a8a3a4a3m")).toEqual({
      courses: 5, victoires: 0, top3: 2, top5: 4, fautes: 0, derniereGagnee: false,
    });
  });

  it("galop et obstacle : A (arrêté) et T (tombé) sont des fautes", () => {
    expect(analyserMusique("1p3pAh2sTs")).toEqual({
      courses: 5, victoires: 1, top3: 3, top5: 3, fautes: 2, derniereGagnee: true,
    });
  });

  it("une lettre inconnue compte comme course, ni place ni faute", () => {
    expect(analyserMusique("Rp2a")).toEqual({
      courses: 2, victoires: 0, top3: 1, top5: 1, fautes: 0, derniereGagnee: false,
    });
  });

  it("vide, absente ou illisible → null", () => {
    expect(analyserMusique("")).toBeNull();
    expect(analyserMusique(null)).toBeNull();
    expect(analyserMusique(undefined)).toBeNull();
    expect(analyserMusique("abc")).toBeNull();
    expect(analyserMusique("(25)")).toBeNull();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/musique.test.ts`
Expected : FAIL, « Failed to resolve import "./musique" ».

- [ ] **Step 3 : Écrire `lib/brouillons-quinte/musique.ts`**

```ts
/**
 * lib/brouillons-quinte/musique.ts — lecture de la musique PMU (spec §6.3).
 *
 * Jeton = place + discipline : « 2a », « 0a », « Da », « 4m », « 1p », « Ah »…
 * Lus du plus récent au plus ancien ; seuls les 5 premiers comptent. Place
 * 1 à 9 = rang d'arrivée ; 0 = au-delà du 9e. Fautes : D (disqualifié),
 * A (arrêté), T (tombé). Toute autre lettre : course comptée, ni place ni faute.
 */

export const NB_DERNIERES = 5;
const LETTRES_FAUTE = "DAT";

export interface BilanMusique {
  /** Résultats lus (au plus 5). */
  courses: number;
  victoires: number;
  top3: number;
  top5: number;
  fautes: number;
  /** La plus récente des courses lues est une victoire. */
  derniereGagnee: boolean;
}

/** PUR. null si la musique est absente ou illisible. */
export function analyserMusique(musique: string | null | undefined): BilanMusique | null {
  const sansAnnees = String(musique == null ? "" : musique).replace(/\(\d+\)/g, "");
  const jetons = sansAnnees.match(/[0-9A-Z][a-z]/g);
  if (!jetons || jetons.length === 0) return null;
  const bilan: BilanMusique = { courses: 0, victoires: 0, top3: 0, top5: 0, fautes: 0, derniereGagnee: false };
  const lus = jetons.slice(0, NB_DERNIERES);
  for (let i = 0; i < lus.length; i++) {
    const c = lus[i].charAt(0);
    bilan.courses++;
    if (c >= "1" && c <= "9") {
      const place = Number(c);
      if (place === 1) {
        bilan.victoires++;
        if (i === 0) bilan.derniereGagnee = true;
      }
      if (place <= 3) bilan.top3++;
      if (place <= 5) bilan.top5++;
    } else if (LETTRES_FAUTE.indexOf(c) !== -1) {
      bilan.fautes++;
    }
  }
  return bilan;
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte/musique.test.ts`
Expected : PASS (7 tests).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```powershell
git add lib/brouillons-quinte/musique.ts lib/brouillons-quinte/musique.test.ts
git commit -m "feat(brouillons-quinte): lecture de la musique (5 dernières courses, fautes D/A/T)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Fenêtre T-90 et garde-fous

**Files :**
- Create : `lib/brouillons-quinte/fenetre.ts`
- Create : `lib/brouillons-quinte/fenetre.test.ts`

**Interfaces :**
- Consumes : `parisVersUtc(dateISO: string, heure: string): Date | null` (`lib/paris-date.ts`, dans les tests seulement).
- Produces :
  - `FENETRE_MIN = 60`, `FENETRE_MAX = 95`, `DERNIER_PASSAGE_SOUS = 65` ;
  - `SOURCE_BROUILLON = "AUTO-MARCHE"` (type littéral) ;
  - `minutesAvantDepart(depart: Date | null, maintenant?: number): number | null` ;
  - `dansFenetre(minutes: number | null): boolean` ;
  - `dernierPassage(minutes: number | null): boolean` ;
  - `interface PronosticExistant { id: string; niveau_acces: string; publie: boolean; source: string | null }` ;
  - `interface EtatDuJour { existants: PronosticExistant[]; pretsEnvoye: boolean; echecEnvoye: boolean }` ;
  - `type Garde = { action: "preparer" } | { action: "arreter"; raison: "deja_publie" | "brouillons_retires" | "echec_deja_signale" } | { action: "deja_prepare"; idPro: string | null; idElite: string | null }` ;
  - `gardeFous(e: EtatDuJour): Garde`.

- [ ] **Step 1 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/fenetre.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { minutesAvantDepart, dansFenetre, dernierPassage, gardeFous, type EtatDuJour } from "./fenetre";
import { parisVersUtc } from "@/lib/paris-date";

const DEPART = parisVersUtc("2026-10-07", "13:55:00")!;
const a = (iso: string) => Date.parse(iso);

describe("fenêtre des brouillons : de 95 à 60 minutes avant le départ", () => {
  it("Quinté+ du 07/10 : 13h55 à Paris = 11h55 UTC", () => {
    expect(DEPART.toISOString()).toBe("2026-10-07T11:55:00.000Z");
  });

  it("bornes 95 et 60 incluses", () => {
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:20:00Z")))).toBe(true);  // 95
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:19:59Z")))).toBe(false); // 95,02
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:55:00Z")))).toBe(true);  // 60
    expect(dansFenetre(minutesAvantDepart(DEPART, a("2026-10-07T10:55:01Z")))).toBe(false); // 59,98
  });

  it("dernier passage sous 65 minutes", () => {
    expect(dernierPassage(64.9)).toBe(true);
    expect(dernierPassage(65)).toBe(false);
    expect(dernierPassage(null)).toBe(false);
  });

  it("départ inconnu → hors fenêtre", () => {
    expect(minutesAvantDepart(null)).toBeNull();
    expect(dansFenetre(null)).toBe(false);
  });

  it("heure d'hiver (25/10/2026) : 13h55 à Paris = 12h55 UTC", () => {
    const hiver = parisVersUtc("2026-10-25", "13:55:00")!;
    expect(hiver.toISOString()).toBe("2026-10-25T12:55:00.000Z");
    expect(dansFenetre(minutesAvantDepart(hiver, a("2026-10-25T11:25:00Z")))).toBe(true); // 90
  });
});

describe("gardeFous (spec §4 et §10)", () => {
  const vide: EtatDuJour = { existants: [], pretsEnvoye: false, echecEnvoye: false };
  const ligne = (id: string, niveau_acces: string, publie: boolean, source: string | null) => ({ id, niveau_acces, publie, source });

  it("rien en base, rien envoyé → préparer", () => {
    expect(gardeFous(vide)).toEqual({ action: "preparer" });
  });

  it("un PRO ou un ELITE déjà publié à la main → arrêt", () => {
    expect(gardeFous({ ...vide, existants: [ligne("x", "PRO", true, null)] })).toEqual({ action: "arreter", raison: "deja_publie" });
    expect(gardeFous({ ...vide, existants: [ligne("x", "ELITE", true, "ADMIN")] })).toEqual({ action: "arreter", raison: "deja_publie" });
  });

  it("un brouillon manuel ou un GRATUIT publié ne bloquent pas", () => {
    expect(gardeFous({ ...vide, existants: [ligne("x", "PRO", false, null), ligne("y", "GRATUIT", true, null)] })).toEqual({ action: "preparer" });
  });

  it("brouillons AUTO-MARCHE déjà là → déjà préparé, avec leurs identifiants", () => {
    expect(gardeFous({ ...vide, existants: [ligne("a", "PRO", false, "AUTO-MARCHE"), ligne("b", "ELITE", false, "AUTO-MARCHE")] }))
      .toEqual({ action: "deja_prepare", idPro: "a", idElite: "b" });
  });

  it("un brouillon AUTO-MARCHE publié par Steph → arrêt « déjà publié »", () => {
    expect(gardeFous({ ...vide, existants: [ligne("a", "PRO", true, "AUTO-MARCHE"), ligne("b", "ELITE", false, "AUTO-MARCHE")] }))
      .toEqual({ action: "arreter", raison: "deja_publie" });
  });

  it("e-mail « prêts » parti mais brouillons supprimés par Steph → on ne les recrée pas", () => {
    expect(gardeFous({ ...vide, pretsEnvoye: true })).toEqual({ action: "arreter", raison: "brouillons_retires" });
  });

  it("e-mail d'échec déjà parti → plus d'essai ce jour-là", () => {
    expect(gardeFous({ ...vide, echecEnvoye: true })).toEqual({ action: "arreter", raison: "echec_deja_signale" });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/fenetre.test.ts`
Expected : FAIL, « Failed to resolve import "./fenetre" ».

- [ ] **Step 3 : Écrire `lib/brouillons-quinte/fenetre.ts`**

```ts
/**
 * lib/brouillons-quinte/fenetre.ts — faut-il préparer les brouillons maintenant ?
 * Fenêtre T-95 → T-60 et garde-fous (spec §4 et §10).
 *
 * Le cron passe toutes les 5 min : le premier passage dans la fenêtre prépare
 * (entre T-95 et T-90) ; les suivants réessaient si les données manquaient.
 */

export const FENETRE_MIN = 60;
export const FENETRE_MAX = 95;
/** En dessous : dernier passage de la fenêtre → l'e-mail d'échec part. */
export const DERNIER_PASSAGE_SOUS = 65;

/** Valeur de `pronostics.source` des brouillons (spec §8). */
export const SOURCE_BROUILLON = "AUTO-MARCHE";

/** Un PRO ou un ELITE publié sur le Quinté+ : Steph a déjà fait le travail. */
const NIVEAUX_BLOQUANTS = ["PRO", "ELITE"];

/** PUR : minutes entre maintenant et le départ ; null si départ inconnu. */
export function minutesAvantDepart(depart: Date | null, maintenant: number = Date.now()): number | null {
  if (!depart) return null;
  const t = depart.getTime();
  return Number.isFinite(t) ? (t - maintenant) / 60000 : null;
}

/** PUR : 60 ≤ minutes ≤ 95. */
export function dansFenetre(minutes: number | null): boolean {
  return minutes !== null && minutes >= FENETRE_MIN && minutes <= FENETRE_MAX;
}

/** PUR : dernier passage de la fenêtre (minutes < 65). */
export function dernierPassage(minutes: number | null): boolean {
  return minutes !== null && minutes < DERNIER_PASSAGE_SOUS;
}

export interface PronosticExistant {
  id: string;
  niveau_acces: string;
  publie: boolean;
  source: string | null;
}

export interface EtatDuJour {
  /** Pronostics déjà en base sur le Quinté+ du jour. */
  existants: PronosticExistant[];
  /** L'e-mail « prêts » est parti aujourd'hui (statut SENT). */
  pretsEnvoye: boolean;
  /** L'e-mail d'échec est parti aujourd'hui (statut SENT). */
  echecEnvoye: boolean;
}

export type Garde =
  | { action: "preparer" }
  | { action: "arreter"; raison: "deja_publie" | "brouillons_retires" | "echec_deja_signale" }
  | { action: "deja_prepare"; idPro: string | null; idElite: string | null };

/**
 * PUR : décide du passage. Ordre :
 * 1. un PRO ou un ELITE publié → arrêt (Steph a publié, pas de doublon) ;
 * 2. des brouillons AUTO-MARCHE existent → « déjà préparé » (la route relance
 *    l'e-mail « prêts » s'il n'est pas parti) ;
 * 3. e-mail « prêts » parti mais plus de brouillons → Steph les a supprimés :
 *    on ne les recrée pas ;
 * 4. e-mail d'échec parti → une erreur ne se réessaie pas (spec §10).
 */
export function gardeFous(e: EtatDuJour): Garde {
  if (e.existants.some((p) => p.publie && NIVEAUX_BLOQUANTS.indexOf(p.niveau_acces) !== -1)) {
    return { action: "arreter", raison: "deja_publie" };
  }
  const brouillons = e.existants.filter((p) => p.source === SOURCE_BROUILLON);
  if (brouillons.length > 0) {
    const idDe = (niveau: string): string | null => {
      for (const b of brouillons) if (b.niveau_acces === niveau) return b.id;
      return null;
    };
    return { action: "deja_prepare", idPro: idDe("PRO"), idElite: idDe("ELITE") };
  }
  if (e.pretsEnvoye) return { action: "arreter", raison: "brouillons_retires" };
  if (e.echecEnvoye) return { action: "arreter", raison: "echec_deja_signale" };
  return { action: "preparer" };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte/fenetre.test.ts`
Expected : PASS (12 tests).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```powershell
git add lib/brouillons-quinte/fenetre.ts lib/brouillons-quinte/fenetre.test.ts
git commit -m "feat(brouillons-quinte): fenêtre T-95 à T-60 et garde-fous" -m "Déjà publié, déjà préparé (relance de l'e-mail si besoin), brouillons retirés par Steph, échec déjà signalé : fonction pure testée." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Sélection Pro / Elite et confiance

**Files :**
- Create : `lib/brouillons-quinte/selection.ts`
- Create : `lib/brouillons-quinte/selection.test.ts`
- Modify : `lib/brouillons-quinte/__fixtures__/gobelins.ts` (ajouter `TOP8`)

**Interfaces :**
- Consumes :
  - `ParticipantPmu` (tâche 1), `analyserMusique` (tâche 2) ;
  - `NotreSelectionItem { rank: number; numero: number; nom: string; jockey: string|null; cote: number|null; label: SelectionLabel }` et `buildNotreSelection(partants: PartantEnrichi[]): NotreSelectionItem[]` (`lib/courses/notre-selection.ts`) ;
  - `PartantEnrichi` (`lib/courses/stats-types.ts`).
- Produces :
  - `TAILLE_SELECTION = 8`, `FAUTES_ECARTEMENT = 2` ;
  - `interface ChevalClasse { rang: number; numero: number; nom: string; cote: number; fautes: number }` ;
  - `type Confiance = "FAIBLE" | "MOYEN" | "ELEVE"` ;
  - `appliquerCotesPmu<T extends { numero: number; cote?: number | null; non_partant?: boolean | null }>(partantsBase: T[], participants: ParticipantPmu[]): T[]` ;
  - `versChevauxClasses(top8: NotreSelectionItem[], participants: ParticipantPmu[]): ChevalClasse[]` ;
  - `interface DecoupePro { pivot: number; base: number[]; values: number[] }` et `decouperPro(classes: ChevalClasse[]): DecoupePro | null` ;
  - `interface ChoixElite { pivot: number; base: number[]; values: number[]; ecartes: number[]; completeAvecFautifs: boolean }` et `choisirValuesElite(classes: ChevalClasse[]): ChoixElite | null` ;
  - `confianceDuMarche(coteFavori: number): Confiance` ;
  - fixture `TOP8`.

- [ ] **Step 1 : Ajouter `TOP8` à la fixture**

Le fichier `lib/brouillons-quinte/__fixtures__/gobelins.ts` complet devient :

```ts
/**
 * Quinté+ du 07/10/2026 — Prix des Gobelins, Enghien R1C1 : réponses PMU
 * RÉELLES, relevées après le départ (cotes figées à 11h55 GMT). Le n°12 JUNON
 * DE LOU a été déclaré non partant vers 11h34 : un vrai cas de non-partant
 * tardif. Partagé par les tests.
 */
import participantsJson from "./pmu-participants-20261007-R1C1.json";
import courseJson from "./pmu-course-20261007-R1C1.json";
import { lireParticipantsPmu, lireCoursePmu, type ParticipantPmu } from "../pmu";
import { buildNotreSelection } from "@/lib/courses/notre-selection";
import type { PartantEnrichi } from "@/lib/courses/stats-types";

export const PARTICIPANTS = lireParticipantsPmu(participantsJson);
export const COURSE_PMU = lireCoursePmu(courseJson);

/** Partant enrichi « neutre » : sans la base, ni statistique ni note composite. */
function enrichiNeutre(p: ParticipantPmu): PartantEnrichi {
  return {
    id: String(p.numero),
    numero: p.numero,
    nom_cheval: p.nom,
    jockey: p.driver,
    entraineur: p.entraineur,
    cote: p.cote,
    musique: p.musique,
    poids_kg: null,
    stats_cheval: null,
    stats_jockey: null,
    stats_entraineur: null,
    forme_musique: null,
    score_composite: 0,
    score_breakdown: { cote: 0, vict_cheval: 0, forme_musique: 0, vict_jockey: 0 },
    badges: { vedette: false, value_bet: false, favori: false },
  };
}

/**
 * Les 8 favoris comme la route les obtient : non-partants exclus, puis
 * buildNotreSelection. Ce jour-là : 17, 16, 5, 13, 10, 15, 18, 11. Les n°11 et
 * n°14 sont à égalité à 15 : la route les départage par la note composite ;
 * ici, sans la base, le numéro départage.
 */
export const TOP8 = buildNotreSelection(PARTICIPANTS.filter((p) => !p.nonPartant).map(enrichiNeutre));
```

- [ ] **Step 2 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/selection.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  appliquerCotesPmu, versChevauxClasses, decouperPro, choisirValuesElite, confianceDuMarche,
  type ChevalClasse,
} from "./selection";
import { PARTICIPANTS, TOP8 } from "./__fixtures__/gobelins";
import type { ParticipantPmu } from "./pmu";

const CLASSES = versChevauxClasses(TOP8, PARTICIPANTS);

describe("versChevauxClasses — les 8 favoris du 07/10/2026 au départ", () => {
  it("ordre du marché : 17, 16, 5, 13, 10, 15, 18, 11 (le n°12, non partant, n'y est pas)", () => {
    expect(CLASSES.map((c) => c.numero)).toEqual([17, 16, 5, 13, 10, 15, 18, 11]);
    expect(CLASSES.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("fautes lues dans la musique PMU, noms PMU", () => {
    expect(CLASSES.map((c) => c.fautes)).toEqual([0, 0, 2, 0, 3, 1, 0, 0]);
    expect(CLASSES[0]).toEqual({ rang: 1, numero: 17, nom: "IMAGE D'ATALANTE", cote: 3.8, fautes: 0 });
  });

  it("musique absente → 0 faute : on n'invente pas d'écart", () => {
    const sansMusique = PARTICIPANTS.map((p) => (p.numero === 10 ? { ...p, musique: null } : p));
    expect(versChevauxClasses(TOP8, sansMusique).find((c) => c.numero === 10)!.fautes).toBe(0);
  });
});

describe("decouperPro", () => {
  it("base = rangs 1 à 3 (pivot = le favori), values = rangs 4 à 6", () => {
    expect(decouperPro(CLASSES)).toEqual({ pivot: 17, base: [17, 16, 5], values: [13, 10, 15] });
  });

  it("moins de 6 chevaux → null", () => {
    expect(decouperPro(CLASSES.slice(0, 5))).toBeNull();
  });
});

describe("choisirValuesElite", () => {
  it("07/10 au départ : 15, 18, 11 ; aucun écarté (le 10 n'avait pas une des 3 plus grosses cotes)", () => {
    expect(choisirValuesElite(CLASSES)).toEqual({
      pivot: 17, base: [17, 16, 5], values: [15, 18, 11], ecartes: [], completeAvecFautifs: false,
    });
  });

  it("exemple de la spec (cotes de 11h30, n°12 encore partant) : values 18, 15, 14 ; le 10 écarté", () => {
    const c: ChevalClasse[] = [
      { rang: 1, numero: 17, nom: "A", cote: 4.2, fautes: 0 },
      { rang: 2, numero: 12, nom: "B", cote: 6.9, fautes: 2 },
      { rang: 3, numero: 16, nom: "C", cote: 9.1, fautes: 0 },
      { rang: 4, numero: 13, nom: "D", cote: 10, fautes: 0 },
      { rang: 5, numero: 18, nom: "E", cote: 11, fautes: 0 },
      { rang: 6, numero: 15, nom: "F", cote: 12, fautes: 1 },
      { rang: 7, numero: 10, nom: "G", cote: 13, fautes: 3 },
      { rang: 8, numero: 14, nom: "H", cote: 13, fautes: 0 },
    ];
    expect(choisirValuesElite(c)).toMatchObject({ values: [18, 15, 14], ecartes: [10], completeAvecFautifs: false });
  });

  it("à cote égale : le moins de fautes, puis le meilleur rang", () => {
    const base: ChevalClasse[] = [1, 2, 3].map((r) => ({ rang: r, numero: r, nom: "X", cote: r, fautes: 0 }));
    const c = base.concat([
      { rang: 4, numero: 21, nom: "X", cote: 13, fautes: 0 },
      { rang: 5, numero: 22, nom: "X", cote: 12, fautes: 1 },
      { rang: 6, numero: 23, nom: "X", cote: 12, fautes: 1 },
      { rang: 7, numero: 24, nom: "X", cote: 12, fautes: 0 },
      { rang: 8, numero: 25, nom: "X", cote: 5, fautes: 0 },
    ]);
    expect(choisirValuesElite(c)!.values).toEqual([21, 22, 24]);
  });

  it("moins de 3 sans fautes : complété avec les moins fautifs, signalé", () => {
    const base: ChevalClasse[] = [1, 2, 3].map((r) => ({ rang: r, numero: r, nom: "X", cote: r, fautes: 0 }));
    const c = base.concat([
      { rang: 4, numero: 4, nom: "X", cote: 10, fautes: 0 },
      { rang: 5, numero: 5, nom: "X", cote: 12, fautes: 2 },
      { rang: 6, numero: 6, nom: "X", cote: 15, fautes: 3 },
      { rang: 7, numero: 7, nom: "X", cote: 20, fautes: 2 },
      { rang: 8, numero: 8, nom: "X", cote: 8, fautes: 4 },
    ]);
    expect(choisirValuesElite(c)).toEqual({
      pivot: 1, base: [1, 2, 3], values: [4, 5, 7], ecartes: [6], completeAvecFautifs: true,
    });
  });

  it("moins de 8 chevaux → null", () => {
    expect(choisirValuesElite(CLASSES.slice(0, 7))).toBeNull();
  });
});

describe("confianceDuMarche (cote du favori)", () => {
  it("sous 3 → Élevé ; de 3 à 6 → Moyen ; au-dessus → Faible", () => {
    expect(confianceDuMarche(2.9)).toBe("ELEVE");
    expect(confianceDuMarche(3)).toBe("MOYEN");
    expect(confianceDuMarche(6)).toBe("MOYEN");
    expect(confianceDuMarche(6.1)).toBe("FAIBLE");
    expect(confianceDuMarche(3.8)).toBe("MOYEN"); // 07/10 au départ
  });
});

describe("appliquerCotesPmu", () => {
  const pmu = (numero: number, nonPartant: boolean, cote: number | null): ParticipantPmu => ({
    numero, nom: `N${numero}`, nonPartant, cote, coteMaj: cote === null ? null : 1,
    driver: null, entraineur: null, musique: null, sexe: null, age: null, distance: null,
  });
  const base = [
    { id: "a", numero: 1, nom_cheval: "N1", cote: 99, non_partant: false },
    { id: "b", numero: 2, nom_cheval: "N2", cote: 7, non_partant: false },
    { id: "c", numero: 3, nom_cheval: "N3", cote: 5, non_partant: true },
    { id: "d", numero: 4, nom_cheval: "N4", cote: 4, non_partant: false },
  ];
  const r = appliquerCotesPmu(base, [pmu(1, false, 3.5), pmu(2, true, null), pmu(3, false, 6)]);

  it("la cote du PMU remplace celle de la base", () => {
    expect(r[0].cote).toBe(3.5);
  });

  it("non-partant déclaré au PMU seulement → exclu", () => {
    expect(r[1].non_partant).toBe(true);
    expect(r.filter((p) => !p.non_partant).map((p) => p.numero)).toEqual([1, 4]);
  });

  it("un non-partant de la base le reste", () => {
    expect(r[2].non_partant).toBe(true);
  });

  it("cheval absent du PMU → pas de cote (il ne sera pas classé)", () => {
    expect(r[3].cote).toBeNull();
  });

  it("07/10 réel : le n°12 JUNON DE LOU, encore partant en base, sort au PMU", () => {
    const enBase = PARTICIPANTS.map((p) => ({ id: String(p.numero), numero: p.numero, nom_cheval: p.nom, cote: 99, non_partant: false }));
    const apres = appliquerCotesPmu(enBase, PARTICIPANTS);
    expect(apres.find((p) => p.numero === 12)!.non_partant).toBe(true);
    expect(apres.filter((p) => !p.non_partant)).toHaveLength(17);
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/selection.test.ts`
Expected : FAIL, « Failed to resolve import "./selection" ».

- [ ] **Step 4 : Écrire `lib/brouillons-quinte/selection.ts`**

```ts
/**
 * lib/brouillons-quinte/selection.ts — Pro, Elite et confiance (spec §6).
 *
 * Les 8 favoris arrivent déjà dans l'ordre du marché (buildNotreSelection, le
 * même que la Sélection stats du site). Pro = rangs 1 à 6 ; Elite = la même
 * base de 3 + 3 values choisies parmi les rangs 4 à 8 (décision de Steph du
 * 07/10/2026).
 */
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";
import type { ParticipantPmu } from "./pmu";
import { analyserMusique } from "./musique";

export const TAILLE_SELECTION = 8;
/** Écarté des values Elite à partir de 2 fautes sur les 5 dernières courses. */
export const FAUTES_ECARTEMENT = 2;

export interface ChevalClasse {
  /** Rang au marché (1 = favori). */
  rang: number;
  numero: number;
  /** Nom tel que le PMU l'écrit. */
  nom: string;
  cote: number;
  /** Fautes sur les 5 dernières courses ; 0 si la musique est inconnue. */
  fautes: number;
}

export type Confiance = "FAIBLE" | "MOYEN" | "ELEVE";

function indexer(participants: ParticipantPmu[]): Record<number, ParticipantPmu> {
  const parNumero: Record<number, ParticipantPmu> = {};
  for (const p of participants) parNumero[p.numero] = p;
  return parNumero;
}

/**
 * PUR : partants de la base avec la cote et le statut du PMU (à appeler APRÈS
 * le contrôle d'identité). Absent du PMU → pas de cote, donc pas classé.
 */
export function appliquerCotesPmu<T extends { numero: number; cote?: number | null; non_partant?: boolean | null }>(
  partantsBase: T[],
  participants: ParticipantPmu[],
): T[] {
  const parNumero = indexer(participants);
  return partantsBase.map((b) => {
    const pmu = parNumero[b.numero];
    return {
      ...b,
      cote: pmu ? pmu.cote : null,
      non_partant: Boolean(b.non_partant) || Boolean(pmu && pmu.nonPartant),
    };
  });
}

/** PUR : les favoris classés, avec le nom PMU et les fautes de la musique PMU. */
export function versChevauxClasses(top8: NotreSelectionItem[], participants: ParticipantPmu[]): ChevalClasse[] {
  const parNumero = indexer(participants);
  const out: ChevalClasse[] = [];
  for (const it of top8) {
    if (typeof it.cote !== "number") continue;
    const pmu = parNumero[it.numero];
    const bilan = analyserMusique(pmu ? pmu.musique : null);
    out.push({ rang: it.rank, numero: it.numero, nom: pmu ? pmu.nom : it.nom, cote: it.cote, fautes: bilan ? bilan.fautes : 0 });
  }
  return out;
}

export interface DecoupePro {
  pivot: number;
  base: number[];
  values: number[];
}

/** PUR : base = rangs 1 à 3, values = rangs 4 à 6. null sous 6 chevaux. */
export function decouperPro(classes: ChevalClasse[]): DecoupePro | null {
  if (classes.length < 6) return null;
  const tries = classes.slice().sort((a, b) => a.rang - b.rang);
  return {
    pivot: tries[0].numero,
    base: tries.slice(0, 3).map((c) => c.numero),
    values: tries.slice(3, 6).map((c) => c.numero),
  };
}

export interface ChoixElite {
  pivot: number;
  base: number[];
  /** Par rang croissant. */
  values: number[];
  /** Fautifs que la règle « plus grosses cotes » aurait retenus sans leurs fautes. */
  ecartes: number[];
  /** Moins de 3 values sans fautes : complété avec des fautifs. */
  completeAvecFautifs: boolean;
}

/** PUR : la règle des values Elite (spec §6.2). null sous 8 chevaux. */
export function choisirValuesElite(classes: ChevalClasse[]): ChoixElite | null {
  if (classes.length < TAILLE_SELECTION) return null;
  const tries = classes.slice().sort((a, b) => a.rang - b.rang);
  const candidats = tries.slice(3, TAILLE_SELECTION);

  const retenus = candidats
    .filter((c) => c.fautes < FAUTES_ECARTEMENT)
    .sort((a, b) => b.cote - a.cote || a.fautes - b.fautes || a.rang - b.rang)
    .slice(0, 3);

  let completeAvecFautifs = false;
  if (retenus.length < 3) {
    const fautifs = candidats
      .filter((c) => c.fautes >= FAUTES_ECARTEMENT)
      .sort((a, b) => a.fautes - b.fautes || b.cote - a.cote || a.rang - b.rang);
    for (let i = 0; i < fautifs.length && retenus.length < 3; i++) {
      retenus.push(fautifs[i]);
      completeAvecFautifs = true;
    }
  }

  const numerosRetenus = retenus.map((c) => c.numero);
  const sansRegle = candidats.slice().sort((a, b) => b.cote - a.cote || a.rang - b.rang).slice(0, 3);
  const ecartes = sansRegle
    .filter((c) => c.fautes >= FAUTES_ECARTEMENT && numerosRetenus.indexOf(c.numero) === -1)
    .sort((a, b) => a.rang - b.rang)
    .map((c) => c.numero);

  return {
    pivot: tries[0].numero,
    base: tries.slice(0, 3).map((c) => c.numero),
    values: retenus.slice().sort((a, b) => a.rang - b.rang).map((c) => c.numero),
    ecartes,
    completeAvecFautifs,
  };
}

/** PUR : confiance selon la cote du favori (décision de Steph du 07/10/2026). */
export function confianceDuMarche(coteFavori: number): Confiance {
  if (coteFavori < 3) return "ELEVE";
  if (coteFavori <= 6) return "MOYEN";
  return "FAIBLE";
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte/selection.test.ts`
Expected : PASS (tous).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur (la fixture `gobelins.ts` est vérifiée par `tsc`).

- [ ] **Step 6 : Commit**

```powershell
git add lib/brouillons-quinte/selection.ts lib/brouillons-quinte/selection.test.ts lib/brouillons-quinte/__fixtures__/gobelins.ts
git commit -m "feat(brouillons-quinte): sélection Pro et Elite, confiance selon le marché" -m "Pro = rangs 1 à 6 ; Elite = base de 3 + les 3 plus grosses cotes des rangs 4 à 8 sans les fautifs (≥ 2 fautes sur 5), complété si besoin ; confiance : favori < 3 Élevé, 3 à 6 Moyen, > 6 Faible. Non-partant déclaré au PMU exclu (cas réel du 07/10)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Commentaires (analyse courte et analyse complète)

**Files :**
- Create : `lib/brouillons-quinte/commentaires.ts`
- Create : `lib/brouillons-quinte/commentaires.test.ts`
- Modify : `lib/brouillons-quinte/__fixtures__/gobelins.ts` (ajouter `CTX_ROUTE` et `CTX`)

**Interfaces :**
- Consumes : `ParticipantPmu`, `CoursePmu` (tâche 1) ; `analyserMusique`, `BilanMusique` (tâche 2).
- Produces :
  - `interface ContexteCourse { dateISO: string; prix: string; hippodrome: string; reunion: number; course: number; heureParis: string; departUtc: Date; coursePmu: CoursePmu|null; distanceBase: number|null; participants: ParticipantPmu[]; releveCotes: number|null }` ;
  - `interface ChevalCommente { numero: number; nom: string; rang: number }` ;
  - `ANALYSE_COURTE_MAX = 160`, `MOTS_INTERDITS: string[]` ;
  - `heureGmt(ms: number): string` (« 11h55 ») ;
  - `analyseCourte(ctx: ContexteCourse, pivot: ChevalCommente): string` ;
  - `analyseComplete(ctx: ContexteCourse, niveau: "PRO" | "ELITE", base: ChevalCommente[], values: ChevalCommente[], ecartes: ChevalCommente[]): string` ;
  - fixtures `CTX_ROUTE: Omit<ContexteCourse, "releveCotes">` et `CTX: ContexteCourse`.

- [ ] **Step 1 : Ajouter les contextes de test à la fixture**

Ajouter l'import en tête de `lib/brouillons-quinte/__fixtures__/gobelins.ts` :

```ts
import type { ContexteCourse } from "../commentaires";
```

et ce bloc en fin de fichier :

```ts
/** Contexte tel que la route le passe à l'assembleur (l'heure du relevé est calculée par lui). */
export const CTX_ROUTE: Omit<ContexteCourse, "releveCotes"> = {
  dateISO: "2026-10-07",
  prix: "Prix des Gobelins",
  hippodrome: "Enghien",
  reunion: 1,
  course: 1,
  heureParis: "13:55:00",
  departUtc: new Date("2026-10-07T11:55:00Z"),
  coursePmu: COURSE_PMU,
  distanceBase: 2875,
  participants: PARTICIPANTS,
};

/** Contexte complet : cotes des 8 favoris relevées à 11h55 GMT. */
export const CTX: ContexteCourse = { ...CTX_ROUTE, releveCotes: 1791374156000 };
```

- [ ] **Step 2 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/commentaires.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { analyseCourte, analyseComplete, heureGmt, MOTS_INTERDITS, type ChevalCommente, type ContexteCourse } from "./commentaires";
import { CTX, PARTICIPANTS } from "./__fixtures__/gobelins";

const c = (numero: number, rang: number): ChevalCommente => ({
  numero, rang, nom: PARTICIPANTS.find((p) => p.numero === numero)!.nom,
});
const BASE = [c(17, 1), c(16, 2), c(5, 3)];
const VALUES_PRO = [c(13, 4), c(10, 5), c(15, 6)];
const VALUES_ELITE = [c(15, 6), c(18, 7), c(11, 8)];
const PRO = analyseComplete(CTX, "PRO", BASE, VALUES_PRO, []);
const ELITE = analyseComplete(CTX, "ELITE", BASE, VALUES_ELITE, []);
/** Variante avec un écarté, pour la phrase « n'est pas retenue ». */
const ELITE_ECARTE = analyseComplete(CTX, "ELITE", BASE, VALUES_ELITE, [c(10, 5)]);
/** Le n°12 remis partant : le groupe reculé redevient la suite 10 à 18. */
const AVEC_12 = PARTICIPANTS.map((p) => (p.numero === 12 ? { ...p, nonPartant: false } : p));

describe("analyseCourte", () => {
  it("Quinté+ du 07/10/2026 (n°12 non partant : les reculés ne forment plus une suite)", () => {
    expect(analyseCourte(CTX, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 17 partantes. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. 8 partantes partent avec 25 m de recul.",
    );
  });

  it("groupe reculé en suite : les numéros sont cités", () => {
    expect(analyseCourte({ ...CTX, participants: AVEC_12 }, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 18 partantes. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. Les n°10 à 18 partent avec 25 m de recul.",
    );
  });

  it("160 caractères au plus, quel que soit le pivot", () => {
    for (const p of PARTICIPANTS) {
      expect(analyseCourte(CTX, { numero: p.numero, nom: p.nom, rang: 1 }).length).toBeLessThanOrEqual(160);
    }
  });

  it("trop long : la phrase de recul part d'abord, jamais de mot coupé", () => {
    const t = analyseCourte(CTX, { numero: 17, rang: 1, nom: "X".repeat(70) });
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t).not.toContain("recul");
    expect(t).toContain(`Pivot : ${"X".repeat(70)} (n°17, F. NIVARD), favorite.`);
  });

  it("encore trop long : le driver part ensuite", () => {
    const t = analyseCourte(CTX, { numero: 17, rang: 1, nom: "X".repeat(110) });
    expect(t).toBe(`Pivot : ${"X".repeat(110)} (n°17), favorite.`);
  });
});

describe("analyseComplete — Pro du 07/10/2026", () => {
  it("la course", () => {
    expect(PRO).toContain("Quinté+ du mercredi 7 octobre 2026 : Prix des Gobelins, Enghien (R1C1), départ 11h55 GMT (13h55 heure de Paris).");
    expect(PRO).toContain("Trot attelé, 2 875 m, 17 partantes de 7 à 8 ans.");
    expect(PRO).toContain("Les n°10, 11 et 13 à 18 partent 25 m derrière, sur 2 900 m.");
  });

  it("la base, pivot en tête", () => {
    expect(PRO).toContain("⭐ n°17 IMAGE D'ATALANTE — driver F. NIVARD, entraîneur D. CHERBONNEL. Favorite du marché. Dans les 3 premières 4 fois sur ses 5 dernières courses, sans faute. Notre pivot.");
    expect(PRO).toContain("n°16 JAIN MAB — driver A. BARRIER, entraîneur A. BUISSON. 2e du marché. Dans les 5 premières 3 fois sur 5, sans faute.");
    expect(PRO).toContain("n°5 JEUNE ORANGE COTON — driver A. ANDRE, entraîneur Antonin ANDRE. 3e du marché. A gagné 1 de ses 5 dernières courses ; 2 fautes sur ses 5 dernières courses.");
  });

  it("les values", () => {
    expect(PRO).toContain("n°13 IDOLE ELDE — driver M. MOTTIER, entraîneur N. LEMETAYER. 4e du marché. A gagné 2 de ses 5 dernières courses, sans faute.");
    expect(PRO).toContain("n°10 JUSTICIA SMART — driver M. ABRIVARD, entraîneur J. DUBREIL. 5e du marché. 3 fautes sur ses 5 dernières courses.");
    expect(PRO).toContain("n°15 IXELLE BLEUE — driver TH. BRIAND, entraîneur Antoine TRIHOLLET. 6e du marché. A gagné 1 de ses 5 dernières courses ; 1 faute sur ses 5 dernières courses.");
  });

  it("à savoir", () => {
    expect(PRO).toContain("Cotes PMU relevées à 11h55 GMT, indicatives : elles évoluent jusqu'au départ. Le jeu comporte des risques : jouez responsable.");
  });

  it("sections dans l'ordre, rien de propre à l'Elite", () => {
    const i = ["LA COURSE", "LA BASE", "LES VALUES", "À SAVOIR"].map((t) => PRO.indexOf(t));
    expect(i.every((x) => x >= 0)).toBe(true);
    expect(i).toEqual(i.slice().sort((a, b) => a - b));
    expect(PRO).not.toContain("Retenue pour sa cote");
    expect(PRO).not.toContain("n'est pas retenue");
  });
});

describe("analyseComplete — Elite du 07/10/2026", () => {
  it("values retenues pour leur cote", () => {
    expect(ELITE).toContain("n°15 IXELLE BLEUE — driver TH. BRIAND, entraîneur Antoine TRIHOLLET. 6e du marché. A gagné 1 de ses 5 dernières courses ; 1 faute sur ses 5 dernières courses. Retenue pour sa cote parmi nos 8.");
    expect(ELITE).toContain("n°18 JOIE DE LA COTE — driver E. RAFFIN, entraîneur S. LALOUM. 7e du marché. Dans les 3 premières 2 fois sur ses 5 dernières courses, sans faute. Retenue pour sa cote parmi nos 8.");
    expect(ELITE).toContain("n°11 JALOUZ D'OLIVERIE — driver L. BAUDOUIN, entraîneur J.M. BAUDOUIN. 8e du marché. Dans les 3 premières 3 fois sur ses 5 dernières courses, sans faute. Retenue pour sa cote parmi nos 8.");
  });

  it("aucun écarté ce jour-là : pas de phrase « n'est pas retenue »", () => {
    expect(ELITE).not.toContain("n'est pas retenue");
  });

  it("un écarté est nommé, avec ses fautes", () => {
    expect(ELITE_ECARTE).toContain("n°10 JUSTICIA SMART (5e du marché) n'est pas retenue : 3 fautes sur ses 5 dernières courses.");
  });
});

describe("distances (phrase de recul seulement s'il y a plusieurs distances)", () => {
  it("une seule distance : aucune phrase de recul", () => {
    const ctx = { ...CTX, participants: PARTICIPANTS.map((p) => ({ ...p, distance: 2875 })) };
    expect(analyseCourte(ctx, BASE[0])).not.toContain("recul");
    expect(analyseComplete(ctx, "PRO", BASE, VALUES_PRO, [])).not.toContain("derrière");
  });

  it("un seul cheval reculé : « Le n°… part »", () => {
    const ctx = { ...CTX, participants: PARTICIPANTS.map((p) => ({ ...p, distance: p.numero === 18 ? 2900 : 2875 })) };
    expect(analyseCourte(ctx, BASE[0])).toContain("Le n°18 part avec 25 m de recul.");
    expect(analyseComplete(ctx, "PRO", BASE, VALUES_PRO, [])).toContain("Le n°18 part 25 m derrière, sur 2 900 m.");
  });

  it("trois distances : rien dans l'analyse courte, une phrase par groupe dans la complète", () => {
    const parts = PARTICIPANTS.map((p) => ({ ...p, distance: p.numero <= 9 ? 2875 : p.numero <= 14 ? 2900 : 2925 }));
    const ctx = { ...CTX, participants: parts };
    expect(analyseCourte(ctx, BASE[0])).not.toContain("recul");
    const t = analyseComplete(ctx, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("Les n°10, 11, 13 et 14 partent 25 m derrière, sur 2 900 m.");
    expect(t).toContain("Les n°15 à 18 partent 50 m derrière, sur 2 925 m.");
  });

  it("le n°12 remis partant : « Les n°10 à 18 » dans l'analyse complète", () => {
    expect(analyseComplete({ ...CTX, participants: AVEC_12 }, "PRO", BASE, VALUES_PRO, [])).toContain("Les n°10 à 18 partent 25 m derrière, sur 2 900 m.");
  });
});

describe("garanties (spec §7)", () => {
  const TEXTES = [PRO, ELITE, ELITE_ECARTE, analyseCourte(CTX, BASE[0])];

  it("aucun numéro absent des données", () => {
    const connus = PARTICIPANTS.map((p) => p.numero);
    for (const t of TEXTES) {
      const re = /n°(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) expect(connus).toContain(Number(m[1]));
    }
  });

  it("chaque cheval cité porte son nom PMU", () => {
    for (const t of [PRO, ELITE, ELITE_ECARTE]) {
      const lignes = t.split("\n").filter((l) => /^(⭐ )?n°\d+ /.test(l));
      expect(lignes.length).toBeGreaterThanOrEqual(6);
      for (const l of lignes) {
        const m = l.match(/^(?:⭐ )?n°(\d+) (.+?)(?: —| \(|\.)/);
        expect(m).not.toBeNull();
        expect(m![2]).toBe(PARTICIPANTS.find((p) => p.numero === Number(m![1]))!.nom);
      }
    }
  });

  it("le n°12, non partant, n'est jamais cité", () => {
    for (const t of TEXTES) {
      expect(t).not.toContain("JUNON");
      expect(/n°12\b/.test(t)).toBe(false);
    }
  });

  it("aucun mot interdit", () => {
    for (const t of TEXTES) {
      const bas = t.toLowerCase();
      for (const mot of MOTS_INTERDITS) expect(bas).not.toContain(mot);
    }
  });

  it("heureGmt", () => {
    expect(heureGmt(Date.parse("2026-10-07T09:05:00Z"))).toBe("09h05");
  });
});

describe("Review Focus — données incomplètes ou différentes", () => {
  it("réponse « course » du PMU absente : ni discipline ni libellé driver/jockey ; distance tirée des partants", () => {
    const sansCourse: ContexteCourse = { ...CTX, coursePmu: null };
    const courte = analyseCourte(sansCourse, BASE[0]);
    expect(courte).toBe("2 875 m, 17 partants. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. 8 partants partent avec 25 m de recul.");
    const t = analyseComplete(sansCourse, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("2 875 m, 17 partants de 7 à 8 ans.");
    expect(t).toContain("⭐ n°17 IMAGE D'ATALANTE — F. NIVARD, entraîneur D. CHERBONNEL. Favorite du marché.");
    expect(t).not.toMatch(/driver|jockey|Trot|Plat/);
  });

  it("driver ou entraîneur absent : ligne propre", () => {
    const parts = PARTICIPANTS.map((p) => {
      if (p.numero === 17) return { ...p, driver: null, entraineur: null };
      if (p.numero === 16) return { ...p, entraineur: null };
      return p;
    });
    const ctx = { ...CTX, participants: parts };
    const t = analyseComplete(ctx, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("⭐ n°17 IMAGE D'ATALANTE. Favorite du marché.");
    expect(t).toContain("n°16 JAIN MAB — driver A. BARRIER. 2e du marché.");
    expect(t).not.toContain("— ,");
    expect(t).not.toContain("null");
    expect(analyseCourte(ctx, BASE[0])).toContain("Pivot : IMAGE D'ATALANTE (n°17), favorite.");
  });

  it("champ mixte : formes masculines", () => {
    const parts = PARTICIPANTS.map((p) => ({ ...p, sexe: "MALES" }));
    const mixte: ContexteCourse = { ...CTX, coursePmu: { ...CTX.coursePmu!, conditionSexe: null }, participants: parts };
    expect(analyseCourte(mixte, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 17 partants. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favori. 8 partants partent avec 25 m de recul.",
    );
    const t = analyseComplete(mixte, "ELITE", BASE, VALUES_ELITE, [c(10, 5)]);
    expect(t).toContain("Favori du marché. Dans les 3 premiers 4 fois sur ses 5 dernières courses");
    expect(t).toContain("Retenu pour sa cote parmi nos 8.");
    expect(t).toContain("n°10 JUSTICIA SMART (5e du marché) n'est pas retenu : 3 fautes");
    expect(t).not.toMatch(/premières|Retenue|Favorite|partantes/);
  });

  it("musique absente : pas de phrase de forme", () => {
    const parts = PARTICIPANTS.map((p) => (p.numero === 13 ? { ...p, musique: null } : p));
    const t = analyseComplete({ ...CTX, participants: parts }, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("n°13 IDOLE ELDE — driver M. MOTTIER, entraîneur N. LEMETAYER. 4e du marché.\n");
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/commentaires.test.ts`
Expected : FAIL, « Failed to resolve import "./commentaires" ».

- [ ] **Step 4 : Écrire `lib/brouillons-quinte/commentaires.ts`**

```ts
/**
 * lib/brouillons-quinte/commentaires.ts — textes des brouillons (spec §7).
 *
 * Modèles de phrases FIXES, remplis uniquement avec les données PMU. Aucune
 * opinion ; un fait manquant fait omettre la phrase. Noms recopiés tels que le
 * PMU les écrit. Steph peut tout modifier avant de publier.
 *
 * Réponse « course » du PMU absente : discipline et libellé driver/jockey sont
 * omis. `courses.categorie` n'est PAS un repli : elle a longtemps été écrite
 * « PLAT » par défaut (migration 20260515_backfill_discipline_trot).
 */
import type { CoursePmu, ParticipantPmu } from "./pmu";
import { analyserMusique, type BilanMusique } from "./musique";

export const ANALYSE_COURTE_MAX = 160;

/** Vérifiés par les tests : jamais dans un texte produit. */
export const MOTS_INTERDITS = ["garanti", "assuré", "sûr", "certain", "immanquable", "coup sûr", "100 %", "jackpot", "gagnant à coup"];

export interface ContexteCourse {
  /** Date de la course (Paris), AAAA-MM-JJ. */
  dateISO: string;
  /** Libellé du site (courses.libelle), ex. « Prix des Gobelins ». */
  prix: string;
  hippodrome: string;
  reunion: number;
  course: number;
  /** Heure de départ en base (Paris), « 13:55:00 ». */
  heureParis: string;
  departUtc: Date;
  coursePmu: CoursePmu | null;
  /** Repli si ni les partants ni la course PMU ne donnent la distance. */
  distanceBase: number | null;
  /** Partants PMU, non-partants compris (ils sont écartés ici). */
  participants: ParticipantPmu[];
  /** Plus récente des cotes utilisées (ms) ; null si inconnue. */
  releveCotes: number | null;
}

export interface ChevalCommente {
  numero: number;
  nom: string;
  rang: number;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DISCIPLINES: Record<string, string> = {
  TROT_ATTELE: "Trot attelé",
  TROT_MONTE: "Trot monté",
  PLAT: "Plat",
  HAIES: "Haies",
  STEEPLECHASE: "Steeple-chase",
  CROSS: "Cross",
};

function deux(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** « 11h55 » (heure UTC = GMT). */
export function heureGmt(ms: number): string {
  const d = new Date(ms);
  return `${deux(d.getUTCHours())}h${deux(d.getUTCMinutes())}`;
}

function heureParisLisible(heure: string): string {
  const m = String(heure).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${deux(Number(m[1]))}h${m[2]}` : heure;
}

function dateLongue(dateISO: string): string {
  const m = String(dateISO).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${JOURS[d.getUTCDay()]} ${Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** 2875 → « 2 875 ». */
function metres(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function partantsDe(ctx: ContexteCourse): ParticipantPmu[] {
  return ctx.participants.filter((p) => !p.nonPartant);
}

function trouver(ctx: ContexteCourse, numero: number): ParticipantPmu | null {
  for (const p of ctx.participants) if (p.numero === numero) return p;
  return null;
}

function feminin(p: ParticipantPmu | null): boolean {
  return !!p && p.sexe === "FEMELLES";
}

function champFeminin(ctx: ContexteCourse): boolean {
  return !!ctx.coursePmu && ctx.coursePmu.conditionSexe === "FEMELLES";
}

function discipline(ctx: ContexteCourse): string | null {
  const s = ctx.coursePmu ? ctx.coursePmu.specialite : null;
  return s && DISCIPLINES[s] ? DISCIPLINES[s] : null;
}

/** « driver » au trot attelé, « jockey » sinon ; null si la discipline est inconnue. */
function libelleActeur(ctx: ContexteCourse): string | null {
  const s = ctx.coursePmu ? ctx.coursePmu.specialite : null;
  if (!s || !DISCIPLINES[s]) return null;
  return s === "TROT_ATTELE" ? "driver" : "jockey";
}

interface GroupeDistance {
  distance: number;
  numeros: number[];
}

function groupesDistance(partants: ParticipantPmu[]): GroupeDistance[] {
  const groupes: GroupeDistance[] = [];
  for (const p of partants) {
    if (p.distance === null) continue;
    let g: GroupeDistance | null = null;
    for (const x of groupes) if (x.distance === p.distance) g = x;
    if (!g) {
      g = { distance: p.distance, numeros: [] };
      groupes.push(g);
    }
    g.numeros.push(p.numero);
  }
  for (const g of groupes) g.numeros.sort((a, b) => a - b);
  return groupes.sort((a, b) => a.distance - b.distance);
}

function distanceDeBase(ctx: ContexteCourse, groupes: GroupeDistance[]): number | null {
  if (groupes.length > 0) return groupes[0].distance;
  if (ctx.coursePmu && ctx.coursePmu.distance) return ctx.coursePmu.distance;
  return ctx.distanceBase;
}

/** [10, 11, 13, 14, 15] → « 10, 11 et 13 à 15 » : une suite de 3 numéros ou plus est resserrée. */
function listeNumeros(nums: number[]): string {
  const morceaux: string[] = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) {
      morceaux.push(`${nums[i]} à ${nums[j]}`);
    } else {
      for (let k = i; k <= j; k++) morceaux.push(String(nums[k]));
    }
    i = j + 1;
  }
  if (morceaux.length <= 1) return morceaux.join("");
  return `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}`;
}

/** Recul pour l'analyse courte : exactement deux distances, sinon rien. */
function phraseReculCourte(groupes: GroupeDistance[], fem: boolean): string | null {
  if (groupes.length !== 2) return null;
  const g = groupes[1];
  const d = g.distance - groupes[0].distance;
  if (g.numeros.length === 1) return `Le n°${g.numeros[0]} part avec ${d} m de recul.`;
  const liste = listeNumeros(g.numeros);
  if (liste.indexOf(",") === -1) return `Les n°${liste} partent avec ${d} m de recul.`;
  return `${g.numeros.length} ${fem ? "partantes" : "partants"} partent avec ${d} m de recul.`;
}

function ages(partants: ParticipantPmu[]): string {
  let min = Infinity;
  let max = -Infinity;
  for (const p of partants) {
    if (p.age === null) continue;
    if (p.age < min) min = p.age;
    if (p.age > max) max = p.age;
  }
  if (min === Infinity) return "";
  return min === max ? ` de ${min} ans` : ` de ${min} à ${max} ans`;
}

/** « {Discipline}, {distance} m, {N} partant(e)s{ âges} » — sans le point final. */
function tete(ctx: ContexteCourse, avecAges: boolean): string {
  const partants = partantsDe(ctx);
  const dist = distanceDeBase(ctx, groupesDistance(partants));
  const morceaux: string[] = [];
  const disc = discipline(ctx);
  if (disc) morceaux.push(disc);
  if (dist) morceaux.push(`${metres(dist)} m`);
  morceaux.push(`${partants.length} ${champFeminin(ctx) ? "partantes" : "partants"}${avecAges ? ages(partants) : ""}`);
  return morceaux.join(", ");
}

/**
 * PUR : analyse courte (aperçu), 160 caractères au plus. Si c'est trop long :
 * on retire la phrase de recul, puis le driver, puis le début ; jamais de mot
 * coupé.
 */
export function analyseCourte(ctx: ContexteCourse, pivot: ChevalCommente): string {
  const p = trouver(ctx, pivot.numero);
  const favori = feminin(p) ? "favorite" : "favori";
  const debut = `${tete(ctx, false)}.`;
  const avecDriver = `Pivot : ${pivot.nom} (n°${pivot.numero}${p && p.driver ? `, ${p.driver}` : ""}), ${favori}.`;
  const sansDriver = `Pivot : ${pivot.nom} (n°${pivot.numero}), ${favori}.`;
  const recul = phraseReculCourte(groupesDistance(partantsDe(ctx)), champFeminin(ctx));
  const essais: Array<Array<string | null>> = [
    [debut, avecDriver, recul],
    [debut, avecDriver],
    [debut, sansDriver],
    [sansDriver],
  ];
  for (const morceaux of essais) {
    const t = morceaux.filter((x): x is string => !!x).join(" ");
    if (t.length <= ANALYSE_COURTE_MAX) return t;
  }
  return `Pivot : n°${pivot.numero}, ${favori}.`;
}

function surSesDernieres(n: number): string {
  return n === 1 ? "sur sa dernière course" : `sur ses ${n} dernières courses`;
}

/** Forme et fautes, sans point final ; "" si rien à dire. */
function formeEtFautes(b: BilanMusique | null, fem: boolean): string {
  if (!b) return "";
  const n = b.courses;
  const premiers = fem ? "premières" : "premiers";
  let forme = "";
  if (b.victoires >= 1) {
    forme = b.victoires === 1 && b.derniereGagnee ? "A gagné sa dernière course" : `A gagné ${b.victoires} de ses ${n} dernières courses`;
  } else if (b.top3 >= 2) {
    forme = `Dans les 3 ${premiers} ${b.top3} fois ${surSesDernieres(n)}`;
  } else if (b.top5 >= 2) {
    forme = `Dans les 5 ${premiers} ${b.top5} fois sur ${n}`;
  }
  if (b.fautes >= 1) {
    const fautes = `${b.fautes} faute${b.fautes > 1 ? "s" : ""} ${surSesDernieres(n)}`;
    return forme ? `${forme} ; ${fautes}` : fautes;
  }
  return forme ? `${forme}, sans faute` : "";
}

function ligneCheval(ctx: ContexteCourse, c: ChevalCommente, opts: { pivot: boolean; valueElite: boolean }): string {
  const p = trouver(ctx, c.numero);
  const fem = feminin(p);
  const libelle = libelleActeur(ctx);
  const acteurs: string[] = [];
  if (p && p.driver) acteurs.push(libelle ? `${libelle} ${p.driver}` : p.driver);
  if (p && p.entraineur) acteurs.push(`entraîneur ${p.entraineur}`);
  let ligne = `${opts.pivot ? "⭐ " : ""}n°${c.numero} ${c.nom}${acteurs.length ? ` — ${acteurs.join(", ")}` : ""}.`;
  ligne += c.rang === 1 ? ` ${fem ? "Favorite" : "Favori"} du marché.` : ` ${c.rang}e du marché.`;
  const forme = formeEtFautes(analyserMusique(p ? p.musique : null), fem);
  if (forme) ligne += ` ${forme}.`;
  if (opts.pivot) ligne += " Notre pivot.";
  if (opts.valueElite) ligne += ` ${fem ? "Retenue" : "Retenu"} pour sa cote parmi nos 8.`;
  return ligne;
}

function ligneEcarte(ctx: ContexteCourse, c: ChevalCommente): string {
  const p = trouver(ctx, c.numero);
  const b = analyserMusique(p ? p.musique : null);
  const retenu = feminin(p) ? "retenue" : "retenu";
  if (!b) return `n°${c.numero} ${c.nom} (${c.rang}e du marché) n'est pas ${retenu}.`;
  return `n°${c.numero} ${c.nom} (${c.rang}e du marché) n'est pas ${retenu} : ${b.fautes} faute${b.fautes > 1 ? "s" : ""} ${surSesDernieres(b.courses)}.`;
}

function sectionCourse(ctx: ContexteCourse): string[] {
  const lignes = [
    `Quinté+ du ${dateLongue(ctx.dateISO)} : ${ctx.prix}, ${ctx.hippodrome} (R${ctx.reunion}C${ctx.course}), départ ${heureGmt(ctx.departUtc.getTime())} GMT (${heureParisLisible(ctx.heureParis)} heure de Paris).`,
    `${tete(ctx, true)}.`,
  ];
  const groupes = groupesDistance(partantsDe(ctx));
  for (let i = 1; i < groupes.length; i++) {
    const g = groupes[i];
    const d = g.distance - groupes[0].distance;
    lignes.push(
      g.numeros.length === 1
        ? `Le n°${g.numeros[0]} part ${d} m derrière, sur ${metres(g.distance)} m.`
        : `Les n°${listeNumeros(g.numeros)} partent ${d} m derrière, sur ${metres(g.distance)} m.`,
    );
  }
  return lignes;
}

/** PUR : analyse complète (texte brut, sections séparées par une ligne vide). */
export function analyseComplete(
  ctx: ContexteCourse,
  niveau: "PRO" | "ELITE",
  base: ChevalCommente[],
  values: ChevalCommente[],
  ecartes: ChevalCommente[],
): string {
  const releve = ctx.releveCotes ? `Cotes PMU relevées à ${heureGmt(ctx.releveCotes)} GMT, indicatives` : "Cotes PMU indicatives";
  const blocs: string[][] = [
    ["LA COURSE"].concat(sectionCourse(ctx)),
    ["LA BASE"].concat(base.map((c, i) => ligneCheval(ctx, c, { pivot: i === 0, valueElite: false }))),
    ["LES VALUES"]
      .concat(values.map((c) => ligneCheval(ctx, c, { pivot: false, valueElite: niveau === "ELITE" })))
      .concat(niveau === "ELITE" ? ecartes.map((c) => ligneEcarte(ctx, c)) : []),
    ["À SAVOIR", `${releve} : elles évoluent jusqu'au départ. Le jeu comporte des risques : jouez responsable.`],
  ];
  return blocs.map((b) => b.join("\n")).join("\n\n");
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte`
Expected : PASS (tous les fichiers de `lib/brouillons-quinte`).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 6 : Commit**

```powershell
git add lib/brouillons-quinte/commentaires.ts lib/brouillons-quinte/commentaires.test.ts lib/brouillons-quinte/__fixtures__/gobelins.ts
git commit -m "feat(brouillons-quinte): analyse courte et analyse complète tirées des faits PMU" -m "Modèles de phrases fixes (spec §7) : course, base avec pivot, values, écartés (Elite), à savoir. Analyse courte ≤ 160 caractères ; accords selon le sexe ; phrases omises quand une donnée manque ; discipline omise sans réponse course du PMU ; mots de promesse interdits (testé)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : E-mails à Steph

**Files :**
- Create : `lib/brouillons-quinte/email.ts`
- Create : `lib/brouillons-quinte/email.test.ts`

**Interfaces :**
- Consumes : `Confiance` (tâche 4).
- Produces :
  - `type RaisonEchec = "pmu_injoignable" | "course_pmu_non_reconnue" | "cotes_factices" | "cotes_indisponibles" | "erreur"` ;
  - `RAISONS_LISIBLES: Record<RaisonEchec, string>` ;
  - `interface ChevalResume { numero: number; nom: string }` ;
  - `interface ResumeBrouillons { jour: string; prix: string; hippodrome: string; reunion: number; course: number; heureGmt: string; releve: string|null; confiance: Confiance; pro: { base: ChevalResume[]; values: ChevalResume[] }; elite: { base: ChevalResume[]; values: ChevalResume[]; ecartes: ChevalResume[]; completeAvecFautifs: boolean } }` ;
  - `interface LiensBrouillons { pro: string | null; elite: string | null }` ;
  - `type GenreEmail = "prets" | "blanc" | "echec"` et `typeJournal(jour: string, genre: GenreEmail): string` ;
  - `emailBrouillons(r: ResumeBrouillons, liens: LiensBrouillons | null): { subject: string; html: string }` (`liens = null` : essai à blanc) ;
  - `emailRelance(e: { prix: string; heureGmt: string; liens: LiensBrouillons }): { subject: string; html: string }` ;
  - `emailEchec(e: { jour: string; prix: string; heureGmt: string; raison: RaisonEchec; detail?: string | null }): { subject: string; html: string }`.

- [ ] **Step 1 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/email.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { emailBrouillons, emailEchec, emailRelance, typeJournal, type LiensBrouillons, type ResumeBrouillons } from "./email";

const BASE = [{ numero: 17, nom: "IMAGE D'ATALANTE" }, { numero: 16, nom: "JAIN MAB" }, { numero: 5, nom: "JEUNE ORANGE COTON" }];
const R: ResumeBrouillons = {
  jour: "2026-10-07",
  prix: "Prix des Gobelins",
  hippodrome: "Enghien",
  reunion: 1,
  course: 1,
  heureGmt: "11h55",
  releve: "11h55",
  confiance: "MOYEN",
  pro: {
    base: BASE,
    values: [{ numero: 13, nom: "IDOLE ELDE" }, { numero: 10, nom: "JUSTICIA SMART" }, { numero: 15, nom: "IXELLE BLEUE" }],
  },
  elite: {
    base: BASE,
    values: [{ numero: 15, nom: "IXELLE BLEUE" }, { numero: 18, nom: "JOIE DE LA COTE" }, { numero: 11, nom: "JALOUZ D'OLIVERIE" }],
    ecartes: [],
    completeAvecFautifs: false,
  },
};
const LIENS: LiensBrouillons = {
  pro: "https://elite-turf.fr/admin/pronostics/a/modifier",
  elite: "https://elite-turf.fr/admin/pronostics/b/modifier",
};

describe("e-mails à Steph", () => {
  it("prêts : objet, sélections, confiance, liens", () => {
    const m = emailBrouillons(R, LIENS);
    expect(m.subject).toBe("Brouillons du Quinté+ prêts — Prix des Gobelins (11h55 GMT)");
    expect(m.html).toContain("n°17 IMAGE D&#39;ATALANTE (pivot)");
    expect(m.html).toContain("n°11 JALOUZ D&#39;OLIVERIE");
    expect(m.html).toContain("Moyen");
    expect(m.html).toContain(`href="${LIENS.pro}"`);
    expect(m.html).toContain(`href="${LIENS.elite}"`);
    expect(m.html).toContain("Rien n'est publié");
    expect(m.html).not.toContain("Non retenus");
  });

  it("écartés : nommés", () => {
    const m = emailBrouillons({ ...R, elite: { ...R.elite, ecartes: [{ numero: 10, nom: "JUSTICIA SMART" }] } }, LIENS);
    expect(m.html).toContain("Non retenus pour leurs fautes : n°10 JUSTICIA SMART");
  });

  it("à blanc : aucun lien, interrupteur rappelé", () => {
    const m = emailBrouillons(R, null);
    expect(m.subject).toBe("[ESSAI À BLANC] Brouillons du Quinté+ — Prix des Gobelins");
    expect(m.html).not.toContain("href=");
    expect(m.html).toContain("BROUILLONS_QUINTE_ENABLED");
  });

  it("complété avec des fautifs : signalé", () => {
    const m = emailBrouillons({ ...R, elite: { ...R.elite, completeAvecFautifs: true } }, LIENS);
    expect(m.html).toContain("complété avec des chevaux fautifs");
  });

  it("relance : liens vers les seuls brouillons qui existent", () => {
    const m = emailRelance({ prix: "Prix des Gobelins", heureGmt: "11h55", liens: { pro: LIENS.pro, elite: null } });
    expect(m.subject).toBe("Brouillons du Quinté+ prêts — Prix des Gobelins (11h55 GMT)");
    expect(m.html).toContain(`href="${LIENS.pro}"`);
    expect(m.html).not.toContain("brouillon Elite");
    expect(m.html).toContain("le premier envoi de cet e-mail a échoué");
  });

  it("échec : raison lisible et rappel de la publication à la main", () => {
    const m = emailEchec({ jour: "2026-10-07", prix: "Prix des Gobelins", heureGmt: "11h55", raison: "pmu_injoignable" });
    expect(m.subject).toBe("Brouillons du Quinté+ NON préparés — le PMU ne répond pas");
    expect(m.html).toContain("Nouveau pronostic");
  });

  it("échappe le HTML", () => {
    expect(emailBrouillons({ ...R, prix: "<b>X</b>" }, null).html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(emailEchec({ jour: "j", prix: "P", heureGmt: "11h55", raison: "erreur", detail: "<script>" }).html).toContain("&lt;script&gt;");
  });

  it("types du journal : un par genre et par jour", () => {
    expect(typeJournal("2026-10-07", "prets")).toBe("BROUILLONS_QUINTE_2026-10-07");
    expect(typeJournal("2026-10-07", "blanc")).toBe("BROUILLONS_QUINTE_BLANC_2026-10-07");
    expect(typeJournal("2026-10-07", "echec")).toBe("BROUILLONS_QUINTE_ECHEC_2026-10-07");
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/email.test.ts`
Expected : FAIL, « Failed to resolve import "./email" ».

- [ ] **Step 3 : Écrire `lib/brouillons-quinte/email.ts`**

```ts
/**
 * lib/brouillons-quinte/email.ts — e-mails à Steph seul (spec §9).
 * PUR : objet + HTML. L'envoi et le journal (une fois par genre et par jour)
 * sont faits par la route.
 */
import type { Confiance } from "./selection";

export type RaisonEchec =
  | "pmu_injoignable"
  | "course_pmu_non_reconnue"
  | "cotes_factices"
  | "cotes_indisponibles"
  | "erreur";

export const RAISONS_LISIBLES: Record<RaisonEchec, string> = {
  pmu_injoignable: "le PMU ne répond pas",
  course_pmu_non_reconnue: "la course PMU ne correspond pas à la nôtre (chevaux différents)",
  cotes_factices: "les cotes PMU semblent factices",
  cotes_indisponibles: "moins de 8 chevaux ont une cote PMU",
  erreur: "erreur technique",
};

export interface ChevalResume {
  numero: number;
  nom: string;
}

export interface ResumeBrouillons {
  jour: string;
  prix: string;
  hippodrome: string;
  reunion: number;
  course: number;
  heureGmt: string;
  releve: string | null;
  confiance: Confiance;
  pro: { base: ChevalResume[]; values: ChevalResume[] };
  elite: { base: ChevalResume[]; values: ChevalResume[]; ecartes: ChevalResume[]; completeAvecFautifs: boolean };
}

/** Liens d'édition des brouillons ; null pour un brouillon absent. */
export interface LiensBrouillons {
  pro: string | null;
  elite: string | null;
}

export type GenreEmail = "prets" | "blanc" | "echec";

/** Type `email_sent_log` : un par genre et par jour (l'essai à blanc a le sien). */
export function typeJournal(jour: string, genre: GenreEmail): string {
  if (genre === "blanc") return `BROUILLONS_QUINTE_BLANC_${jour}`;
  if (genre === "echec") return `BROUILLONS_QUINTE_ECHEC_${jour}`;
  return `BROUILLONS_QUINTE_${jour}`;
}

const LIBELLES_CONFIANCE: Record<Confiance, string> = { ELEVE: "Élevé", MOYEN: "Moyen", FAIBLE: "Faible" };

function echapper(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chevaux(liste: ChevalResume[], pivot: number | null): string {
  return liste.map((c) => `n°${c.numero} ${echapper(c.nom)}${c.numero === pivot ? " (pivot)" : ""}`).join(", ");
}

function blocSelection(titre: string, sel: { base: ChevalResume[]; values: ChevalResume[] }): string {
  const pivot = sel.base.length > 0 ? sel.base[0].numero : null;
  return `<h3 style="margin:16px 0 4px">${titre}</h3>`
    + `<p style="margin:0">★ Base : ${chevaux(sel.base, pivot)}<br>◇ Values : ${chevaux(sel.values, null)}</p>`;
}

function blocLiens(l: LiensBrouillons): string {
  const liens: string[] = [];
  if (l.pro) liens.push(`<a href="${echapper(l.pro)}">Ouvrir le brouillon Pro</a>`);
  if (l.elite) liens.push(`<a href="${echapper(l.elite)}">Ouvrir le brouillon Elite</a>`);
  return liens.length > 0 ? `<p>${liens.join(" · ")}</p>` : "";
}

/** « prêts » (avec liens) ou essai à blanc (`liens = null`). */
export function emailBrouillons(r: ResumeBrouillons, liens: LiensBrouillons | null): { subject: string; html: string } {
  const subject = liens === null
    ? `[ESSAI À BLANC] Brouillons du Quinté+ — ${r.prix}`
    : `Brouillons du Quinté+ prêts — ${r.prix} (${r.heureGmt} GMT)`;
  const morceaux = [
    `<p><strong>${echapper(r.prix)}</strong> — ${echapper(r.hippodrome)} (R${r.reunion}C${r.course}), départ ${r.heureGmt} GMT.</p>`,
    `<p>${r.releve ? `Cotes PMU relevées à ${r.releve} GMT` : "Cotes PMU"} · confiance proposée : ${LIBELLES_CONFIANCE[r.confiance]}.</p>`,
    blocSelection("Pro (6 chevaux)", r.pro),
    blocSelection("Elite (6 chevaux)", r.elite),
  ];
  if (r.elite.ecartes.length > 0) {
    morceaux.push(`<p>Non retenus pour leurs fautes : ${chevaux(r.elite.ecartes, null)}.</p>`);
  }
  if (r.elite.completeAvecFautifs) {
    morceaux.push("<p>⚠️ Moins de 3 values sans fautes : l'Elite a été complété avec des chevaux fautifs. À vérifier.</p>");
  }
  if (liens === null) {
    morceaux.push("<p>Rien n'a été créé : l'interrupteur BROUILLONS_QUINTE_ENABLED est fermé.</p>");
  } else {
    morceaux.push(blocLiens(liens));
    morceaux.push("<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>");
  }
  return { subject, html: morceaux.filter(Boolean).join("\n") };
}

/** Les brouillons existent mais l'e-mail « prêts » n'est pas parti : rappel court avec les liens. */
export function emailRelance(e: { prix: string; heureGmt: string; liens: LiensBrouillons }): { subject: string; html: string } {
  return {
    subject: `Brouillons du Quinté+ prêts — ${e.prix} (${e.heureGmt} GMT)`,
    html: [
      `<p>Les brouillons du Quinté+ (${echapper(e.prix)}, départ ${e.heureGmt} GMT) sont prêts ; le premier envoi de cet e-mail a échoué.</p>`,
      blocLiens(e.liens),
      "<p>Rien n'est publié : relisez, puis cliquez « Publier ».</p>",
    ].filter(Boolean).join("\n"),
  };
}

export function emailEchec(e: { jour: string; prix: string; heureGmt: string; raison: RaisonEchec; detail?: string | null }): { subject: string; html: string } {
  const raison = RAISONS_LISIBLES[e.raison];
  const lignes = [
    `<p>Les brouillons du Quinté+ (${echapper(e.prix)}, départ ${e.heureGmt} GMT) n'ont pas pu être préparés : ${raison}.</p>`,
  ];
  if (e.detail) lignes.push(`<p>Détail : ${echapper(e.detail)}</p>`);
  lignes.push("<p>Publiez à la main comme d'habitude (Admin → Pronostics → « Nouveau pronostic »).</p>");
  return { subject: `Brouillons du Quinté+ NON préparés — ${raison}`, html: lignes.join("\n") };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte/email.test.ts`
Expected : PASS (8 tests).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```powershell
git add lib/brouillons-quinte/email.ts lib/brouillons-quinte/email.test.ts
git commit -m "feat(brouillons-quinte): e-mails à Steph (prêts, à blanc, relance, échec)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Contrôles d'entrée et assemblage des brouillons

**Files :**
- Create : `lib/brouillons-quinte/assembler.ts`
- Create : `lib/brouillons-quinte/assembler.test.ts`

**Interfaces :**
- Consumes :
  - `memesPartants(nomsBase: string[], nomsPmu: string[]): boolean` (`lib/pmu-cotes.ts`) ;
  - `cotesPlausibles(cotes: ReadonlyArray<unknown>): boolean` (`lib/cotes/fiabilite.ts`) ;
  - `buildSelectionDetail({ selection, roles, pivot, noms }): SelectionDetailRow[] | null` (`lib/pronostics/selection-detail.ts`) ;
  - `SOURCE_BROUILLON` (tâche 3) et les tâches 1, 2, 4, 5, 6.
- Produces :
  - `controlerDonneesPmu(nomsBase: string[], participants: ParticipantPmu[] | null): RaisonEchec | null` ;
  - `interface LigneBrouillon { course_id: string; niveau_acces: "PRO"|"ELITE"; type_pari: "QUINTE_PLUS"; selection: number[]; selection_detail: SelectionDetailRow[] | null; confiance: Confiance; analyse_courte: string; analyse_texte: string; publie: false; date_publication: null; source: "AUTO-MARCHE"; auteur_id: null }` ;
  - `interface EntreeAssemblage { courseId: string; ctx: Omit<ContexteCourse, "releveCotes">; top8: NotreSelectionItem[] }` ;
  - `assemblerBrouillons(e: EntreeAssemblage): { ok: true; pro: LigneBrouillon; elite: LigneBrouillon; resume: ResumeBrouillons } | { ok: false; raison: RaisonEchec }`.

- [ ] **Step 1 : Écrire les tests (ils échouent)**

`lib/brouillons-quinte/assembler.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { controlerDonneesPmu, assemblerBrouillons } from "./assembler";
import { analyseCourte } from "./commentaires";
import { CTX, CTX_ROUTE, PARTICIPANTS, TOP8 } from "./__fixtures__/gobelins";

const NOMS_BASE = PARTICIPANTS.map((p) => p.nom);

describe("controlerDonneesPmu", () => {
  it("vraies données du 07/10 → aucune objection", () => {
    expect(controlerDonneesPmu(NOMS_BASE, PARTICIPANTS)).toBeNull();
  });

  it("PMU injoignable", () => {
    expect(controlerDonneesPmu(NOMS_BASE, null)).toBe("pmu_injoignable");
  });

  it("autres chevaux → course non reconnue (aucune sélection)", () => {
    expect(controlerDonneesPmu(["ALPHA", "BRAVO", "CHARLIE", "DELTA"], PARTICIPANTS)).toBe("course_pmu_non_reconnue");
  });

  it("toutes les cotes à 1,2 → factices", () => {
    expect(controlerDonneesPmu(NOMS_BASE, PARTICIPANTS.map((p) => ({ ...p, cote: 1.2 })))).toBe("cotes_factices");
  });

  it("moins de 8 cotes → indisponibles", () => {
    const parts = PARTICIPANTS.map((p, i) => (i < 5 ? p : { ...p, cote: null }));
    expect(controlerDonneesPmu(NOMS_BASE, parts)).toBe("cotes_indisponibles");
  });
});

describe("assemblerBrouillons — Quinté+ du 07/10/2026 au départ", () => {
  const r = assemblerBrouillons({ courseId: "course-1", ctx: CTX_ROUTE, top8: TOP8 });
  if (!r.ok) throw new Error(`assemblage refusé : ${r.raison}`);

  it("Pro : 17 ⭐, 16, 5 en base ; 13, 10, 15 en values", () => {
    expect(r.pro.selection).toEqual([17, 16, 5, 13, 10, 15]);
    expect(r.pro.selection_detail).toEqual([
      { number: 17, role: "BASE", name: "IMAGE D'ATALANTE", pivot: true },
      { number: 16, role: "BASE", name: "JAIN MAB" },
      { number: 5, role: "BASE", name: "JEUNE ORANGE COTON" },
      { number: 13, role: "OUTSIDER", name: "IDOLE ELDE" },
      { number: 10, role: "OUTSIDER", name: "JUSTICIA SMART" },
      { number: 15, role: "OUTSIDER", name: "IXELLE BLEUE" },
    ]);
  });

  it("Elite : même base ; 15, 18, 11 en values", () => {
    expect(r.elite.niveau_acces).toBe("ELITE");
    expect(r.elite.selection).toEqual([17, 16, 5, 15, 18, 11]);
    expect(r.elite.selection_detail!.filter((d) => d.role === "OUTSIDER").map((d) => d.number)).toEqual([15, 18, 11]);
  });

  it("brouillons jamais publiés, origine AUTO-MARCHE, confiance Moyen", () => {
    for (const l of [r.pro, r.elite]) {
      expect(l.publie).toBe(false);
      expect(l.date_publication).toBeNull();
      expect(l.source).toBe("AUTO-MARCHE");
      expect(l.auteur_id).toBeNull();
      expect(l.type_pari).toBe("QUINTE_PLUS");
      expect(l.course_id).toBe("course-1");
      expect(l.confiance).toBe("MOYEN");
    }
  });

  it("textes : analyse courte commune, analyse complète propre à chaque niveau, relevé calculé", () => {
    expect(r.pro.analyse_courte).toBe(analyseCourte(CTX, { numero: 17, nom: "IMAGE D'ATALANTE", rang: 1 }));
    expect(r.elite.analyse_courte).toBe(r.pro.analyse_courte);
    expect(r.pro.analyse_texte).toContain("Cotes PMU relevées à 11h55 GMT");
    expect(r.elite.analyse_texte).toContain("n°11 JALOUZ D'OLIVERIE — driver L. BAUDOUIN, entraîneur J.M. BAUDOUIN. 8e du marché.");
    expect(r.pro.analyse_texte).not.toContain("Retenue pour sa cote");
  });

  it("le n°12, non partant, n'apparaît nulle part", () => {
    for (const l of [r.pro, r.elite]) {
      expect(l.selection).not.toContain(12);
      expect(l.analyse_texte).not.toContain("JUNON");
      expect(l.analyse_courte).not.toContain("JUNON");
    }
  });

  it("résumé pour l'e-mail", () => {
    const base = [{ numero: 17, nom: "IMAGE D'ATALANTE" }, { numero: 16, nom: "JAIN MAB" }, { numero: 5, nom: "JEUNE ORANGE COTON" }];
    expect(r.resume).toEqual({
      jour: "2026-10-07",
      prix: "Prix des Gobelins",
      hippodrome: "Enghien",
      reunion: 1,
      course: 1,
      heureGmt: "11h55",
      releve: "11h55",
      confiance: "MOYEN",
      pro: {
        base,
        values: [{ numero: 13, nom: "IDOLE ELDE" }, { numero: 10, nom: "JUSTICIA SMART" }, { numero: 15, nom: "IXELLE BLEUE" }],
      },
      elite: {
        base,
        values: [{ numero: 15, nom: "IXELLE BLEUE" }, { numero: 18, nom: "JOIE DE LA COTE" }, { numero: 11, nom: "JALOUZ D'OLIVERIE" }],
        ecartes: [],
        completeAvecFautifs: false,
      },
    });
  });

  it("moins de 8 favoris → refus", () => {
    expect(assemblerBrouillons({ courseId: "x", ctx: CTX_ROUTE, top8: TOP8.slice(0, 7) })).toEqual({ ok: false, raison: "cotes_indisponibles" });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run : `npx vitest run lib/brouillons-quinte/assembler.test.ts`
Expected : FAIL, « Failed to resolve import "./assembler" ».

- [ ] **Step 3 : Écrire `lib/brouillons-quinte/assembler.ts`**

```ts
/**
 * lib/brouillons-quinte/assembler.ts — contrôles d'entrée et assemblage des
 * deux lignes `pronostics` (spec §5, §8). PUR : la route fait les I/O.
 */
import { memesPartants } from "@/lib/pmu-cotes";
import { cotesPlausibles } from "@/lib/cotes/fiabilite";
import { buildSelectionDetail, type SelectionDetailRow } from "@/lib/pronostics/selection-detail";
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";
import type { ParticipantPmu } from "./pmu";
import { SOURCE_BROUILLON } from "./fenetre";
import {
  versChevauxClasses, decouperPro, choisirValuesElite, confianceDuMarche,
  TAILLE_SELECTION, type ChevalClasse, type Confiance,
} from "./selection";
import { analyseCourte, analyseComplete, heureGmt, type ChevalCommente, type ContexteCourse } from "./commentaires";
import type { RaisonEchec, ResumeBrouillons, ChevalResume } from "./email";

/**
 * PUR : les données PMU sont-elles exploitables ? null = oui. Ordre : PMU
 * injoignable, autre course (contrôle d'identité, piège déjà vécu 4 fois),
 * cotes factices, moins de 8 cotes.
 */
export function controlerDonneesPmu(nomsBase: string[], participants: ParticipantPmu[] | null): RaisonEchec | null {
  if (participants === null) return "pmu_injoignable";
  if (!memesPartants(nomsBase, participants.map((p) => p.nom))) return "course_pmu_non_reconnue";
  const partants = participants.filter((p) => !p.nonPartant);
  if (!cotesPlausibles(partants.map((p) => p.cote))) return "cotes_factices";
  if (partants.filter((p) => p.cote !== null).length < TAILLE_SELECTION) return "cotes_indisponibles";
  return null;
}

export interface LigneBrouillon {
  course_id: string;
  niveau_acces: "PRO" | "ELITE";
  type_pari: "QUINTE_PLUS";
  selection: number[];
  selection_detail: SelectionDetailRow[] | null;
  confiance: Confiance;
  analyse_courte: string;
  analyse_texte: string;
  publie: false;
  date_publication: null;
  source: typeof SOURCE_BROUILLON;
  auteur_id: null;
}

export interface EntreeAssemblage {
  courseId: string;
  /** Contexte de la course ; l'heure du relevé des cotes est calculée ici. */
  ctx: Omit<ContexteCourse, "releveCotes">;
  /** Les 8 favoris dans l'ordre du marché (buildNotreSelection). */
  top8: NotreSelectionItem[];
}

export type ResultatAssemblage =
  | { ok: true; pro: LigneBrouillon; elite: LigneBrouillon; resume: ResumeBrouillons }
  | { ok: false; raison: RaisonEchec };

/** PUR : le plus récent horodatage de cote parmi les chevaux classés. */
function releveDesCotes(classes: ChevalClasse[], participants: ParticipantPmu[]): number | null {
  let max: number | null = null;
  for (const c of classes) {
    for (const p of participants) {
      if (p.numero === c.numero && p.coteMaj !== null && (max === null || p.coteMaj > max)) max = p.coteMaj;
    }
  }
  return max;
}

export function assemblerBrouillons(e: EntreeAssemblage): ResultatAssemblage {
  const classes = versChevauxClasses(e.top8, e.ctx.participants);
  const pro = decouperPro(classes);
  const elite = choisirValuesElite(classes);
  if (classes.length < TAILLE_SELECTION || !pro || !elite) return { ok: false, raison: "cotes_indisponibles" };

  const parNumero: Record<number, ChevalClasse> = {};
  const noms: Record<number, string> = {};
  for (const c of classes) {
    parNumero[c.numero] = c;
    noms[c.numero] = c.nom;
  }
  const commente = (n: number): ChevalCommente => ({ numero: n, nom: parNumero[n].nom, rang: parNumero[n].rang });
  const resume = (n: number): ChevalResume => ({ numero: n, nom: parNumero[n].nom });

  const releveCotes = releveDesCotes(classes, e.ctx.participants);
  const ctx: ContexteCourse = { ...e.ctx, releveCotes };
  const confiance = confianceDuMarche(parNumero[pro.pivot].cote);
  const courte = analyseCourte(ctx, commente(pro.pivot));

  const ligne = (niveau: "PRO" | "ELITE", base: number[], values: number[], texte: string): LigneBrouillon => {
    const selection = base.concat(values);
    const roles: Record<number, string> = {};
    for (const n of base) roles[n] = "BASE";
    for (const n of values) roles[n] = "OUTSIDER";
    return {
      course_id: e.courseId,
      niveau_acces: niveau,
      type_pari: "QUINTE_PLUS",
      selection,
      selection_detail: buildSelectionDetail({ selection, roles, pivot: pro.pivot, noms }),
      confiance,
      analyse_courte: courte,
      analyse_texte: texte,
      publie: false,
      date_publication: null,
      source: SOURCE_BROUILLON,
      auteur_id: null,
    };
  };

  return {
    ok: true,
    pro: ligne("PRO", pro.base, pro.values, analyseComplete(ctx, "PRO", pro.base.map(commente), pro.values.map(commente), [])),
    elite: ligne("ELITE", elite.base, elite.values, analyseComplete(ctx, "ELITE", elite.base.map(commente), elite.values.map(commente), elite.ecartes.map(commente))),
    resume: {
      jour: e.ctx.dateISO,
      prix: e.ctx.prix,
      hippodrome: e.ctx.hippodrome,
      reunion: e.ctx.reunion,
      course: e.ctx.course,
      heureGmt: heureGmt(e.ctx.departUtc.getTime()),
      releve: releveCotes === null ? null : heureGmt(releveCotes),
      confiance,
      pro: { base: pro.base.map(resume), values: pro.values.map(resume) },
      elite: {
        base: elite.base.map(resume),
        values: elite.values.map(resume),
        ecartes: elite.ecartes.map(resume),
        completeAvecFautifs: elite.completeAvecFautifs,
      },
    },
  };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

Run : `npx vitest run lib/brouillons-quinte`
Expected : PASS (tous).
Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```powershell
git add lib/brouillons-quinte/assembler.ts lib/brouillons-quinte/assembler.test.ts
git commit -m "feat(brouillons-quinte): contrôles des données PMU et assemblage des brouillons Pro et Elite" -m "Contrôles bloquants (identité de la course, cotes factices, moins de 8 cotes). Deux lignes pronostics jamais publiées (source AUTO-MARCHE), rôles BASE/OUTSIDER et pivot, confiance, textes ; résumé pour l'e-mail. Testé de bout en bout sur le Quinté+ réel du 07/10." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Migration et route cron

**Files :**
- Create : `supabase/migrations/20261007_pronostics_source_auto_marche.sql`
- Create : `app/api/cron/brouillons-quinte/route.ts`

**Interfaces :**
- Consumes :
  - `logCronStart(nom): { finish(status: "success"|"failure"|"skip", details?) }` (`lib/cron-logger.ts`) ;
  - `todayParisISO()`, `parisVersUtc()` (`lib/paris-date.ts`) ;
  - `pickQuinteDuJour()` (`lib/turf/course-vedette.ts`, lit `nationale`, `jouable_afrique`, `paris_disponibles`, `statut`, `heure_depart`) ;
  - `getCourseStatsEnrichies(partants: PartantInput[]): Promise<CourseStatsEnrichies>` (`.partants` : `PartantEnrichi[]`) ;
  - `buildNotreSelection(partants: PartantEnrichi[])` (non-partants à exclure en amont) ;
  - `sendEmail({ to, subject, html }): Promise<boolean>` (ne lève jamais) et `APP_URL` (`lib/email`) ;
  - tâches 1 à 7.
- Produces : `GET /api/cron/brouillons-quinte` (Bearer `CRON_SECRET`). Le paramètre `?apercu=1` renvoie le JSON des brouillons, sans fenêtre, sans garde-fous, sans écriture dans `pronostics` et sans e-mail. Le journal `cron_logs` garde une trace.

Base vérifiée le 07/10/2026 (lecture seule) :
- `pronostics` : seules `selection`, `type_pari`, `confiance` et `analyse_courte` sont NOT NULL sans défaut. `course_id` et `auteur_id` sont nullables (migration du 16/04).
- `niveau_acces` accepte `PRO` et `ELITE`.
- `email_sent_log` porte UNIQUE(email, type), `user_id` nullable.
- `cron_logs` horodate dans `executed_at`.

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/20261007_pronostics_source_auto_marche.sql` :

```sql
-- Brouillons automatiques du Quinté+ (spec docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md, §8).
-- Nouvelle origine AUTO-MARCHE : les brouillons préparés à T-90 se mesurent à part.
-- À appliquer À LA MAIN après le merge (MCP Supabase), puis vérifier :
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'pronostics_source_check';
ALTER TABLE public.pronostics DROP CONSTRAINT IF EXISTS pronostics_source_check;
ALTER TABLE public.pronostics ADD CONSTRAINT pronostics_source_check
  CHECK (source = ANY (ARRAY['ADMIN'::text, 'MVP'::text, 'ia-cron'::text, 'AI-MULTI-AGENT'::text, 'AUTO-MARCHE'::text]));
```

- [ ] **Step 2 : Écrire la route `app/api/cron/brouillons-quinte/route.ts`**

```ts
/**
 * GET /api/cron/brouillons-quinte
 *
 * Brouillons automatiques du Quinté+ à ~T-90 (spec
 * docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md).
 * Toutes les 5 min (elite-turf-crons, minutes 4, 9, … 59). Une fois par
 * Quinté+ : un brouillon PRO et un brouillon ELITE (source AUTO-MARCHE, jamais
 * publiés), puis un e-mail à Steph. Interrupteur BROUILLONS_QUINTE_ENABLED
 * fermé (absent) = essai à blanc : rien n'est écrit, l'e-mail le dit.
 *
 * `?apercu=1` (Bearer requis) : calcule et renvoie les brouillons en JSON, sans
 * fenêtre, sans garde-fous, sans écriture ni e-mail (seul cron_logs en garde
 * une trace). Pour vérifier.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";
import { todayParisISO, parisVersUtc } from "@/lib/paris-date";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";
import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import { buildNotreSelection } from "@/lib/courses/notre-selection";
import { sendEmail, APP_URL } from "@/lib/email";
import { chargerDonneesPmu } from "@/lib/brouillons-quinte/pmu";
import {
  minutesAvantDepart, dansFenetre, dernierPassage, gardeFous, type PronosticExistant,
} from "@/lib/brouillons-quinte/fenetre";
import { appliquerCotesPmu } from "@/lib/brouillons-quinte/selection";
import { controlerDonneesPmu, assemblerBrouillons } from "@/lib/brouillons-quinte/assembler";
import {
  emailBrouillons, emailEchec, emailRelance, typeJournal,
  type GenreEmail, type LiensBrouillons, type RaisonEchec,
} from "@/lib/brouillons-quinte/email";
import { heureGmt } from "@/lib/brouillons-quinte/commentaires";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@elite-turf.fr";

function liensVers(idPro: string | null, idElite: string | null): LiensBrouillons {
  const lien = (id: string | null) => (id ? `${APP_URL}/admin/pronostics/${id}/modifier` : null);
  return { pro: lien(idPro), elite: lien(idElite) };
}

/**
 * Envoie à Steph au plus une fois par genre et par jour (email_sent_log,
 * UNIQUE(email, type)). Seul le statut SENT bloque : un envoi raté est
 * journalisé FAILED et retenté au passage suivant.
 */
async function envoyerUneFois(
  supabase: SupabaseClient,
  jour: string,
  genre: GenreEmail,
  mail: { subject: string; html: string },
): Promise<"envoye" | "deja" | "echec_envoi"> {
  const type = typeJournal(jour, genre);
  const { data: deja } = await supabase
    .from("email_sent_log")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .eq("type", type)
    .eq("status", "SENT")
    .maybeSingle();
  if (deja) return "deja";
  const ok = await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, html: mail.html });
  await supabase.from("email_sent_log").upsert(
    { email: ADMIN_EMAIL, type, status: ok ? "SENT" : "FAILED", error: ok ? null : "envoi refusé", sent_at: new Date().toISOString() },
    { onConflict: "email,type" },
  );
  return ok ? "envoye" : "echec_envoi";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || (req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apercu = req.nextUrl.searchParams.get("apercu") === "1";
  const cronLog = logCronStart("brouillons-quinte");
  const supabase = createServiceClient();
  const jour = todayParisISO();
  let minutes: number | null = null;
  let prix = "Quinté+";
  let heure = "";

  /** Données PMU insuffisantes : nouvel essai au passage suivant ; e-mail d'échec au dernier. */
  async function donneesInsuffisantes(raison: RaisonEchec) {
    let email: string | null = null;
    if (!apercu && dernierPassage(minutes)) {
      email = await envoyerUneFois(supabase, jour, "echec", emailEchec({ jour, prix, heureGmt: heure, raison }));
    }
    await cronLog.finish("skip", { reason: "donnees_insuffisantes", raison, minutes, email, jour });
    return NextResponse.json({ ok: true, skipped: "donnees_insuffisantes", raison });
  }

  try {
    // 1. Le Quinté+ du jour (même repère que la Vedette de l'accueil) et la fenêtre
    const { data: courses, error } = await supabase
      .from("courses")
      .select("id, libelle, date_course, heure_depart, numero_reunion, numero_course, distance_metres, nationale, jouable_afrique, paris_disponibles, statut, hippodrome:hippodromes(nom)")
      .eq("date_course", jour);
    if (error) throw new Error(`courses : ${error.message}`);
    const quinte: any = pickQuinteDuJour((courses ?? []) as any[]);
    if (!quinte) {
      await cronLog.finish("skip", { reason: "pas_de_quinte", jour });
      return NextResponse.json({ ok: true, skipped: "pas_de_quinte" });
    }
    const depart = parisVersUtc(quinte.date_course, quinte.heure_depart);
    if (!depart) throw new Error(`heure de départ illisible : ${quinte.heure_depart}`);
    minutes = minutesAvantDepart(depart);
    prix = quinte.libelle || prix;
    heure = heureGmt(depart.getTime());
    if (!apercu && !dansFenetre(minutes)) {
      await cronLog.finish("skip", { reason: "hors_fenetre", minutes, jour });
      return NextResponse.json({ ok: true, skipped: "hors_fenetre", minutes });
    }

    // 2. Garde-fous : déjà publié, déjà préparé, brouillons retirés, échec déjà signalé
    if (!apercu) {
      const { data: existants, error: eErr } = await supabase
        .from("pronostics")
        .select("id, niveau_acces, publie, source")
        .eq("course_id", quinte.id);
      if (eErr) throw new Error(`pronostics existants : ${eErr.message}`);
      const { data: journal, error: jErr } = await supabase
        .from("email_sent_log")
        .select("type")
        .eq("email", ADMIN_EMAIL)
        .eq("status", "SENT")
        .in("type", [typeJournal(jour, "prets"), typeJournal(jour, "echec")]);
      if (jErr) throw new Error(`journal des e-mails : ${jErr.message}`);
      const envoyes = (journal ?? []).map((l: any) => String(l.type));
      const garde = gardeFous({
        existants: (existants ?? []) as PronosticExistant[],
        pretsEnvoye: envoyes.indexOf(typeJournal(jour, "prets")) !== -1,
        echecEnvoye: envoyes.indexOf(typeJournal(jour, "echec")) !== -1,
      });
      if (garde.action === "arreter") {
        await cronLog.finish("skip", { reason: garde.raison, minutes, jour });
        return NextResponse.json({ ok: true, skipped: garde.raison });
      }
      if (garde.action === "deja_prepare") {
        // L'e-mail « prêts » a pu échouer au passage précédent : relance (sans effet s'il est parti).
        const email = await envoyerUneFois(supabase, jour, "prets", emailRelance({ prix, heureGmt: heure, liens: liensVers(garde.idPro, garde.idElite) }));
        await cronLog.finish("skip", { reason: "deja_prepare", email, minutes, jour });
        return NextResponse.json({ ok: true, skipped: "deja_prepare", email });
      }
    }

    // 3. Données PMU et contrôles bloquants
    const { data: partantsBase, error: pErr } = await supabase
      .from("partants")
      .select("id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, non_partant")
      .eq("course_id", quinte.id);
    if (pErr) throw new Error(`partants : ${pErr.message}`);
    const base = (partantsBase ?? []) as any[];
    const pmu = await chargerDonneesPmu(quinte.date_course, quinte.numero_reunion, quinte.numero_course);
    const raison = controlerDonneesPmu(base.map((p) => p.nom_cheval), pmu.participants);
    if (raison || !pmu.participants) return await donneesInsuffisantes(raison ?? "pmu_injoignable");

    // 4. Les 8 favoris, dans l'ordre de la Sélection stats du site (non-partants exclus en amont)
    const avecCotes = appliquerCotesPmu(base, pmu.participants).filter((p: any) => !p.non_partant);
    const stats = await getCourseStatsEnrichies(avecCotes);
    const top8 = buildNotreSelection(stats.partants);

    // 5. Brouillons et textes
    const hippo = Array.isArray(quinte.hippodrome) ? quinte.hippodrome[0] : quinte.hippodrome;
    const resultat = assemblerBrouillons({
      courseId: quinte.id,
      top8,
      ctx: {
        dateISO: quinte.date_course,
        prix,
        hippodrome: hippo?.nom ?? "",
        reunion: quinte.numero_reunion,
        course: quinte.numero_course,
        heureParis: quinte.heure_depart,
        departUtc: depart,
        coursePmu: pmu.course,
        distanceBase: quinte.distance_metres ?? null,
        participants: pmu.participants,
      },
    });
    if (!resultat.ok) return await donneesInsuffisantes(resultat.raison);

    if (apercu) {
      await cronLog.finish("skip", { reason: "apercu", minutes, jour });
      return NextResponse.json({ ok: true, apercu: true, minutes, pro: resultat.pro, elite: resultat.elite, resume: resultat.resume });
    }

    // 6. Interrupteur : fermé = essai à blanc, rien n'est écrit
    if (process.env.BROUILLONS_QUINTE_ENABLED !== "true") {
      const email = await envoyerUneFois(supabase, jour, "blanc", emailBrouillons(resultat.resume, null));
      await cronLog.finish("success", { dry_run: true, email, pro: resultat.pro.selection, elite: resultat.elite.selection, minutes, jour });
      return NextResponse.json({ ok: true, dryRun: true, email });
    }

    // 7. Les deux brouillons en un seul appel : tout ou rien
    const { data: inseres, error: iErr } = await supabase
      .from("pronostics")
      .insert([resultat.pro, resultat.elite])
      .select("id, niveau_acces");
    if (iErr) throw new Error(`insertion des brouillons : ${iErr.message}`);
    const lignes = (inseres ?? []) as Array<{ id: string; niveau_acces: string }>;
    const idPro = lignes.find((l) => l.niveau_acces === "PRO")?.id ?? null;
    const idElite = lignes.find((l) => l.niveau_acces === "ELITE")?.id ?? null;
    const email = await envoyerUneFois(supabase, jour, "prets", emailBrouillons(resultat.resume, liensVers(idPro, idElite)));
    await cronLog.finish("success", { drafts_created: [idPro, idElite], email, minutes, jour });
    return NextResponse.json({ ok: true, brouillons: [idPro, idElite], email });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    let email: string | null = null;
    // Erreur non réessayée (spec §10) : e-mail immédiat, mais seulement dans la fenêtre.
    if (!apercu && dansFenetre(minutes)) {
      email = await envoyerUneFois(supabase, jour, "echec", emailEchec({ jour, prix, heureGmt: heure, raison: "erreur", detail: message }))
        .catch(() => "echec_envoi");
    }
    await cronLog.finish("failure", { error: message, email, minutes, jour });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3 : Contrôles**

Run : `npx tsc --noEmit -p .`
Expected : aucune erreur.
Run : `npx vitest run lib/brouillons-quinte`
Expected : PASS.

- [ ] **Step 4 : Vérification locale de l'aperçu**

Ajouter temporairement à `C:\Users\HP\.claude\.claude\launch.json` :

```json
{ "name": "etf-wt-brouillons-3016", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--prefix", "C:/Users/HP/etf-wt-brouillons", "--", "-p", "3016"], "port": 3016, "autoPort": false }
```

Démarrer le serveur avec `preview_start` (nom `etf-wt-brouillons-3016`), puis appeler l'aperçu. Le secret reste dans `.env.local` et n'est jamais affiché :

```powershell
$s = (Select-String -Path C:\Users\HP\etf-wt-brouillons\.env.local -Pattern '^CRON_SECRET=(.*)$').Matches[0].Groups[1].Value.Trim('"')
$r = curl.exe -s -H "Authorization: Bearer $s" "http://localhost:3016/api/cron/brouillons-quinte?apercu=1"
$j = ($r -join "") | ConvertFrom-Json
"ok=$($j.ok) apercu=$($j.apercu) skipped=$($j.skipped) minutes=$([math]::Round([double]$j.minutes))"
"PRO   : $($j.pro.selection -join ', ') · confiance $($j.pro.confiance) · publie=$($j.pro.publie) · source=$($j.pro.source)"
"ELITE : $($j.elite.selection -join ', ')"
$j.pro.analyse_courte
"longueur : $($j.pro.analyse_courte.Length)"
```

Expected :
- `ok=True apercu=True` ;
- deux sélections de 6 numéros ;
- `publie=False`, `source=AUTO-MARCHE` ;
- une analyse courte d'au plus 160 caractères.

Si la journée n'a pas de Quinté+ (c'est rare), on obtient `skipped=pas_de_quinte`. Si le PMU ne répond pas, `skipped=donnees_insuffisantes`.

Vérifier aussi la faille fermée en tâche 0 : sans session, la route de publication refuse. L'identifiant est fictif, donc aucune écriture n'est possible.

```powershell
try { Invoke-WebRequest -Method Patch -Uri "http://localhost:3016/api/admin/pronostics/00000000-0000-0000-0000-000000000000/publie" -Body '{"publie":true}' -ContentType "application/json" -UseBasicParsing | Out-Null; "statut : 2xx (FAILLE)" } catch { "statut : $($_.Exception.Response.StatusCode.value__)" }
```

Expected : `statut : 401` (« Non authentifié », renvoyé par `requireAdminAuth`).

**Ensuite seulement, si l'aperçu indique `minutes` < 55 ou > 100** (hors de la fenêtre, donc aucun e-mail et aucune écriture possibles), appeler sans aperçu :

```powershell
curl.exe -s -H "Authorization: Bearer $s" "http://localhost:3016/api/cron/brouillons-quinte"
```

Expected : `{"ok":true,"skipped":"hors_fenetre",...}`. Dans la fenêtre, ne PAS faire cet appel : il enverrait l'e-mail « à blanc » depuis le poste local.

Arrêter ensuite le serveur (`preview_stop`), puis retirer l'entrée de `launch.json`.

- [ ] **Step 5 : Commit**

```powershell
git add supabase/migrations/20261007_pronostics_source_auto_marche.sql app/api/cron/brouillons-quinte/route.ts
git commit -m "feat(brouillons-quinte): route cron T-90 et origine AUTO-MARCHE" -m "Fenêtre T-95 → T-60, garde-fous (déjà publié, déjà préparé avec relance de l'e-mail, brouillons retirés, échec déjà signalé), contrôles PMU, 8 favoris dans l'ordre de la Sélection stats, deux brouillons en un seul appel, e-mail à Steph une fois par genre et par jour. Interrupteur BROUILLONS_QUINTE_ENABLED fermé = essai à blanc. Migration à appliquer à la main après le merge." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Déclencheur, contrôles finaux et PR

**Files :**
- Modify : `cron-worker/wrangler.toml:139` (ajouter une ligne après `photo-selection`)
- Modify : `cron-worker/src/index.ts:173` (ajouter une entrée `CRON_MAP` après `photo-selection`)

**Interfaces :**
- Consumes : la route de la tâche 8.
- Produces : le déclencheur `"4,9,14,19,24,29,34,39,44,49,54,59 * * * *"` → `/api/cron/brouillons-quinte`.

- [ ] **Step 1 : Ajouter le déclencheur dans les DEUX fichiers**

Dans `cron-worker/wrangler.toml`, juste après la ligne 139 (`photo-selection`) :

```toml
  "4,9,14,19,24,29,34,39,44,49,54,59 * * * *",  # brouillons-quinte : brouillons Pro + Elite du Quinté+ à ~T-90 (spec 2026-10-07)
```

Dans `cron-worker/src/index.ts`, dans `CRON_MAP`, juste après la ligne 173 (`photo-selection`) :

```ts
  // Brouillons Pro + Elite du Quinté+ à ~T-90 (jamais publiés ; e-mail à Steph). Décalé de 2 min sur photo-selection.
  "4,9,14,19,24,29,34,39,44,49,54,59 * * * *": "/api/cron/brouillons-quinte",
```

- [ ] **Step 2 : Vérifier la synchronisation des deux fichiers**

Run : `Select-String -Path cron-worker\wrangler.toml, cron-worker\src\index.ts -Pattern '4,9,14,19,24,29,34,39,44,49,54,59'`
Expected : exactement 2 lignes, une par fichier.

- [ ] **Step 3 : Contrôles complets**

```powershell
npx tsc --noEmit -p .
npx vitest run
npm run lint
npm run build *> "$env:TEMP\build-brouillons.log"; "BUILD EXIT: $LASTEXITCODE"
```

Expected :
- `tsc` sans erreur ;
- tous les tests verts, le total augmenté des nouveaux tests ;
- lint sans erreur (l'avertissement préexistant de `admin/courses/nouvelle` est toléré) ;
- `BUILD EXIT: 0`. En cas d'échec, lire la fin du journal de build (`Get-Content "$env:TEMP\build-brouillons.log" -Tail 40`).

- [ ] **Step 4 : Commit, push et PR**

```powershell
git add cron-worker/wrangler.toml cron-worker/src/index.ts
git commit -m "feat(cron): déclencheur des brouillons du Quinté+ toutes les 5 min" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/brouillons-quinte
```

Ouvrir la PR (`gh pr create --base main`), en français. La description contient :
- le lien vers la spec et le plan ;
- l'exemple réel du 07/10 au départ : Pro 17 ⭐, 16, 5 / 13, 10, 15 ; Elite 17 ⭐, 16, 5 / 15, 18, 11 ; le n°12, non partant, exclu ;
- la tâche 0 : la faille de la route de publication (si elle n'a pas été livrée à part) et l'étanchéité des brouillons, endroit par endroit ;
- les garanties : jamais de publication automatique, interrupteur fermé, mots interdits testés ;
- les écarts assumés par rapport à la spec ;
- les étapes après merge (Step 5) ;
- la ligne de fin `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Puis appeler `mcp__ccd_pr__get_status` (et `bind_pr` si la PR n'est pas liée). **Ne pas merger** : attendre « merge la N » de Steph.

- [ ] **Step 5 : Après le merge (sur GO de Steph seulement)**

1. **Appliquer la migration** avec le MCP Supabase (`execute_sql` sur `cpzjjnmszbyizeqhgrat`, contenu du fichier de migration), puis vérifier :
   `select pg_get_constraintdef(oid) from pg_constraint where conname = 'pronostics_source_check';` doit contenir `AUTO-MARCHE`.
2. **Vérifier le déploiement du Worker** : la GitHub Action du cron-worker doit être verte. Puis lire `cron_logs` :
   `select executed_at, status, details from cron_logs where cron_name = 'brouillons-quinte' order by executed_at desc limit 5;`
   Une ligne doit apparaître toutes les 5 minutes. Aucune ligne veut dire que le code n'est pas déployé.
3. **Essai à blanc** : le jour suivant, vers T-90, Steph reçoit « [ESSAI À BLANC] Brouillons du Quinté+ ». Il le compare avec prono.elite-turf.fr.
4. **Ouverture de l'interrupteur**, sur décision de Steph : Cloudflare → Workers & Pages → `elite-turf` → Settings → Variables and Secrets, section **runtime**. Ajouter `BROUILLONS_QUINTE_ENABLED` = `true`, type **Text**.
