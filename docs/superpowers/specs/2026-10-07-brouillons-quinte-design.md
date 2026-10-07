# Spec — Brouillons automatiques du Quinté+ à T-90 (Pro + Elite, commentaires compris)

- **Date** : 2026-10-07
- **Auteur** : Stéphane (PO) + Claude
- **Statut** : design validé en conversation (parties 1 à 4, 07/10/2026) — en attente de relecture de la spec
- **Déclencheur** : Steph rédige chaque jour à la main les commentaires des pronostics Pro et Elite du Quinté+. Les pronostics publiés sont la sélection « moteur + marché » à T-90 de prono.elite-turf.fr. Steph a vérifié qu'elle est identique à la sélection du marché que le site lit en direct. Il veut des **brouillons prêts à T-90**, qu'il relit et publie.

---

## 1. Objectifs / Non-objectifs

**Objectifs**
1. À ~T-90 du Quinté+ du jour, créer **deux brouillons** (Pro et Elite) complets :
   - la sélection ;
   - les rôles Base / Value et le pivot ⭐ ;
   - l'indice de confiance ;
   - l'analyse courte et l'analyse complète.
2. Steph relit, ajuste si besoin et publie en **moins de 2 minutes**, par le circuit existant (« Modifier » puis « Publier »). La publication envoie l'e-mail aux abonnés, comme aujourd'hui.
3. Prévenir Steph **par e-mail** quand les brouillons sont prêts, ou quand la préparation a échoué.

**Non-objectifs**
- **Jamais de publication automatique.** Aucun abonné ne reçoit rien tant que Steph n'a pas cliqué « Publier ». Le drapeau `IA_AUTO_PUBLISH_ENABLED` et le pipeline `ia-pronostics-v2` ne sont pas touchés.
- Pas d'IA générative : les commentaires sont assemblés à partir de modèles de phrases fixes (§7).
- Pas d'intégration avec prono.elite-turf.fr : le site calcule lui-même (décision de Steph).
- Une seule course par jour : le Quinté+. Pas de Tiercé ni de Quarté+ séparés.
- Ni couplé ni associés : retirés de l'offre le 06/10/2026.
- La skill PRONO (`.claude/skills/prono-elite-turf`) reste l'outil d'analyse manuelle. Elle n'est pas modifiée.

---

## 2. Décisions de Steph (07/10/2026)

| Sujet | Décision |
|---|---|
| Source des 8 chevaux | **Le site les calcule** à partir des cotes PMU en direct. Steph a vérifié que c'est la même sélection que prono.elite-turf.fr. |
| Values Elite | Parmi les 4e à 8e favoris : **les 3 plus grosses cotes**, en sautant toute monture qui a **au moins 2 fautes sur ses 5 dernières courses**. |
| Commentaires | **Phrases tirées des faits**, sans IA. Aucune invention possible. |
| Indice de confiance | **Selon le marché** : favori sous 3 → Élevé ; de 3 à 6 → Moyen ; au-dessus de 6 → Faible. Modifiable avant publication. |
| Alerte | **E-mail à Steph seul** : prêts, à blanc ou échec. |
| Architecture | **A. Automatique sur le serveur** (cron), avec un interrupteur fermé au départ. |

---

## 3. Vue d'ensemble

```
cron-worker (toutes les 5 min)
  └─▶ GET /api/cron/brouillons-quinte   (Bearer CRON_SECRET)
        1. journal ouvert (cron_logs)
        2. Quinté+ du jour ? fenêtre T-95 → T-60 ? déjà publié / déjà préparé ?
        3. PMU : partants + cotes en direct + infos course  → contrôle d'identité
        4. sélection : 8 favoris → Pro (6) / Elite (6) + confiance
        5. commentaires : analyse courte + analyse complète (Pro et Elite)
        6. interrupteur ouvert → 2 brouillons en base (tout ou rien)
           interrupteur fermé  → rien en base (« essai à blanc »)
        7. e-mail à Steph (une seule fois par Quinté+)
```

Toute la logique métier (étapes 2 à 5 et le contenu de l'e-mail) vit dans des **fonctions pures testées** (`lib/brouillons-quinte/`). La route ne fait que l'orchestration et les entrées-sorties.

---

## 4. Déclenchement et garde-fous

**Cron.** Nouvelle ligne dans `cron-worker/wrangler.toml` **et** dans `CRON_MAP` de `cron-worker/src/index.ts`. Les deux doivent rester synchronisés : une expression = un chemin.

```
"4,9,14,19,24,29,34,39,44,49,54,59 * * * *"  →  "/api/cron/brouillons-quinte"
```

Ces minutes sont décalées de `photo-selection` (2, 7, …) et de l'accueil (`*/5`), pour ne pas tout appeler à la même minute. L'authentification se fait par l'en-tête `Authorization: Bearer CRON_SECRET`, comme les autres routes `/api/cron/*`.

**Étapes de la route, dans l'ordre :**
1. `logCronStart("brouillons-quinte")`, **avant** tout garde-fou. Chaque passage laisse une ligne dans `cron_logs`, avec la raison de l'arrêt (`skipped: …`).
2. Courses du jour (date de Paris, `todayParisISO()`), puis `pickQuinteDuJour()`, le même repère que la Vedette de l'accueil. Aucune course → `skipped: "pas_de_quinte"`.
3. Départ en UTC : `parisVersUtc(date_course, heure_depart)`. La base stocke l'heure de **Paris**. Puis `minutesAvantDepart`.
   - Fenêtre : **60 ≤ minutes ≤ 95**. Sinon → `skipped: "hors_fenetre"`.
4. Un pronostic **publié** de niveau PRO ou ELITE existe déjà sur ce `course_id` → `skipped: "deja_publie"`. Steph a publié à la main, pas de doublon.
5. Des brouillons `source = 'AUTO-MARCHE'` existent déjà sur ce `course_id` → `skipped: "deja_prepare"`.
6. Données PMU (§5) et sélection (§6). Si les données sont insuffisantes → `skipped: "donnees_insuffisantes"` avec la raison, et nouvel essai au passage suivant.
   - Si `minutesAvantDepart < 65`, c'est le dernier passage de la fenêtre : l'e-mail d'échec part (une fois, §9).
7. Interrupteur `BROUILLONS_QUINTE_ENABLED` :
   - comparaison stricte à la chaîne `"true"`, comme les autres drapeaux ;
   - variable runtime du Worker `elite-turf` ;
   - absent = fermé.
   - **Fermé** → aucune écriture en base. E-mail « [ESSAI À BLANC] » (une fois).
   - **Ouvert** → insertion des 2 brouillons (§8), puis e-mail « prêts » (une fois).

Le premier passage dans la fenêtre prépare les brouillons, soit entre T-95 et T-90.

---

## 5. Données

Toutes viennent du **PMU**, source officielle, déjà utilisée par le site via le relais `PMU_PROXY_URL`, puis l'accès direct, comme `fetchCotesPmu`.

**Partants** : `GET /rest/client/1/programme/{DDMMYYYY}/R{R}/C{C}/participants`.

Nouveau lecteur pur **`lireParticipantsPmu(json)`**, testé. `lireCotesPmu` reste inchangé pour ne rien casser. Champs lus par partant :

| Champ PMU | Usage |
|---|---|
| `numPmu`, `nom`, `statut` | numéro, nom, non-partant (`NON_PARTANT`) |
| `dernierRapportDirect.rapport`, `.dateRapport` | cote en direct et son horodatage |
| `driver` | driver (trot) ou jockey (galop) : le PMU range les deux dans `driver` |
| `entraineur` | entraîneur |
| `musique` | 5 dernières courses (§6.3) |
| `sexe` | accords « favori/favorite », « premiers/premières » |
| `age` | âges extrêmes du champ, cités dans « La course » |
| `handicapDistance` | distance de chaque partant (recul) |

**Course** : `GET /rest/client/1/programme/{DDMMYYYY}/R{R}/C{C}`. Nouveau lecteur pur **`lireCoursePmu(json)`** : `specialite`, `distance`, `conditionSexe`, `heureDepart` (ms UTC). PMU injoignable pour cette requête → on utilise la base (`distance_metres`, `categorie`) et on omet ce qui manque.

**Contrôles, tous bloquants :**
- **Identité de la course** : `memesPartants(nomsBase, nomsPmu)` doit être vrai. (date, R, C) ne suffit pas, c'est un piège déjà vécu 4 fois. Sinon → `donnees_insuffisantes: "course_pmu_non_reconnue"`.
- **Cotes plausibles** : `cotesPlausibles()` (`lib/cotes/fiabilite.ts`) sur les cotes PMU des partants. Sinon → `"cotes_factices"`.
- **Au moins 8 partants avec une cote** → sinon `"cotes_indisponibles"`.
- **PMU injoignable** (réponse `null`) → `"pmu_injoignable"`. Ce n'est jamais interprété comme « pas de cote ».

**Heure du relevé** : le plus récent `dateRapport` parmi les cotes utilisées. Elle est affichée dans les textes (« Cotes PMU relevées à 10h25 GMT ») et dans l'e-mail.

---

## 6. Sélection

### 6.1 Les 8 favoris

On prend les partants (hors non-partants) avec une cote PMU en direct, dans **le même ordre que la Sélection stats du site**. On réutilise `getCourseStatsEnrichies()` puis `buildNotreSelection()` : cote croissante, puis note composite, puis numéro. Les cotes PMU en direct remplacent celles de la base, par numéro, après le contrôle d'identité. On garde les 8 premiers. Le **pivot ⭐** est le rang 1 (le favori).

### 6.2 Pro et Elite

| Brouillon | Base (`BASE`) | Values (`OUTSIDER`) |
|---|---|---|
| **Pro** (6 chevaux) | rangs 1, 2, 3 (pivot = rang 1) | rangs 4, 5, 6 |
| **Elite** (6 chevaux) | rangs 1, 2, 3 (pivot = rang 1) | 3 chevaux choisis parmi les rangs 4 à 8 (règle ci-dessous) |

**Règle des values Elite** (fonction pure `choisirValuesElite`) :
1. Candidats : rangs 4 à 8.
2. Un candidat est **écarté s'il a au moins 2 fautes** sur ses 5 dernières courses (§6.3).
3. Parmi les non-écartés, on retient les **3 plus grosses cotes**. À cote égale : le moins de fautes, puis le meilleur rang.
4. S'il reste moins de 3 non-écartés, on **complète** avec les écartés : le moins de fautes d'abord, puis la plus grosse cote, puis le meilleur rang. Le drapeau `completeAvecFautifs = true` est signalé dans l'e-mail.
5. **Ordre d'enregistrement** : la base (rangs 1, 2, 3), puis les values par rang croissant.
6. Les **écartés** que la règle 3 aurait retenus sans leurs fautes sont listés, pour la phrase « n'est pas retenu(e) » (§7).

**Exemple réel (07/10/2026, Prix des Gobelins, cotes de 11h30 GMT)** — 8 favoris : 17 (4,2), 12 (6,9), 16 (9,1), 13 (10), 18 (11), 15 (12), 10 (13), 14 (13).
- Pro : base 17 ⭐, 12, 16 · values 13, 18, 15.
- Elite : base 17 ⭐, 12, 16 · values 18, 15, 14. Le 10 est écarté : 3 fautes sur ses 5 dernières courses.

### 6.3 Lecture de la musique (`analyserMusique`)

- On retire d'abord les marqueurs d'année, comme `(25)`.
- Chaque résultat est un jeton « place + discipline » : `2a`, `0a`, `Da`, `4m`, `1p`, `Ah`… Les jetons sont lus du **plus récent au plus ancien**, et seuls les **5 premiers** comptent.
- **Place** : `1` à `9` = rang d'arrivée ; `0` = au-delà du 9e (non placé).
- **Faute** : `D` (disqualifié), `A` (arrêté), `T` (tombé).
- **Toute autre lettre** : résultat « inconnu ». Il ne compte ni comme place ni comme faute.
- **Sorties** : `courses` (nombre de résultats lus, au plus 5), `victoires`, `top3`, `top5`, `fautes`.
- Musique absente ou illisible → `null`. Les phrases de forme sont alors omises (§7).

### 6.4 Indice de confiance (`confianceDuMarche`)

Il dépend de la cote du favori (rang 1) et vaut pour les deux brouillons :

| Cote du favori | Confiance |
|---|---|
| moins de 3 | `ELEVE` |
| de 3 à 6 inclus | `MOYEN` |
| plus de 6 | `FAIBLE` |

`TRES_ELEVE` n'est jamais proposé automatiquement.

---

## 7. Commentaires (modèles de phrases fixes)

**Principe.** Chaque phrase vient d'une liste fermée de modèles, remplis **uniquement** avec les données du §5. Il n'y a ni opinion ni superlatif. Un fait manquant fait **omettre** la phrase. Les noms sont recopiés **tels que le PMU les écrit** (majuscules), pour éviter toute erreur de mise en forme. Steph peut tout modifier avant de publier.

**Libellés de discipline** (`specialite`) : `TROT_ATTELE` → « Trot attelé », `TROT_MONTE` → « Trot monté », `PLAT` → « Plat », `HAIES` → « Haies », `STEEPLECHASE` → « Steeple-chase », `CROSS` → « Cross ». Valeur inconnue → la discipline est omise.

**Accords.**
- « partantes » si `conditionSexe = FEMELLES`, sinon « partants ».
- Pour un cheval, d'après son `sexe` : femelle → « favorite », « premières », « retenue », « écartée » ; mâle ou hongre → formes masculines.
- « driver » au trot, « jockey » au galop.

### 7.1 Analyse courte (160 caractères au plus)

```
{Discipline}, {distance} m, {N} partant(e)s. Pivot : {NOM} (n°{x}, {DRIVER}), favori(te). {Phrase recul}
```

- **{distance}** : la distance de base, c'est-à-dire la plus courte des `handicapDistance` (à défaut, la `distance` de la course).
- **Phrase recul** (exactement deux distances ; `d` = l'écart entre les deux) :
  - « Les n°{a} à {b} partent avec {d} m de recul. » si le groupe reculé forme une suite de numéros ;
  - sinon « {k} partant(e)s partent avec {d} m de recul. »
  - Plus de deux distances : pas de phrase recul dans l'analyse courte. L'analyse complète donne une phrase par groupe.
- **Plafond de 160 caractères** :
  - on retire d'abord la phrase recul ;
  - puis « , {DRIVER} » ;
  - le texte n'est **jamais** tronqué au milieu d'un mot. Le plafond est garanti et testé.

### 7.2 Analyse complète

Texte brut avec des retours à la ligne : la fiche l'affiche tel quel (`whitespace-pre-line`).

```
LA COURSE
Quinté+ du {jour date} : {Prix}, {Hippodrome} (R{r}C{c}), départ {HHhMM} GMT ({HHhMM} heure de Paris).
{Discipline}, {distance} m, {N} partant(e)s de {âgeMin} à {âgeMax} ans.
{si recul} Les n°{…} partent {d} m derrière, sur {distance + d} m.

LA BASE
⭐ n°{x} {NOM} — {driver|jockey} {DRIVER}, entraîneur {ENTRAINEUR}. {Rang}. {Forme}{Fautes}. Notre pivot.
n°{x} {NOM} — {driver|jockey} {DRIVER}, entraîneur {ENTRAINEUR}. {Rang}. {Forme}{Fautes}.
…

LES VALUES
n°{x} {NOM} — … {Rang}. {Forme}{Fautes}.{Elite : « Retenu(e) pour sa cote parmi nos 8. »}
…
{Elite, si écartés} n°{x} {NOM} ({rang}e du marché) n'est pas retenu(e) : {f} fautes sur ses 5 dernières courses.

À SAVOIR
Cotes PMU relevées à {HHhMM} GMT, indicatives : elles évoluent jusqu'au départ. Le jeu comporte des risques : jouez responsable.
```

**Phrases d'un cheval :**

| Élément | Règle |
|---|---|
| **Âges** (« La course ») | « de {âgeMin} à {âgeMax} ans » ; si tous ont le même âge : « de {âge} ans » ; âges absents : omis |
| **Rang** | rang 1 → « Favori(te) du marché » ; sinon « {r}e du marché » |
| **Forme**, la première qui s'applique | `victoires ≥ 1` → « A gagné {v} de ses {n} dernières courses » (si `v = 1` et que c'est la plus récente : « A gagné sa dernière course ») ; `top3 ≥ 2` → « Dans les 3 premier(e)s {k} fois sur ses {n} dernières courses » ; `top5 ≥ 2` → « Dans les 5 premier(e)s {k} fois sur {n} » ; sinon rien |
| **Fautes** | `fautes ≥ 1` → « {f} faute(s) sur ses {n} dernières courses » (après la forme : « ; ») ; `fautes = 0` et une forme affichée → « , sans faute » |
| `{n}` | nombre de résultats réellement lus (au plus 5) |

**Mots interdits** (vérifiés par les tests, sans tenir compte de la casse) : « garanti », « assuré », « sûr », « certain », « immanquable », « coup sûr », « 100 % », « jackpot », « gagnant à coup ».

---

## 8. Brouillons en base

**Migration** `supabase/migrations/20261007_pronostics_source_auto_marche.sql`. Elle remplace la contrainte `pronostics_source_check` pour y ajouter `'AUTO-MARCHE'`. Valeurs actuelles : `ADMIN`, `MVP`, `ia-cron`, `AI-MULTI-AGENT`. Elle est **appliquée à la main** après le merge (MCP Supabase), puis vérifiée, comme le veut CLAUDE.md.

**Insertion** : **un seul appel** `insert([...2 lignes])`, donc tout ou rien. Colonnes :

| Colonne | Pro | Elite |
|---|---|---|
| `course_id` | le Quinté+ | idem |
| `niveau_acces` | `PRO` | `ELITE` |
| `type_pari` | `QUINTE_PLUS` | idem |
| `selection` | 6 numéros (§6.2) | 6 numéros (§6.2) |
| `selection_detail` | `buildSelectionDetail` : `BASE` × 3, `OUTSIDER` × 3, `pivot` = rang 1, `noms` | idem |
| `confiance` | §6.4 | idem |
| `analyse_courte` / `analyse_texte` | §7, version Pro | §7, version Elite |
| `publie` / `date_publication` | `false` / `null` | idem |
| `source` | `AUTO-MARCHE` | idem |
| `auteur_id` | `null` | idem |

**Publication** : circuit existant. Admin → Pronostics (badge « Brouillon »), puis « Modifier », puis « Publier ». La première publication déclenche `/api/admin/pronostics/notifier` (e-mail aux abonnés du niveau).

Vérifié le 07/10/2026 : l'enregistrement depuis « Modifier » (`PATCH /api/admin/pronostics/{id}`) n'envoie pas `source`. Un brouillon publié garde donc `AUTO-MARCHE`, et la mesure de ses résultats reste séparée.

---

## 9. E-mail à Steph

- **Destinataire** : `ADMIN_EMAIL`, la même variable que le rapport du soir (`/api/admin/rapport-journalier/envoyer`). Envoi via `sendEmail` (`lib/email`).
- **Une seule fois par Quinté+ et par type** :
  - avant l'envoi, on cherche une ligne `email_sent_log` (email = `ADMIN_EMAIL`, type) ;
  - après l'envoi, on l'écrit, avec un upsert sur `email,type`, car `user_id` est vide ici.
  - Types : `BROUILLONS_QUINTE_{AAAA-MM-JJ}` (prêts ou à blanc) et `BROUILLONS_QUINTE_ECHEC_{AAAA-MM-JJ}`.

| Cas | Objet | Contenu |
|---|---|---|
| Prêts | « Brouillons du Quinté+ prêts — {Prix} ({HHhMM} GMT) » | course, heure du relevé des cotes, Pro et Elite (base et values avec numéros et noms), confiance, écartés, `completeAvecFautifs`, un lien vers chaque brouillon (`{APP_URL}/admin/pronostics/{id}/modifier`) |
| À blanc | « [ESSAI À BLANC] Brouillons du Quinté+ — {Prix} » | le même contenu + « rien n'a été créé ; l'interrupteur BROUILLONS_QUINTE_ENABLED est fermé », sans liens |
| Échec | « Brouillons du Quinté+ NON préparés — {raison lisible} » | la raison (§5), l'heure, et le rappel « publiez à la main comme d'habitude » |

---

## 10. Erreurs et journal

- **Erreurs à réessayer** (PMU injoignable, cotes absentes ou factices, course non reconnue) : nouvel essai au passage suivant. Au dernier passage de la fenêtre (`minutes < 65`), l'e-mail d'échec part une fois.
- **Erreurs à ne pas réessayer** (insertion refusée par la base, exception inattendue) : journal en erreur, puis e-mail d'échec **immédiat** (une fois).
- **Rien n'est jamais écrit à moitié** (§8).
- **Chaque passage** se termine par une ligne `cron_logs` avec l'issue : `skipped` et sa raison, `dry_run`, `drafts_created` et les 2 identifiants, ou `error`.

---

## 11. Découpage en modules

| Fichier | Rôle | Pur ? |
|---|---|---|
| `lib/brouillons-quinte/pmu.ts` | `lireParticipantsPmu`, `lireCoursePmu` + accès réseau (relais puis direct) | lecteurs purs |
| `lib/brouillons-quinte/musique.ts` | `analyserMusique` | oui |
| `lib/brouillons-quinte/fenetre.ts` | `minutesAvantDepart`, `dansFenetre`, `dernierPassage` | oui |
| `lib/brouillons-quinte/selection.ts` | `decouperPro`, `choisirValuesElite`, `confianceDuMarche` | oui |
| `lib/brouillons-quinte/commentaires.ts` | `analyseCourte`, `analyseComplete` (Pro et Elite) | oui |
| `lib/brouillons-quinte/email.ts` | objets et corps des 3 e-mails | oui |
| `app/api/cron/brouillons-quinte/route.ts` | orchestration (§4), base, e-mail, journal | non |
| `cron-worker/wrangler.toml` + `cron-worker/src/index.ts` | déclencheur | — |
| `supabase/migrations/20261007_pronostics_source_auto_marche.sql` | contrainte `source` | — |

Chaque module a son fichier `*.test.ts` à côté (Vitest ne lit que `lib/**/*.test.ts`).

---

## 12. Tests

- **Données réelles du 07/10/2026** (Prix des Gobelins, Enghien R1C1) enregistrées en fixture JSON (réponses PMU `participants` et course) sous `lib/brouillons-quinte/__fixtures__/`. Elles servent de cas d'essai de bout en bout pour la sélection et les commentaires.
- **`analyserMusique`** :
  - jetons trot, galop et obstacle ;
  - marqueurs d'année ;
  - `0`, `D`, `A`, `T` ;
  - lettres inconnues ;
  - moins de 5 résultats ;
  - musique vide.
- **Fenêtre** : bornes 60 et 95 ; dernier passage sous 65 ; passage heure d'été / heure d'hiver via `parisVersUtc`.
- **Sélection** :
  - Pro = rangs 1 à 6 ;
  - Elite = exemple du §6.2 (le 10 écarté) ;
  - égalités de cote ;
  - complément avec des fautifs ;
  - moins de 8 cotes → refus ;
  - confiance à 2,9 / 3 / 6 / 6,1.
- **Commentaires** :
  - analyse courte ≤ 160 caractères dans tous les cas (y compris les noms les plus longs de la fixture) ;
  - aucun numéro ni nom absent des données ;
  - aucun mot interdit ;
  - accords selon le sexe ;
  - phrases omises quand la musique manque ;
  - phrase recul seulement s'il y a plusieurs distances.
- **E-mails** : contenu des 3 cas ; aucun lien en mode à blanc.
- **Contrôles d'entrée** : course non reconnue (`memesPartants` faux) → aucune sélection.

Les contrôles habituels restent obligatoires : `tsc`, `vitest`, `lint`, `build`.

---

## 13. Mise en service

1. **PR**, puis merge sur « merge la N » de Steph. Le cron-worker se redéploie seul quand `cron-worker/**` change sur `main`.
2. **Migration** `AUTO-MARCHE` appliquée à la main, puis vérifiée par une requête sur `pg_constraint`.
3. **Interrupteur fermé** (par défaut) pendant 1 ou 2 jours : Steph reçoit les e-mails « à blanc » et les compare avec prono.elite-turf.fr.
4. Quand Steph est satisfait, il pose `BROUILLONS_QUINTE_ENABLED = true` (type `Text`) dans Cloudflare → Worker `elite-turf` → Settings → variables **runtime**, guidé pas à pas. Les vrais brouillons arrivent dès le Quinté+ suivant.
5. **Vérification** : une ligne `cron_logs` « brouillons-quinte » par passage. Si aucune ligne n'apparaît, le code n'est pas déployé.

---

## 14. Limites connues

- **Les cotes de T-90 bougent** jusqu'au départ. La sélection peut différer de celle de T-30. Steph peut ajuster avant de publier, et les textes donnent l'heure du relevé.
- **L'égalité avec prono.elite-turf.fr** n'est garantie qu'à cotes identiques au même instant.
- **Si le PMU change son API**, les lecteurs, testés, échouent proprement : l'e-mail d'échec part et Steph publie à la main.
- **Quinté+ annulé** : `pickQuinteDuJour` l'ignore déjà (statut `ANNULE`).
- **Le PMU est la seule source.** La mention LONACI n'apparaît pas dans les textes automatiques. Le Quinté+ est jouable LONACI via `jouable_afrique`, déjà affiché par le site.
