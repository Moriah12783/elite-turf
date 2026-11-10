import { describe, it, expect } from "vitest";
import {
  construireRecu,
  montantLisible,
  periodeLisible,
  prolongationLisible,
  type DonneesRecu,
  type Recu,
} from "./recu-mobile-money";

/** Paiement type enregistré par le formulaire (promo payé Starter → Elite, début demain). */
function donnees(surcharge: Partial<DonneesRecu> = {}, metadata: Record<string, unknown> = {}): DonneesRecu {
  return {
    reference: "ET-MM-OM-20261110140859-abcd",
    statut: "SUCCES",
    methode: "ORANGE_MONEY",
    montantFcfa: 42500,
    dateTransaction: "2026-11-10T14:08:59.691Z",
    metadata: {
      source: "admin_mobile_money",
      formule: "starter",
      pays: "BF",
      reference_paiement: "PP000000.0000.00000000",
      prolongation: false,
      niveau_accorde: "ELITE",
      debut_differe: true,
      ...metadata,
    },
    abonnement: { dateDebut: "2026-11-11", dateFin: "2026-11-17" },
    abonne: { nom: "Awa Traoré", telephone: "+226 00 00 00 00", email: "awa.traore@elite-turf.fr" },
    ...surcharge,
  };
}

function recu(d: DonneesRecu): Recu {
  const r = construireRecu(d);
  if ("erreur" in r) throw new Error(`refus inattendu : ${r.erreur}`);
  return r;
}

describe("montantLisible", () => {
  it("groupe les milliers avec une espace insécable", () => {
    expect(montantLisible(42500)).toBe("42 500");
    expect(montantLisible(136500)).toBe("136 500");
    expect(montantLisible(500)).toBe("500");
  });
});

describe("periodeLisible", () => {
  it("même mois : le mois n'est écrit qu'une fois", () => {
    expect(periodeLisible("2026-11-11", "2026-11-17")).toBe("Du mercredi 11 au mardi 17 novembre 2026 inclus");
  });
  it("mois différents : les deux mois sont écrits", () => {
    expect(periodeLisible("2026-11-30", "2026-12-06")).toBe("Du lundi 30 novembre au dimanche 6 décembre 2026 inclus");
  });
  it("années différentes : les deux années sont écrites", () => {
    expect(periodeLisible("2026-12-31", "2027-01-06")).toBe(
      "Du jeudi 31 décembre 2026 au mercredi 6 janvier 2027 inclus",
    );
  });
});

describe("prolongationLisible", () => {
  it("donne le dernier jour d'accès", () => {
    expect(prolongationLisible("2026-12-17")).toBe("Prolongé jusqu'au jeudi 17 décembre 2026 inclus");
  });
});

describe("construireRecu", () => {
  it("promo payé Starter → accès Elite : niveau Elite, mention, formule payée Starter", () => {
    const r = recu(donnees());
    expect(r.numero).toBe("ET-MM-OM-20261110140859-abcd");
    expect(r.date).toBe("10 novembre 2026");
    expect(r.montant).toBe("42 500");
    expect(r.moyen).toBe("Orange Money · Burkina Faso");
    expect(r.niveau).toBe("ELITE");
    expect(r.duree).toBe("7 jours");
    expect(r.periode).toBe("Du mercredi 11 au mardi 17 novembre 2026 inclus");
    expect(r.mention).toBe("Offert : l'offre Elite à la place du Starter payé.");
    expect(r.lignes).toEqual([
      { libelle: "Abonné", valeur: "Awa Traoré" },
      { libelle: "Téléphone", valeur: "+226 00 00 00 00" },
      { libelle: "Formule payée", valeur: "Starter · 7 jours" },
      { libelle: "Référence Orange Money", valeur: "PP000000.0000.00000000", code: true },
    ]);
    expect(r.nomFichier).toBe("Recu-Elite-Turf-Awa-Traore-2026-11-10.jpg");
  });

  it("sans niveau accordé : niveau de la formule payée, pas de mention", () => {
    const r = recu(donnees({}, { formule: "pro", niveau_accorde: null }));
    expect(r.niveau).toBe("PRO");
    expect(r.duree).toBe("30 jours");
    expect(r.mention).toBeNull();
  });

  it("abonné encore actif qui repaie : « Prolongé jusqu'au … »", () => {
    const r = recu(donnees({ abonnement: { dateDebut: "2026-11-10", dateFin: "2026-12-17" } }, { prolongation: true }));
    expect(r.periode).toBe("Prolongé jusqu'au jeudi 17 décembre 2026 inclus");
  });

  it("Wave, sans pays ni référence opérateur", () => {
    const r = recu(donnees({ methode: "WAVE" }, { pays: null, reference_paiement: null }));
    expect(r.moyen).toBe("Wave");
    expect(r.lignes.map((l) => l.libelle)).toEqual(["Abonné", "Téléphone", "Formule payée"]);
  });

  it("sans ligne d'abonnement : pas de période (rien n'est deviné)", () => {
    expect(recu(donnees({ abonnement: null })).periode).toBeNull();
  });

  it("abonné sans e-mail (adresse technique) : note WhatsApp ; sinon : le site", () => {
    expect(recu(donnees()).note[0]).toContain("WhatsApp");
    expect(recu(donnees({ abonne: { nom: "Awa Traoré", telephone: null, email: "awa@gmail.com" } })).note[0]).toContain(
      "elite-turf.fr",
    );
  });

  it("sans nom : ligne absente, fichier « abonne »", () => {
    const r = recu(donnees({ abonne: { nom: null, telephone: null, email: null } }));
    expect(r.lignes[0].libelle).toBe("Formule payée");
    expect(r.nomFichier).toBe("Recu-Elite-Turf-abonne-2026-11-10.jpg");
  });

  it("refuse : paiement non validé, autre source, autre moyen, formule inconnue", () => {
    expect(construireRecu(donnees({ statut: "EN_ATTENTE" }))).toEqual({ erreur: "STATUT" });
    expect(construireRecu(donnees({}, { source: undefined }))).toEqual({ erreur: "SOURCE" });
    expect(construireRecu(donnees({ methode: "STRIPE" }))).toEqual({ erreur: "OPERATEUR" });
    expect(construireRecu(donnees({}, { formule: "test" }))).toEqual({ erreur: "FORMULE" });
  });
});
