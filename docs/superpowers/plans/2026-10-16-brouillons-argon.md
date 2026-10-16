# Brouillons du Quinté+ préparés par Argon — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** à T-90 du Quinté+, le robot existant lit l'édition T-90 scellée d'Argon et prépare deux brouillons non publiés : PRO (4 bases + 2 values) et ELITE (4 bases + values + associés). Il prévient ensuite Steph par e-mail.

**Architecture :** on garde la route `app/api/cron/brouillons-quinte` et sa mécanique (fenêtre, garde-fous, interrupteur, journal). Seule la source de la sélection change : trois modules purs nouveaux (lecture d'Argon, composition) remplacent la sélection « marché ». Les modules existants (textes, e-mails, assemblage) sont adaptés à la nouvelle structure. La lecture réseau d'Argon est isolée dans une fonction, avec le jeton Cloudflare Access en option.

**Tech Stack :** Next.js 14 (App Router) sur Cloudflare Workers, TypeScript strict sans `target` (pas de spread de Map/Set, pas de regex `/u`), Supabase (client service), Vitest (`lib/**/*.test.ts` seulement), Resend.

**Spec :** `docs/superpowers/specs/2026-10-16-brouillons-argon-design.md`

## Global Constraints

- Rien n'est jamais publié automatiquement : `publie = false`, `date_publication = null`, `auteur_id = null`.
- Interrupteur `BROUILLONS_QUINTE_ENABLED` : strictement `"true"` pour écrire ; sinon essai à blanc.
- Fenêtre inchangée : `FENETRE_MIN = 60`, `FENETRE_MAX = 95`, `DERNIER_PASSAGE_SOUS = 65`.
- `source = 'ARGON'` pour les nouveaux brouillons ; les filtres d'étanchéité excluent `AUTO-MARCHE` **et** `ARGON`.
- Pas de repli sur la sélection « marché » : soit un brouillon Argon, soit aucun brouillon.
- Couplé jamais posé dans un brouillon (`couple: true` absent).
- Textes abonnés : faits PMU uniquement, jamais un pourcentage, une probabilité, un avantage ou une étoile d'Argon ; `MOTS_INTERDITS` inchangés.
- Confiance : 5 ou 4 étoiles = `ELEVE`, 3 = `MOYEN`, 1 ou 2 = `FAIBLE`.
- Lecture d'Argon : `ARGON_API_URL` (défaut `https://argon.elite-turf.fr/api/races`), en-têtes `CF-Access-Client-Id` et `CF-Access-Client-Secret` si `ARGON_ACCESS_CLIENT_ID` et `ARGON_ACCESS_CLIENT_SECRET` sont définis ; délai de 15 s.
- Ne jamais afficher ni committer les secrets (`CRON_SECRET`, `ARGON_ACCESS_*`, clés Supabase).
- Migration appliquée **à la main** après fusion, puis vérifiée ; pas de migration automatique.
- Contrôles avant chaque commit de code : `npx vitest run` sur les fichiers touchés ; avant la PR : `npx tsc --noEmit`, `npm run build`, `npx vitest run`.

## Review Focus

1. **Argon fermé par Cloudflare Access sans jeton valide** : la réponse est une page HTML de connexion (200), pas du JSON. `chargerArgon` doit renvoyer `null` (Argon injoignable), jamais planter ni lire du HTML. → test en tâche 7.
2. **Historique d'Argon** : `/api/races` contient aussi les jours passés, avec les mêmes numéros de réunion et de course (R1C4 du 15/10…). Seule la course du jour doit correspondre. → test en tâche 1.
3. **Noms d'hippodrome écrits autrement** (« MARSEILLE-BORELY » chez Argon, « Marseille-Borely » en base) : la course doit être reconnue. Un autre hippodrome, même date et même R/C, ne doit pas l'être. → test en tâche 1.
4. **Données d'Argon incohérentes** : un numéro de `argon8` absent de `runners`, un doublon dans `argon8`, ou `edge_pts` en texte (`"0.3"`). Le résultat doit être un échec net, jamais un brouillon. → tests en tâche 1.
5. **Cheval d'Argon sans cote PMU** au moment de la lecture : son rang au marché est inconnu, et le texte ne doit pas inventer « Xe du marché ». → test en tâche 5 (`cotes_indisponibles`).

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `lib/brouillons-quinte/argon.ts` *(nouveau)* | lecture stricte d'Argon, identification de la course, contrôle des chevaux, `chargerArgon` (réseau) |
| `lib/brouillons-quinte/composition-argon.ts` *(nouveau)* | composition PRO / ELITE, confiance selon les étoiles |
| `lib/brouillons-quinte/__fixtures__/argon-races-20261016.json` *(nouveau)* | vraie réponse d'Argon réduite à 2 courses du 16/10 (R1C4 Quinté+ et R1C1) |
| `lib/brouillons-quinte/__fixtures__/pmu-participants-20261016-R1C4.json`, `pmu-course-20261016-R1C4.json` *(nouveaux)* | vraies réponses PMU du Prix Thémis |
| `lib/brouillons-quinte/__fixtures__/themis.ts` *(nouveau)* | fixtures lues et prêtes à l'emploi |
| `lib/brouillons-quinte/commentaires.ts` | `analyseComplete` : 4 bases, values, associés |
| `lib/brouillons-quinte/email.ts` | nouveaux codes d'échec, résumé avec associés et avis d'Argon |
| `lib/brouillons-quinte/assembler.ts` | assemblage à partir d'Argon (remplace `top8`) |
| `lib/brouillons-quinte/selection.ts` | n'en restent que `Confiance` et `TAILLE_SELECTION` (le reste est supprimé) |
| `lib/brouillons-quinte/fenetre.ts` | `SOURCE_BROUILLON = "ARGON"`, `FILTRE_HORS_BROUILLONS` |
| `app/api/cron/brouillons-quinte/route.ts` | lecture d'Argon à la place de la sélection « marché » |
| `app/api/cron/ia-auto-publish/route.ts`, `app/api/admin/ai-review/[id]/publish/route.ts`, `app/api/admin/pronostics/bulk/route.ts` | filtre d'étanchéité commun |
| `supabase/migrations/20261016_pronostics_source_argon.sql` *(nouveau)* | ajoute `ARGON` à `pronostics_source_check` |

---

### Tâche 1 : lecture stricte d'Argon et identification de la course

**Files :**
- Create : `lib/brouillons-quinte/argon.ts`, `lib/brouillons-quinte/argon.test.ts`, les 3 fixtures JSON et `lib/brouillons-quinte/__fixtures__/themis.ts`

**Interfaces :**
- Produces :
  ```ts
  export interface CoureurArgon { numero: number; nom: string; avantage: number | null }
  export interface CourseArgon {
    date: string; reunion: number; course: number; hippodrome: string;
    t90: { argon8: number[]; sealed: boolean; lockGmt: string | null };
    coureurs: CoureurArgon[]; etoiles: number; deconseillee: boolean;
    decision: string | null; sniper: { numero: number; cote: number | null } | null;
  }
  export type RaisonArgon = "argon_injoignable" | "argon_format_inattendu" | "argon_course_introuvable"
    | "argon_non_scelle" | "argon_partants_incoherents" | "argon_partants_insuffisants";
  export function trouverCourseArgon(json: unknown, cible: { dateISO: string; reunion: number; course: number; hippodrome: string }):
    { ok: true; course: CourseArgon } | { ok: false; raison: "argon_format_inattendu" | "argon_course_introuvable" };
  export function controlerChevauxArgon(course: CourseArgon, participants: ParticipantPmu[]): "argon_partants_incoherents" | null;
  ```
  `themis.ts` exporte `ARGON_JSON` (JSON brut), `PARTICIPANTS_THEMIS` (`lireParticipantsPmu`), `COURSE_PMU_THEMIS` (`lireCoursePmu`), `CIBLE_THEMIS = { dateISO: "2026-10-16", reunion: 1, course: 4, hippodrome: "Vincennes" }` et `CTX_THEMIS: Omit<ContexteCourse, "releveCotes">` (prix « Prix Thémis », hippodrome « Vincennes », R1 C4, heureParis `"20:15:00"`, departUtc `2026-10-16T18:15:00Z`, `coursePmu: COURSE_PMU_THEMIS`, `distanceBase: 2850`, `participants: PARTICIPANTS_THEMIS`).

**Règles** (spec §5 et §7) :
- Racine : `status === "ok"` et `races` est un tableau, sinon `argon_format_inattendu`.
- Candidats : `date === dateISO && reunion === R && course_num === C`. On les lit en accès souple, puis on filtre par hippodrome avec `memeNom(nomCheval(hippoArgon), nomCheval(hippoBase))`.
- Aucun candidat : `argon_course_introuvable`. Plus d'un : `argon_format_inattendu`.
- Lecture stricte de la course retenue :
  - `editions_schedule.T90.argon8` : 8 entiers distincts > 0 ;
  - `T90.sealed` : booléen ;
  - `runners[].num` : entier ; `runners[].name` : texte non vide ; `edge_pts` : nombre fini, `null` ou absent ;
  - `confidence_stars` : entier de 1 à 5 ; `is_no_bet` : booléen ;
  - `decision` : texte ou absent ; `sniper_num` et `sniper_odds` : nombres ou absents.
  - Tout autre cas : `argon_format_inattendu`.
- Contrôle des chevaux : chaque numéro de `t90.argon8` doit avoir un coureur Argon **et** un participant PMU au même numéro (quel que soit son statut), et `memeNom(nomCheval(nomArgon), nomCheval(nomPmu))`. Sinon `argon_partants_incoherents`.

- [ ] **Étape 1 : copier les fixtures**

Copier les 3 fichiers de `C:\Users\HP\AppData\Local\Temp\claude\C--Users-HP-elite-turf\29d5d521-d4a1-47f6-8e5e-d925546ab534\scratchpad\fixtures-argon\` (vraies réponses du 16/10, capturées par `capture-argon.ts` dans le même dossier) vers `lib/brouillons-quinte/__fixtures__/`. Écrire `themis.ts` comme `gobelins.ts`.

- [ ] **Étape 2 : écrire les tests qui échouent** (`argon.test.ts`)

```ts
describe("trouverCourseArgon — vraie réponse d'Argon du 16/10/2026", () => {
  it("trouve le Prix Thémis : T-90 scellée à 16:45, 8 chevaux, 5 étoiles, course jouable", () => {
    const r = trouverCourseArgon(ARGON_JSON, CIBLE_THEMIS);
    if (!r.ok) throw new Error(r.raison);
    expect(r.course.t90).toEqual({ argon8: [3, 6, 12, 13, 7, 4, 11, 14], sealed: true, lockGmt: "16:45" });
    expect(r.course.etoiles).toBe(5);
    expect(r.course.deconseillee).toBe(false);
    expect(r.course.sniper).toEqual({ numero: 12, cote: 11 });
    expect(r.course.coureurs.find((c) => c.numero === 11)).toEqual({ numero: 11, nom: "READLY LAVEC", avantage: 0.3 });
  });
  it("hippodrome écrit autrement (« VINCENNES » / « Vincennes ») : reconnu", …);
  it("même date et même R/C mais un autre hippodrome : introuvable", () => {
    expect(trouverCourseArgon(ARGON_JSON, { ...CIBLE_THEMIS, hippodrome: "Enghien" })).toEqual({ ok: false, raison: "argon_course_introuvable" });
  });
  it("même R/C un autre jour (historique) : introuvable", () => {
    expect(trouverCourseArgon(ARGON_JSON, { ...CIBLE_THEMIS, dateISO: "2026-10-15" })).toEqual({ ok: false, raison: "argon_course_introuvable" });
  });
  it("deux courses candidates : format inattendu", …);           // la course R1C4 dupliquée dans races
  it("status différent de ok, races absent : format inattendu", …);
  it("argon8 de 7 chevaux, avec un doublon, ou un numéro non entier : format inattendu", …);
  it("sealed absent, étoiles 0, 6 ou \"5\", is_no_bet absent : format inattendu", …);
  it("edge_pts en texte (\"0.3\") : format inattendu ; edge_pts absent ou null : avantage null", …);
});

describe("controlerChevauxArgon", () => {
  it("vraies données : les 8 chevaux d'Argon sont les partants du PMU", () => {
    expect(controlerChevauxArgon(courseThemis, PARTICIPANTS_THEMIS)).toBeNull();
  });
  it("un nom différent pour un même numéro : incohérent", …);    // coureur 7 renommé « AUTRE CHEVAL »
  it("numéro de argon8 absent des coureurs Argon : incohérent", …);
  it("numéro de argon8 absent du PMU : incohérent", …);
});
```
Les variantes se fabriquent par copie profonde de `ARGON_JSON` (`JSON.parse(JSON.stringify(…))`), puis modification d'un seul champ.

- [ ] **Étape 3 : lancer les tests**, qui doivent échouer : `npx vitest run lib/brouillons-quinte/argon.test.ts` → « Cannot find module './argon' ».
- [ ] **Étape 4 : écrire `argon.ts`** (fonctions pures, signatures ci-dessus ; `memeNom` et `nomCheval` viennent de `@/lib/pmu-cotes`).
- [ ] **Étape 5 : relancer les tests**, qui doivent passer.
- [ ] **Étape 6 : committer** — `feat(brouillons-argon): lecture stricte d'Argon et identification de la course`.

### Tâche 2 : composition PRO / ELITE et confiance

**Files :** Create `lib/brouillons-quinte/composition-argon.ts`, `lib/brouillons-quinte/composition-argon.test.ts`

**Interfaces :**
- Consumes : `Confiance` (`./selection`).
- Produces :
  ```ts
  export interface CompositionArgon {
    pivot: number; bases: number[]; valuesPro: number[];
    valuesElite: number[]; associes: number[];
    /** Numéros de argon8 non partants selon le PMU, dans l'ordre d'Argon. */
    nonPartants: number[];
  }
  export function composerArgon(argon8: number[], partants: number[], avantage: Record<number, number | null>):
    { ok: true; composition: CompositionArgon } | { ok: false; raison: "argon_partants_insuffisants" };
  export function confianceArgon(etoiles: number): Confiance;
  ```
  `partants` = les numéros partants selon le PMU, dans n'importe quel ordre.

**Règles** (spec §8) :
- `P` = `argon8` filtré sur `partants`, dans l'ordre d'Argon. Moins de 6 : `argon_partants_insuffisants`.
- Bases = `P[0..3]`, pivot `P[0]`. Values Pro = `P[4]`, `P[5]`. `R` = `P[4..]`.
- `nbValues` = 3 si au moins 3 chevaux de `R` ont `avantage > 0`, sinon 2 ; borné par la longueur de `R`.
- Values Elite = les `nbValues` meilleurs avantages (`null` compte comme `-Infinity`), égalités départagées par l'ordre d'Argon, puis **remises dans l'ordre d'Argon**. Associés = le reste de `R`, dans l'ordre d'Argon.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
const ARGON8 = [3, 6, 12, 13, 7, 4, 11, 14];
const TOUS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
// Avantages relevés le 16/10/2026 (après la course).
const AV = { 3: 6.5, 6: -0.1, 12: -0.7, 13: -0.4, 7: -1.3, 4: -1.4, 11: 0.3, 14: -0.3 };

it("exemple réel du Prix Thémis : Pro 3-6-12-13 + 7-4 ; Elite values 11-14, associés 7-4", () => {
  expect(composerArgon(ARGON8, TOUS, AV)).toEqual({ ok: true, composition: {
    pivot: 3, bases: [3, 6, 12, 13], valuesPro: [7, 4], valuesElite: [11, 14], associes: [7, 4], nonPartants: [],
  } });
});
it("3 avantages positifs ou plus : 3 values, 1 associé (values dans l'ordre d'Argon)", () => {
  const r = composerArgon(ARGON8, TOUS, { ...AV, 7: 0.5, 4: 2, 11: 1 });
  expect(r.ok && [r.composition.valuesElite, r.composition.associes]).toEqual([[7, 4, 11], [14]]);
});
it("égalité d'avantage : l'ordre d'Argon départage", …);       // 7 et 4 à 1 → 7 avant 4
it("avantage absent (null) : traité comme le plus faible", …);
it("un non-partant parmi les bases (n°6) : les suivants remontent, Elite à 7 chevaux", () => {
  const r = composerArgon(ARGON8, TOUS.filter((n) => n !== 6), AV);
  expect(r.ok && r.composition).toEqual({ pivot: 3, bases: [3, 12, 13, 7], valuesPro: [4, 11],
    valuesElite: [11, 14], associes: [4], nonPartants: [6] });
});
it("deux non-partants : Elite à 6 chevaux, 2 values, aucun associé", …);
it("trois non-partants : moins de 6 partants → argon_partants_insuffisants", …);
it("confianceArgon : 5 et 4 → ELEVE, 3 → MOYEN, 2 et 1 → FAIBLE", …);
```

- [ ] **Étape 2 : vérifier l'échec** → `npx vitest run lib/brouillons-quinte/composition-argon.test.ts`.
- [ ] **Étape 3 : écrire `composition-argon.ts`.**
- [ ] **Étape 4 : vérifier que les tests passent.**
- [ ] **Étape 5 : committer** — `feat(brouillons-argon): composition Pro (4 bases + 2 values) et Elite (values et associés)`.

### Tâche 3 : textes à 4 bases, values et associés

**Files :** Modify `lib/brouillons-quinte/commentaires.ts` (`analyseComplete`, `ligneCheval` ; suppression de `ligneEcarte`), `lib/brouillons-quinte/commentaires.test.ts`

**Interfaces :**
- Produces : `analyseComplete(ctx: ContexteCourse, niveau: "PRO" | "ELITE", bases: ChevalCommente[], values: ChevalCommente[], associes: ChevalCommente[]): string`. Le 5e paramètre remplace `ecartes`. `analyseCourte` ne change pas.

**Règles** (spec §9) :
- Chaque ligne de value se termine par « Retenu en value. » (« Retenue en value. » pour une femelle), au Pro comme à l'Elite. La phrase « Retenu(e) pour sa cote parmi nos 8. » disparaît.
- Nouvelle section `LES ASSOCIÉS` entre `LES VALUES` et `À SAVOIR`, seulement si `associes` n'est pas vide. Chaque ligne suit le format des autres et se termine par « Associé à la base. » (« Associée à la base. »).
- `À SAVOIR` est inchangée.

- [ ] **Étape 1 : adapter les tests existants** (signature `associes` au lieu de `ecartes` ; suppression des tests « écarté pour ses fautes » et « pour sa cote »), puis **ajouter**, sur `CTX_THEMIS` et ses vrais participants :

```ts
it("analyse courte du Prix Thémis (vraies données)", () => {
  expect(analyseCourte(CTX, { numero: 3, nom: "EMINENT KRONOS", rang: 1 }))
    .toBe("Trot attelé, 2 850 m, 15 partants. Pivot : EMINENT KRONOS (n°3, F. NIVARD), favori. Les n°11 à 15 partent avec 25 m de recul.");
});
it("ELITE : 4 lignes dans LA BASE, values « Retenu en value », section LES ASSOCIÉS", () => {
  const t = analyseComplete(CTX, "ELITE", bases, [c(11), c(14)], [c(7), c(4)]);
  const sections = t.split("\n\n");
  expect(sections.map((s) => s.split("\n")[0])).toEqual(["LA COURSE", "LA BASE", "LES VALUES", "LES ASSOCIÉS", "À SAVOIR"]);
  expect(sections[1].split("\n")).toHaveLength(5);                 // titre + 4 bases
  expect(sections[2]).toContain("n°11 READLY LAVEC — driver B. ROCHARD, entraîneur O.J. ANDERSSON. 6e du marché.");
  expect(sections[2]).toContain("Retenu en value.");
  expect(sections[3]).toContain("n°7 KEROSEN DU GERS");
  expect(sections[3]).toContain("Associé à la base.");
});
it("PRO : pas de section LES ASSOCIÉS", …);
it("femelle (n°12 JALENDRA DE MALAC) : « Retenue en value. »", …);
it("aucun chiffre d'Argon ni mot interdit dans les textes", () => {
  for (const t of [proTexte, eliteTexte]) {
    expect(t).not.toMatch(/%|avantage|étoile|probabilit/i);
    for (const m of MOTS_INTERDITS) expect(t.toLowerCase()).not.toContain(m);
  }
});
```
Avec `c(n)` = `{ numero: n, nom, rang }`, où le rang au marché vient des cotes PMU de la fixture : 3→1, 6→2, 4→3, 7→4, 12→5, 11→6, 13→7, 14→10. Les cotes 4, 7 et 12 sont à égalité à 11 et sont départagées par le numéro.

- [ ] **Étape 2 : vérifier l'échec**, puis **modifier `commentaires.ts`**, puis **vérifier que les tests passent** (`npx vitest run lib/brouillons-quinte/commentaires.test.ts`).
- [ ] **Étape 3 : committer** — `feat(brouillons-argon): textes à 4 bases, values et associés`.

### Tâche 4 : e-mails (associés, avis d'Argon, nouveaux échecs)

**Files :** Modify `lib/brouillons-quinte/email.ts`, `lib/brouillons-quinte/email.test.ts`

**Interfaces :**
- Produces :
  - `RaisonEchec` reçoit les 6 codes `RaisonArgon`, et `RAISONS_LISIBLES` leur texte exact (spec §11) :
    - `argon_injoignable` : « Argon ne répond pas » ;
    - `argon_format_inattendu` : « la réponse d'Argon n'a pas le format attendu » ;
    - `argon_course_introuvable` : « Argon ne connaît pas ce Quinté+ » ;
    - `argon_non_scelle` : « l'édition T-90 d'Argon n'a pas été scellée à temps » ;
    - `argon_partants_incoherents` : « les chevaux d'Argon ne correspondent pas aux partants du PMU » ;
    - `argon_partants_insuffisants` : « moins de 6 chevaux d'Argon sont partants ».
  - `ResumeBrouillons` :
    - `elite` devient `{ base: ChevalResume[]; values: ChevalResume[]; associes: ChevalResume[] }` (sans `ecartes` ni `completeAvecFautifs`) ;
    - nouveau champ `argon: { lockGmt: string | null; argon8: ChevalResume[]; etoiles: number; deconseillee: boolean; decision: string | null; nonPartants: ChevalResume[] }`.

**Règles :**
- `blocSelection` affiche une ligne « 🤝 Associés : … » quand il y en a. Les titres deviennent « Pro (6 chevaux) » et « Elite ({n} chevaux) », où n = bases + values + associés.
- Si `argon.nonPartants` n'est pas vide, un paragraphe en tête : « ⚠️ n°X non partant : Elite à {n} chevaux, ajoute un cheval avant de publier. » (plusieurs numéros séparés par « et »).
- Un bloc « Avis d'Argon (pour information) » contient : édition T-90 scellée à {lockGmt} GMT, les 8 chevaux, « {etoiles} étoile(s) » et `decision` recopiée **échappée**.
- Si `deconseillee`, l'objet des e-mails « prêts » et « essai à blanc » commence par « ⚠️ Argon déconseille de jouer cette course — ».
- Les blocs « Non retenus pour leurs fautes » et « complété avec des chevaux fautifs » sont supprimés.

- [ ] **Étape 1 : adapter la fixture `R` de `email.test.ts`** (champ `argon`, `elite.associes`), puis **écrire les tests** : ligne Associés, titre « Elite (8 chevaux) », alerte non-partant (« Elite à 7 chevaux »), bloc Avis d'Argon avec `decision` contenant `<b>` échappé, objet préfixé si déconseillée (prêts et blanc) et pas d'objet préfixé sinon, objet de l'e-mail d'échec pour chacun des 6 codes. Supprimer les tests des écartés et des fautifs.
- [ ] **Étape 2 : vérifier l'échec**, puis **modifier `email.ts`**, puis **vérifier que les tests passent.**
- [ ] **Étape 3 : committer** — `feat(brouillons-argon): e-mails avec associés, avis d'Argon et échecs Argon`.

### Tâche 5 : assemblage à partir d'Argon

**Files :** Modify `lib/brouillons-quinte/assembler.ts`, `lib/brouillons-quinte/assembler.test.ts`, `lib/brouillons-quinte/selection.ts`, `lib/brouillons-quinte/selection.test.ts`, `lib/brouillons-quinte/fenetre.ts`

**Interfaces :**
- Consumes : `CourseArgon` (tâche 1), `composerArgon` et `confianceArgon` (tâche 2), `analyseComplete` (tâche 3), `ResumeBrouillons` (tâche 4).
- Produces : `EntreeAssemblage = { courseId: string; ctx: Omit<ContexteCourse, "releveCotes">; argon: CourseArgon; allocations?: AllocationsPmu | null }` (le champ `top8` disparaît) ; `assemblerBrouillons(e): ResultatAssemblage`, avec les raisons possibles `"argon_partants_insuffisants" | "cotes_indisponibles"`.

**Règles :**
- Partants = participants PMU non partants exclus.
- Rang au marché = ordre des cotes PMU croissantes des partants cotés, à égalité par numéro.
- Un cheval retenu (bases, values, associés) sans cote PMU donne `cotes_indisponibles`.
- PRO : `selection` = bases + values Pro ; rôles `BASE` / `OUTSIDER` ; pivot.
- ELITE : `selection` = bases + values Elite + associés ; rôles `BASE` / `OUTSIDER` / `ASSOCIE` (`ROLE_ASSOCIE` de `@/lib/pronostics/selection-roles`).
- `confiance = confianceArgon(argon.etoiles)` ; `source = SOURCE_BROUILLON`, qui vaut maintenant `"ARGON"` (modifier `fenetre.ts` ici, avec son test).
- Relevé des cotes = plus récent `coteMaj` parmi les chevaux retenus.
- Colonne « Retenu » du tableau : « Base ⭐ », « Base », « Value Pro », « Value Elite », « Value Pro + Elite », « Associé ». Un cheval à la fois value Pro et associé Elite est noté « Value Pro · Associé ».
- `selection.ts` ne garde que `Confiance` et `TAILLE_SELECTION`. Vérifier d'abord par `grep -rn "versChevauxClasses\|decouperPro\|choisirValuesElite\|confianceDuMarche\|appliquerCotesPmu\|FAUTES_ECARTEMENT" app lib components` qu'aucun autre fichier ne les utilise.

- [ ] **Étape 1 : réécrire `assembler.test.ts` sur le Prix Thémis** (garder les tests de `controlerDonneesPmu` sur les Gobelins) :

```ts
it("PRO : 3-6-12-13 + 7-4, pivot 3, confiance ELEVE (5 étoiles), source ARGON, non publié", () => {
  expect(r.pro.selection).toEqual([3, 6, 12, 13, 7, 4]);
  expect(r.pro.selection_detail).toEqual([
    { number: 3, role: "BASE", name: "EMINENT KRONOS", pivot: true },
    { number: 6, role: "BASE", name: "DOMENIK JET" },
    { number: 12, role: "BASE", name: "JALENDRA DE MALAC" },
    { number: 13, role: "BASE", name: "COLBERT WF" },
    { number: 7, role: "OUTSIDER", name: "KEROSEN DU GERS" },
    { number: 4, role: "OUTSIDER", name: "KISS ME AGAIN" },
  ]);
  expect(r.pro).toMatchObject({ confiance: "ELEVE", source: "ARGON", publie: false, date_publication: null, auteur_id: null });
});
it("ELITE : 3-6-12-13 + values 11-14 + associés 7-4, rôles ASSOCIE, aucun couplé", …);
it("résumé : avis d'Argon (scellée à 16:45, 5 étoiles, decision recopiée) et allocation du jour 68 000", …);
it("tableau : « Value Pro · Associé » pour 7 et 4, « Value Elite » pour 11 et 14", …);
it("un non-partant (n°6) : nonPartants [6] dans le résumé, Elite à 7 chevaux", …);
it("cheval retenu sans cote PMU : cotes_indisponibles (aucun « Xe du marché » inventé)", …);  // Review Focus 5
it("textes identiques aux brouillons (resume.textes)", …);
```

- [ ] **Étape 2 : vérifier l'échec**, puis **modifier `assembler.ts`, `selection.ts`, `fenetre.ts`**, puis **vérifier que les tests passent** (`npx vitest run lib/brouillons-quinte`).
- [ ] **Étape 3 : committer** — `feat(brouillons-argon): assemblage des brouillons à partir d'Argon`.

### Tâche 6 : source ARGON et étanchéité

**Files :** Create `supabase/migrations/20261016_pronostics_source_argon.sql` ; Modify `lib/brouillons-quinte/fenetre.ts` (+ test), `app/api/cron/ia-auto-publish/route.ts:42`, `app/api/admin/ai-review/[id]/publish/route.ts:251`, `app/api/admin/pronostics/bulk/route.ts:190`

**Interfaces :**
- Produces : `export const FILTRE_HORS_BROUILLONS = "source.is.null,source.not.in.(AUTO-MARCHE,ARGON)"` dans `fenetre.ts`.

- [ ] **Étape 1 : test** — `FILTRE_HORS_BROUILLONS` exclut les deux sources, et `gardeFous` reconnaît les brouillons `ARGON` (« déjà préparé ») mais ignore une ligne `AUTO-MARCHE`.
- [ ] **Étape 2 : remplacer** les trois `.or("source.is.null,source.neq.AUTO-MARCHE")` par `.or(FILTRE_HORS_BROUILLONS)`. Vérifier : `grep -rn "neq.AUTO-MARCHE" app lib` ne renvoie rien.
- [ ] **Étape 3 : migration**, sur le modèle de `20261007_pronostics_source_auto_marche.sql`, avec la liste `ADMIN, MVP, ia-cron, AI-MULTI-AGENT, AUTO-MARCHE, ARGON` et la requête de vérification en commentaire.
- [ ] **Étape 4 : vérifier le filtre sur la vraie base, en lecture seule** : compter les lignes de `pronostics` avec le client Supabase et `.or(FILTRE_HORS_BROUILLONS)`, puis comparer avec `select count(*) from pronostics where source is null or source not in ('AUTO-MARCHE','ARGON')`. Les deux nombres doivent être égaux et proches du total (aujourd'hui aucune ligne `AUTO-MARCHE` ni `ARGON`).
- [ ] **Étape 5 : committer** — `feat(brouillons-argon): origine ARGON et étanchéité commune`.

### Tâche 7 : lecture réseau d'Argon et branchement de la route

**Files :** Modify `lib/brouillons-quinte/argon.ts` (+ test), `app/api/cron/brouillons-quinte/route.ts` ; `.env.example` si le dépôt en a un (lignes `ARGON_API_URL=`, `ARGON_ACCESS_CLIENT_ID=`, `ARGON_ACCESS_CLIENT_SECRET=` sans valeur)

**Interfaces :**
- Produces : `export async function chargerArgon(timeoutMs = 15000): Promise<unknown | null>`. Elle renvoie `null` si la réponse n'est pas un 200, si son type de contenu ne contient pas `application/json`, si le JSON est illisible, ou en cas de délai dépassé ou d'erreur réseau.

- [ ] **Étape 1 : tests de `chargerArgon`** avec `vi.stubGlobal("fetch", …)` :
  - en-têtes `CF-Access-Client-Id` et `CF-Access-Client-Secret` envoyés si les variables existent, absents sinon ;
  - URL par défaut `https://argon.elite-turf.fr/api/races` ;
  - **page HTML de connexion Access (200, `text/html`) → `null`** (Review Focus 1) ;
  - 503 → `null` ; JSON valide → objet.
- [ ] **Étape 2 : vérifier l'échec**, puis **écrire `chargerArgon`**, puis **vérifier que les tests passent.**
- [ ] **Étape 3 : brancher la route.** Les étapes 1 et 2 de la route ne changent pas. Après `controlerDonneesPmu` :
  1. `chargerArgon()` ; `null` → `donneesInsuffisantes("argon_injoignable")`.
  2. `trouverCourseArgon(json, { dateISO: quinte.date_course, reunion, course, hippodrome: hippo?.nom ?? "" })` ; échec → `donneesInsuffisantes(raison)`.
  3. `!t90.sealed` → `donneesInsuffisantes("argon_non_scelle")` : on réessaie au passage suivant, avec l'e-mail d'échec au dernier passage seulement.
  4. `controlerChevauxArgon` ; incohérent → e-mail d'échec **immédiat** (spec §12). Ajouter `donneesInsuffisantes(raison, { immediat: true })`.
  5. `assemblerBrouillons({ courseId, ctx, argon: course, allocations: pmu.allocations })`.
  
  Supprimer `getCourseStatsEnrichies`, `buildNotreSelection` et `appliquerCotesPmu` de la route. Le mode `?apercu=1` et l'interrupteur restent identiques. Ajouter `argon8` et `etoiles` dans les détails de `cronLog`. Mettre à jour le commentaire d'en-tête (source ARGON, spec du 16/10).
- [ ] **Étape 4 : contrôles** — `npx tsc --noEmit` (0 erreur), `npx vitest run` (tout vert).
- [ ] **Étape 5 : aperçu réel** :
  - lancer le serveur de développement de la copie de travail (entrée temporaire dans `.claude/launch.json`, retirée ensuite) ;
  - appeler `GET /api/cron/brouillons-quinte?apercu=1` avec `Authorization: Bearer` lu dans `.env.local` par un petit script qui **n'affiche pas le secret** ;
  - attendu, pour le Quinté+ du jour s'il est scellé chez Argon (le 16/10 : Prix Thémis) : `pro.selection` `[3,6,12,13,7,4]`, `elite.selection` `[3,6,12,13,11,14,7,4]`, `source: "ARGON"`, `publie: false`, aucun `couple`.
  
  Noter le résultat réel dans le compte rendu. Si le Quinté+ du jour n'est pas encore scellé, l'attendu est `skipped: donnees_insuffisantes, raison: argon_non_scelle`.
- [ ] **Étape 6 : committer** — `feat(brouillons-argon): le robot T-90 lit l'édition scellée d'Argon`.

### Tâche 8 : contrôles finaux, PR et mise en route

- [ ] **Étape 1 :** `npx tsc --noEmit`, `npm run build`, `npx vitest run` : tout vert, sortie relevée.
- [ ] **Étape 2 :** relecture finale de toute la branche par un relecteur neuf, et correction de ses remarques importantes.
- [ ] **Étape 3 :** montrer le diff et l'impact à Steph, puis pousser et ouvrir la PR **seulement sur son GO**.
- [ ] **Étape 4 (après fusion, sur GO) :** appliquer la migration `20261016_pronostics_source_argon.sql` à la main. Vérifier avec `select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.pronostics'::regclass and contype = 'c';` : une seule contrainte de source, qui contient `ARGON`.
- [ ] **Étape 5 :** le lendemain, vérifier l'essai à blanc Argon : `cron_logs` (`brouillons-quinte`), `email_sent_log` (`BROUILLONS_QUINTE_BLANC_{jour}`), puis le contenu de l'e-mail avec Steph.

---

## Hors de cette PR (à faire ensuite, dans l'ordre)

**S1 — Fermer Argon (spec §13), guidé, Steph clique :**
1. Lecture seule : statistiques de sécurité Cloudflare filtrées sur l'hôte `argon.elite-turf.fr` ; relever qui appelle `/api/races` (hors navigateurs).
2. Zero Trust → Access → Applications : application « self-hosted » sur `argon.elite-turf.fr`, règle « Allow » sur l'e-mail de Steph.
3. Access → Service Auth : jeton de service ; ajouter à l'application une règle « Service Auth » pour ce jeton.
4. Worker `elite-turf` → Settings → Variables : secrets `ARGON_ACCESS_CLIENT_ID` et `ARGON_ACCESS_CLIENT_SECRET`.
5. Vérifier depuis un terminal sans session qu'Argon renvoie la page de connexion, puis que l'essai à blanc suivant lit toujours Argon.

**S2 — PR de l'offre Elite (spec §14)** : nouvelle phrase « Le plan de jeu Elite : 8 chevaux, avec la base de 4 pour le champ réduit ou total, les values et les associés » dans les 11 fichiers listés au §14. `PLAN_CONFIG.description` ne change pas. Ajouter un test qui interdit « base de 3 » dans les textes d'offre. Fusion le jour de l'ouverture.

**S3 — Ouverture** : après 1 ou 2 essais à blanc concluants et S1, Steph passe `BROUILLONS_QUINTE_ENABLED` à `true` sur le Worker `elite-turf`, guidé.
