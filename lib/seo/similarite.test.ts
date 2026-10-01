import { describe, it, expect } from "vitest";
import {
  extraireTexteMain, texteDePremiere, metaDescription, normaliserEnMots,
  ngrammes, jaccard, analyserPages, type JetonsPays, type PageMesuree,
} from "./similarite";

const AUCUN: JetonsPays = { pays: [], capitale: [], operateur: [], devise: [] };

describe("extraireTexteMain", () => {
  it("ne garde que le <main>, sans script, style ni blocs partagés", () => {
    const html = `<html><head><title>T</title></head><body>
      <nav>Menu du site</nav>
      <main><h1>Pronostic PMU</h1>
        <script>var x = "code";</script><style>.a{}</style>
        <section data-shared="true"><div><div>Tarifs communs</div></div><p>CTA commun</p></section>
        <p>Texte propre &amp; unique&#x27;ici</p>
      </main>
      <footer>Pied de page</footer></body></html>`;
    expect(extraireTexteMain(html)).toBe("Pronostic PMU Texte propre & unique'ici");
  });

  it("retire un bloc partagé contenant des balises de même nom imbriquées", () => {
    const html = `<main><div data-shared="true"><div>A</div><div><div>B</div></div></div><div>C</div></main>`;
    expect(extraireTexteMain(html)).toBe("C");
  });

  it("chaîne vide sans <main>", () => {
    expect(extraireTexteMain("<body><p>x</p></body>")).toBe("");
  });

  it("titre, h1 et meta description", () => {
    const html = `<title>PMU Tchad aujourd&#x27;hui | Elite Turf</title><meta name="description" content="Programme &amp; arrivées"/><main><h1 class="x">PMU <span>Tchad</span></h1></main>`;
    expect(texteDePremiere(html, "title")).toBe("PMU Tchad aujourd'hui | Elite Turf");
    expect(texteDePremiere(html, "h1")).toBe("PMU Tchad");
    expect(metaDescription(html)).toBe("Programme & arrivées");
  });
});

describe("normaliserEnMots", () => {
  const jetons: JetonsPays = {
    pays: ["Côte d'Ivoire", "ivoiriens"], capitale: ["Abidjan"], operateur: ["LONACI", "PMU-CI"], devise: ["FCFA"],
  };

  it("remplace pays, capitale, opérateur et devise par des jetons", () => {
    expect(normaliserEnMots("Jouer en Côte d’Ivoire via la LONACI, 42 500 FCFA à Abidjan.", jetons))
      .toEqual(["jouer", "en", "xpays", "via", "la", "xoperateur", "42", "500", "xdevise", "à", "xcapitale"]);
  });

  it("ne remplace pas un mot qui ne fait que commencer pareil", () => {
    expect(normaliserEnMots("Abidjanais", jetons)).toEqual(["abidjanais"]);
  });

  it("variante la plus longue d'abord (PMU-CI avant PMU)", () => {
    const j: JetonsPays = { ...AUCUN, operateur: ["PMU", "PMU-CI"] };
    expect(normaliserEnMots("le PMU-CI et le PMU", j)).toEqual(["le", "xoperateur", "et", "le", "xoperateur"]);
  });
});

describe("ngrammes et jaccard", () => {
  it("5-grammes de mots", () => {
    expect(Object.keys(ngrammes("a b c d e f".split(" ")))).toEqual(["a b c d e", "b c d e f"]);
    expect(Object.keys(ngrammes("a b c".split(" ")))).toEqual([]);
  });

  it("jaccard : identiques = 1, disjoints = 0, vides = 0", () => {
    const a = ngrammes("un deux trois quatre cinq six".split(" "));
    expect(jaccard(a, a)).toBe(1);
    expect(jaccard(a, ngrammes("x y z w v u".split(" ")))).toBe(0);
    expect(jaccard({}, {})).toBe(0);
  });

  it("jaccard partiel : 1 commun sur 3 distincts", () => {
    const a = ngrammes("a b c d e f".split(" "));    // abcde, bcdef
    const b = ngrammes("b c d e f g".split(" "));    // bcdef, cdefg
    expect(jaccard(a, b)).toBeCloseTo(1 / 3, 5);
  });
});

describe("analyserPages", () => {
  const page = (slug: string, texte: string, nom: string, extra: Partial<PageMesuree> = {}): PageMesuree => ({
    slug, texte, titre: `Titre ${slug}`, h1: `H1 ${slug}`, metaDescription: `Meta ${slug}`,
    jetons: { ...AUCUN, pays: [nom] }, ...extra,
  });
  const gabarit = (nom: string) =>
    `Elite Turf publie chaque jour des analyses des courses PMU jouables depuis ${nom} avec une méthode publique et transparente pour tous les parieurs`;

  it("deux pages qui ne diffèrent que par le nom du pays sont identiques", () => {
    const r = analyserPages([page("mali", gabarit("Mali"), "Mali"), page("tchad", gabarit("Tchad"), "Tchad")]);
    expect(r.paires[0].similarite).toBe(1);
    expect(r.pages[0].partPropre).toBe(0);
    expect(r.infractions.length).toBeGreaterThan(0);
  });

  it("des pages au contenu propre passent sous les seuils", () => {
    const r = analyserPages([
      page("tchad", "le programme du jour est affiché à l'heure de N'Djamena avec les arrivées officielles et les rapports", "Tchad"),
      page("maroc", "les courses marocaines de la sorec ne sont pas couvertes par notre moteur qui analyse uniquement les réunions françaises", "Maroc"),
    ]);
    expect(r.paires[0].similarite).toBe(0);
    expect(r.infractions).toEqual([]);
  });

  it("titres, H1 et meta descriptions en double ou vides sont signalés", () => {
    const r = analyserPages([
      page("mali", "a b c d e f", "Mali", { titre: "Pronostic PMU", metaDescription: "" }),
      page("tchad", "g h i j k l", "Tchad", { titre: "Pronostic PMU" }),
    ]);
    expect(r.infractions).toContain("titre en double : mali, tchad");
    expect(r.infractions).toContain("metaDescription vide : mali");
  });
});
