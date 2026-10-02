import { describe, it, expect } from "vitest";
import { resumeCourse, nomPersonne, aUneArrivee, veille, lignesRapports, euros } from "./arrivee-vedette";

// Quinté+ réel du 01/10/2026 (base Elite Turf) : 15 partants déclarés, aucun non-partant.
const course = { hippodrome: "Auteuil", categorie: "OBSTACLE", distance_metres: 3600, nb_partants: 15 };
const arrivee = [15, 3, 14, 1, 9, 4, 11];
const podium = [
  { numero: 15, nom_cheval: "LIPRIKA D'ANJOU", jockey: "F.GILES", entraineur: "H.MERIENNE (S)" },
  { numero: 3, nom_cheval: "GREY FIGHTER", jockey: "K.Nabet", entraineur: "N. GEORGE & A. ZETTERHOLM" },
  { numero: 14, nom_cheval: "LUTECE ALLEN", jockey: "A.ZULIANI", entraineur: "GAB.LEENDERS (S)" },
];

describe("resumeCourse — uniquement les données de la base", () => {
  it("Quinté+ du 01/10/2026 (liste des partants incomplète → nombre déclaré)", () => {
    expect(resumeCourse(course, arrivee, podium)).toEqual([
      "Course d'obstacles à Auteuil sur 3 600 m, 15 partants : victoire de LIPRIKA D'ANJOU (n°15), avec F. GILES, pour l'entraîneur H. MERIENNE (S).",
      "GREY FIGHTER (n°3) et LUTECE ALLEN (n°14) complètent le podium.",
    ]);
  });

  it("non-partant (cas du 28/09/2026) : décompté des partants et signalé", () => {
    const tous = [];
    for (let n = 1; n <= 15; n++) tous.push({ numero: n, nom_cheval: `CHEVAL ${n}`, non_partant: n === 8 });
    const phrases = resumeCourse({ hippodrome: "Vincennes", categorie: "TROT", distance_metres: 2700, nb_partants: 15 }, [5, 2, 11, 1, 9], tous);
    expect(phrases).toEqual([
      "Course de trot à Vincennes sur 2 700 m, 14 partants : victoire de CHEVAL 5 (n°5).",
      "CHEVAL 2 (n°2) et CHEVAL 11 (n°11) complètent le podium.",
      "Non-partant : n°8.",
    ]);
  });

  it("plusieurs non-partants, dans l'ordre des numéros", () => {
    const partants = [{ numero: 11, non_partant: true }, { numero: 4, non_partant: true }, { numero: 7, non_partant: true }];
    expect(resumeCourse(course, [1, 2, 3], partants)?.[2]).toBe("Non-partants : n°4, n°7 et n°11.");
  });

  it("rien d'inventé quand les données manquent", () => {
    expect(resumeCourse({ hippodrome: null, categorie: null, distance_metres: 0, nb_partants: null }, [7, 2, 5], []))
      .toEqual(["Victoire du n°7.", "Le n°2 et le n°5 complètent le podium."]);
    expect(resumeCourse({ hippodrome: "Chantilly", categorie: null, distance_metres: null, nb_partants: 0 }, [7, 2], []))
      .toEqual(["Course à Chantilly : victoire du n°7.", "Le n°2 termine deuxième."]);
  });

  it("sans arrivée → null (la carte affiche alors « Arrivée en attente »)", () => {
    expect(resumeCourse(course, [], podium)).toBeNull();
    expect(resumeCourse(course, null, podium)).toBeNull();
    expect(aUneArrivee(undefined)).toBe(false);
    expect(aUneArrivee([15])).toBe(true);
  });
});

describe("veille", () => {
  it("jour précédent, y compris aux changements de mois, d'année et d'heure", () => {
    expect(veille("2026-10-01")).toBe("2026-09-30");
    expect(veille("2027-01-01")).toBe("2026-12-31");
    expect(veille("2026-10-26")).toBe("2026-10-25"); // lendemain du passage à l'heure d'hiver
    expect(veille("2028-03-01")).toBe("2028-02-29");
  });
});

describe("nomPersonne", () => {
  it("ajoute seulement une espace insécable après les initiales collées", () => {
    expect(nomPersonne("G.MEUNIER")).toBe("G. MEUNIER");
    expect(nomPersonne("K.Nabet")).toBe("K. Nabet");
    expect(nomPersonne("J.-M.BAZIRE")).toBe("J.-M. BAZIRE");
    expect(nomPersonne("  N. GEORGE &  A. ZETTERHOLM ")).toBe("N. GEORGE & A. ZETTERHOLM");
  });
});

describe("lignesRapports — rapports PMU définitifs sur la carte d'arrivée", () => {
  it("Quinté+ réel du 01/10/2026, puis Quarté+ et Tiercé", () => {
    const lignes = lignesRapports({
      quinte_plus: { ordre: 26003.8, desordre: 248, bonus4: 7.4, bonus3: 6.2 },
      quarte_plus: { ordre: 4127.4, desordre: 81.9, bonus: 16.3 },
      tierce: { ordre: 646.4, desordre: 98.5 },
    });
    expect(lignes).toEqual([
      { pari: "Quinté+", mise: "pour 2 €", detail: "ordre 26 003,80 € · désordre 248,00 € · bonus 4/5 7,40 € · bonus 3 6,20 €" },
      { pari: "Quarté+", mise: "pour 1 €", detail: "ordre 4 127,40 € · désordre 81,90 € · bonus 16,30 €" },
      { pari: "Tiercé", mise: "pour 1 €", detail: "ordre 646,40 € · désordre 98,50 €" },
    ]);
  });

  it("rien d'inventé : pas de rapports, pas de ligne ; valeurs absentes omises", () => {
    expect(lignesRapports(null)).toEqual([]);
    expect(lignesRapports({ tierce: {} })).toEqual([]);
    expect(lignesRapports({ quinte_plus: { desordre: 248 } })).toEqual([{ pari: "Quinté+", mise: "pour 2 €", detail: "désordre 248,00 €" }]);
  });

  it("euros : arrondi au centime", () => {
    expect(euros(0.5)).toBe("0,50 €");
    expect(euros(1300190.0)).toBe("1 300 190,00 €");
  });
});
