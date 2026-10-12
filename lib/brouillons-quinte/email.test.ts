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
  allocationJour: 59000,
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
  partants: [
    { numero: 17, nom: "IMAGE D'ATALANTE", nonPartant: false, cote: 3.8, rang: 1, exAequo: false, places: ["2", "3", "2", "2", "8", "4", "0"], fautes: 0, retenu: "Base ⭐", allocations: [59000, 96000, 44000, 59500, 21000] },
    { numero: 10, nom: "JUSTICIA SMART", nonPartant: false, cote: 10, rang: 5, exAequo: false, places: ["4", "0", "D", "D", "D", "5", "D"], fautes: 4, retenu: "Value Pro", allocations: [19200, null, 15400] },
    { numero: 11, nom: "JALOUZ D'OLIVERIE", nonPartant: false, cote: 15, rang: 8, exAequo: true, places: ["9", "2", "0", "2", "2", "0", "9"], fautes: 0, retenu: "Value Elite", allocations: null },
    { numero: 14, nom: "INES DE LA ROUVRE", nonPartant: false, cote: 15, rang: 9, exAequo: true, places: ["6", "7", "4", "1", "2", "4", "8"], fautes: 0, retenu: null, allocations: [400] },
    { numero: 3, nom: "SANS MUSIQUE", nonPartant: false, cote: 57, rang: 13, exAequo: false, places: null, fautes: null, retenu: null, allocations: null },
    { numero: 12, nom: "JUNON DE LOU", nonPartant: true, cote: 6.8, rang: null, exAequo: false, places: ["4", "5", "D", "5", "D", "1", "2"], fautes: 2, retenu: null, allocations: null },
  ],
  textes: {
    courte: "Trot attelé, 2 850 m, 17 partantes. Pivot : IMAGE D'ATALANTE (n°17), favorite.",
    pro: "LA COURSE\nQuinté+ du mardi 7 octobre 2026.\n\nLA BASE\n⭐ n°17 IMAGE D'ATALANTE. Notre pivot.",
    elite: "LA COURSE\nQuinté+ du mardi 7 octobre 2026.\n\nLES VALUES\nn°11 JALOUZ D'OLIVERIE. Retenue pour sa cote parmi nos 8.",
  },
};
const LIENS: LiensBrouillons = {
  pro: "https://elite-turf.fr/admin/pronostics/a/modifier",
  elite: "https://elite-turf.fr/admin/pronostics/b/modifier",
};

describe("tableau des musiques des partants (option A du 07/10)", () => {
  const html = emailBrouillons(R, LIENS).html;

  it("titre, légende et une ligne par cheval, dans l'ordre donné", () => {
    expect(html).toContain("Musiques des partants");
    expect(html).toContain("7 dernières courses, de la plus récente à la plus ancienne");
    const i = ["IMAGE D&#39;ATALANTE", "JUSTICIA SMART", "JALOUZ D&#39;OLIVERIE", "INES DE LA ROUVRE", "SANS MUSIQUE", "JUNON DE LOU"].map((n) => html.indexOf(n));
    expect(i.every((x) => x >= 0)).toBe(true);
    expect(i).toEqual(i.slice().sort((a, b) => a - b));
  });

  it("cote à la française, rang au marché, ex-aequo signalés", () => {
    expect(html).toContain(">3,8<");
    expect(html).toContain(">8=<");
    expect(html).toContain(">9=<");
    expect(html).toContain(">1<");
  });

  it("places lisibles : podiums en vert, fautes en rouge", () => {
    expect(html).toContain('<b style="color:#15803d">2</b>');
    expect(html).toContain('<b style="color:#b91c1c">D</b>');
  });

  it("non-partant, musique inconnue et chevaux retenus", () => {
    expect(html).toContain(">non partant<");
    expect(html).toContain(">inconnue<");
    expect(html).toContain(">Base ⭐<");
    expect(html).toContain(">Value Elite<");
  });

  it("aussi dans l'essai à blanc", () => {
    expect(emailBrouillons(R, null).html).toContain("Musiques des partants");
  });

  it("sans partants : pas de tableau", () => {
    expect(emailBrouillons({ ...R, partants: [] }, LIENS).html).not.toContain("Musiques des partants");
  });
});

describe("allocations des dernières courses (demande de Steph du 12/10)", () => {
  const html = emailBrouillons(R, LIENS).html;

  it("colonne « Alloc. (k€) » : milliers d'euros, de la plus récente à la plus ancienne", () => {
    expect(html).toContain("Alloc. (k€)");
    expect(html).toContain("19 · ? · 15");
  });

  it("en gras : les courses dont l'allocation atteint au moins celle du jour", () => {
    expect(html).toContain("<b>59</b> · <b>96</b> · 44 · <b>60</b> · 21");
  });

  it("allocation inférieure à 1 000 € : « <1 »", () => {
    expect(html).toContain("&lt;1");
  });

  it("cheval sans allocation connue : tiret", () => {
    const ligne11 = html.slice(html.indexOf("JALOUZ D&#39;OLIVERIE", html.indexOf("Musiques des partants")));
    expect(ligne11.slice(0, ligne11.indexOf("</tr>"))).toContain(">—<");
  });

  it("légende : allocation du jour rappelée", () => {
    expect(html).toContain("allocation des dernières courses en milliers d'euros");
    expect(html).toContain("celle du jour (59 000 €)");
  });

  it("aussi dans l'essai à blanc", () => {
    expect(emailBrouillons(R, null).html).toContain("Alloc. (k€)");
  });

  it("aucune allocation connue (PMU muet) : ni colonne ni légende", () => {
    const sans = emailBrouillons({ ...R, partants: R.partants.map((l) => ({ ...l, allocations: null })) }, LIENS).html;
    expect(sans).not.toContain("Alloc.");
    expect(sans).not.toContain("allocation des dernières courses");
    expect(sans).toContain("Musiques des partants");
  });

  it("allocation du jour inconnue : montants affichés, rien en gras", () => {
    const sans = emailBrouillons({ ...R, allocationJour: null }, LIENS).html;
    expect(sans).toContain("59 · 96 · 44 · 60 · 21");
    expect(sans).not.toContain("celle du jour");
  });
});

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

  it("à blanc : les 3 textes prévus, à copier tels quels (lignes conservées, HTML échappé)", () => {
    const html = emailBrouillons(R, null).html;
    expect(html).toContain("Textes prévus pour les brouillons");
    expect(html).toContain("Analyse courte (aperçu public)");
    expect(html).toContain("Analyse complète — Pro");
    expect(html).toContain("Analyse complète — Elite");
    expect(html).toContain("Pivot : IMAGE D&#39;ATALANTE (n°17), favorite.");
    expect(html).toContain("LA BASE\n⭐ n°17 IMAGE D&#39;ATALANTE. Notre pivot.");
    expect(html).toContain("n°11 JALOUZ D&#39;OLIVERIE. Retenue pour sa cote parmi nos 8.");
    expect(html).toContain("white-space:pre-wrap");
  });

  it("à blanc : les textes avant le tableau des musiques", () => {
    const html = emailBrouillons(R, null).html;
    expect(html.indexOf("Textes prévus")).toBeGreaterThan(-1);
    expect(html.indexOf("Textes prévus")).toBeLessThan(html.indexOf("Musiques des partants"));
  });

  it("prêts : pas de textes dans l'e-mail (ils sont dans les brouillons)", () => {
    expect(emailBrouillons(R, LIENS).html).not.toContain("Textes prévus");
  });

  it("à blanc : un texte HTML hostile est neutralisé", () => {
    const html = emailBrouillons({ ...R, textes: { ...R.textes, pro: "<script>x</script>" } }, null).html;
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
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

  it("échec, partants incohérents : raison lisible", () => {
    const m = emailEchec({ jour: "2026-10-07", prix: "Prix des Gobelins", heureGmt: "11h55", raison: "partants_incoherents" });
    expect(m.subject).toBe("Brouillons du Quinté+ NON préparés — les partants de notre base ne correspondent pas à ceux du PMU (numéros ou noms)");
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
