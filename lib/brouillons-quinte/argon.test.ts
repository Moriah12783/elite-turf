import { describe, it, expect, vi, afterEach } from "vitest";
import { trouverCourseArgon, controlerChevauxArgon, chargerArgon, raisonT90, t90Definitive, type CourseArgon } from "./argon";
import { ARGON_JSON, CIBLE_THEMIS, PARTICIPANTS_THEMIS } from "./__fixtures__/themis";
import argonJson20 from "./__fixtures__/argon-races-20261020.json";

/** Copie modifiable de la vraie réponse d'Argon. */
const copie = (): any => JSON.parse(JSON.stringify(ARGON_JSON));
const themis = (j: any): any => j.races.find((r: any) => r.race_id === "R1C4_16102026_VINCENNES");
const lire = (j: unknown = ARGON_JSON, cible = CIBLE_THEMIS) => trouverCourseArgon(j, cible);
const FORMAT = { ok: false, raison: "argon_format_inattendu" };
const INTROUVABLE = { ok: false, raison: "argon_course_introuvable" };

/** La vraie réponse modifiée par `modifier` (sur la course du Prix Thémis). */
function avec(modifier: (course: any) => void): unknown {
  const j = copie();
  modifier(themis(j));
  return j;
}

function courseLue(j: unknown = ARGON_JSON): CourseArgon {
  const r = lire(j);
  if (!r.ok) throw new Error(r.raison);
  return r.course;
}

describe("trouverCourseArgon — vraie réponse d'Argon du 16/10/2026", () => {
  it("trouve le Prix Thémis : T-90 scellée à 16:45, 8 chevaux, 5 étoiles, course jouable", () => {
    const c = courseLue();
    expect(c.t90).toEqual({ argon8: [3, 6, 12, 13, 7, 4, 11, 14], sealed: true, lockGmt: "16:45", statut: null });
    expect(c.etoiles).toBe(5);
    expect(c.deconseillee).toBe(false);
    expect(c.sniper).toEqual({ numero: 12, cote: 11 });
    expect(c.decision).toBe("⭐ COUPLE MAITRE: 3 (NC) - 6 (4e 🔵) · 🎯 SNIPER: N°12 (NC)");
    expect(c.coureurs.find((x) => x.numero === 11)).toEqual({ numero: 11, nom: "READLY LAVEC", avantage: 0.3 });
    expect(c).toMatchObject({ date: "2026-10-16", reunion: 1, course: 4, hippodrome: "VINCENNES" });
  });

  it("hippodrome écrit autrement (« Paris-Vincennes » en base, « VINCENNES » chez Argon) : reconnu", () => {
    expect(lire(ARGON_JSON, { ...CIBLE_THEMIS, hippodrome: "Paris-Vincennes" }).ok).toBe(true);
  });

  it("même date et même R/C mais un autre hippodrome : introuvable", () => {
    expect(lire(ARGON_JSON, { ...CIBLE_THEMIS, hippodrome: "Enghien" })).toEqual(INTROUVABLE);
  });

  it("même R/C un autre jour (historique d'Argon) : introuvable", () => {
    expect(lire(ARGON_JSON, { ...CIBLE_THEMIS, dateISO: "2026-10-15" })).toEqual(INTROUVABLE);
  });

  it("une autre course du jour (R1C1) n'est pas prise pour le Quinté+", () => {
    expect(lire(ARGON_JSON, { ...CIBLE_THEMIS, course: 2 })).toEqual(INTROUVABLE);
  });

  it("deux courses candidates : format inattendu", () => {
    const j = copie();
    j.races.push(JSON.parse(JSON.stringify(themis(j))));
    expect(lire(j)).toEqual(FORMAT);
  });

  it("racine illisible : status différent de ok, races absent, réponse vide", () => {
    const j = copie();
    j.status = "erreur";
    expect(lire(j)).toEqual(FORMAT);
    const k = copie();
    delete k.races;
    expect(lire(k)).toEqual(FORMAT);
    expect(lire(null)).toEqual(FORMAT);
    expect(lire("<html>")).toEqual(FORMAT);
  });

  it("argon8 de 7 chevaux, avec un doublon, ou un numéro non entier : format inattendu", () => {
    expect(lire(avec((c) => c.editions_schedule.T90.argon8.pop()))).toEqual(FORMAT);
    expect(lire(avec((c) => { c.editions_schedule.T90.argon8[7] = 3; }))).toEqual(FORMAT);
    expect(lire(avec((c) => { c.editions_schedule.T90.argon8[0] = "3"; }))).toEqual(FORMAT);
  });

  it("édition T-90 absente ou sans drapeau sealed : format inattendu", () => {
    expect(lire(avec((c) => { delete c.editions_schedule.T90; }))).toEqual(FORMAT);
    expect(lire(avec((c) => { delete c.editions_schedule.T90.sealed; }))).toEqual(FORMAT);
  });

  it("T-90 pas encore scellée : la course est lue, sealed vaut false", () => {
    expect(courseLue(avec((c) => { c.editions_schedule.T90.sealed = false; })).t90.sealed).toBe(false);
  });

  it("étoiles 0, 6 ou \"5\", is_no_bet absent : format inattendu", () => {
    for (const etoiles of [0, 6, "5", 4.5]) {
      expect(lire(avec((c) => { c.confidence_stars = etoiles; }))).toEqual(FORMAT);
    }
    expect(lire(avec((c) => { delete c.is_no_bet; }))).toEqual(FORMAT);
  });

  it("course déconseillée par Argon : deconseillee vaut true", () => {
    expect(courseLue(avec((c) => { c.is_no_bet = true; })).deconseillee).toBe(true);
  });

  it("edge_pts en texte (\"0.3\") : format inattendu ; absent ou null : avantage null", () => {
    const coureur11 = (c: any) => c.runners.find((r: any) => r.num === 11);
    expect(lire(avec((c) => { coureur11(c).edge_pts = "0.3"; }))).toEqual(FORMAT);
    const sans = courseLue(avec((c) => { delete coureur11(c).edge_pts; }));
    expect(sans.coureurs.find((x) => x.numero === 11)!.avantage).toBeNull();
    const nul = courseLue(avec((c) => { coureur11(c).edge_pts = null; }));
    expect(nul.coureurs.find((x) => x.numero === 11)!.avantage).toBeNull();
  });

  it("coureur sans nom : format inattendu", () => {
    expect(lire(avec((c) => { c.runners[0].name = ""; }))).toEqual(FORMAT);
  });
});

describe("nouveau format d'Argon : statut des éditions (vraie réponse du 20/10/2026)", () => {
  // SCELLEE : Les Sables d'Olonne R4C8 du 19/10 ; MANQUEE : Agen R8C8 du 19/10 ; PROVISOIRE : Prix des Equidays du 20/10.
  const copie20 = (): any => JSON.parse(JSON.stringify(argonJson20));
  const SABLES = { dateISO: "2026-10-19", reunion: 4, course: 8, hippodrome: "Les Sables d'Olonne" };
  const AGEN = { dateISO: "2026-10-19", reunion: 8, course: 8, hippodrome: "Agen La Garenne" };
  const EQUIDAYS = { dateISO: "2026-10-20", reunion: 1, course: 1, hippodrome: "Clairefontaine-Deauville" };
  const t90De = (j: any, cible: typeof SABLES): any =>
    j.races.find((r: any) => r.date === cible.dateISO && r.reunion === cible.reunion && r.course_num === cible.course).editions_schedule.T90;
  function lue(cible: typeof SABLES, modifier?: (t90: any) => void): CourseArgon {
    const j = copie20();
    if (modifier) modifier(t90De(j, cible));
    const r = trouverCourseArgon(j, cible);
    if (!r.ok) throw new Error(r.raison);
    return r.course;
  }
  const lire20 = (cible: typeof SABLES, modifier: (t90: any) => void) => {
    const j = copie20();
    modifier(t90De(j, cible));
    return trouverCourseArgon(j, cible);
  };

  it("T-90 SCELLEE : lue, rien à attendre", () => {
    const c = lue(SABLES);
    expect(c.t90).toEqual({ argon8: [9, 10, 13, 11, 2, 12, 7, 15], sealed: true, lockGmt: "17:00", statut: "SCELLEE" });
    expect(raisonT90(c)).toBeNull();
  });

  it("T-90 MANQUEE (aucun cheval) : lue, raison argon_t90_manquee — pas « format inattendu »", () => {
    const c = lue(AGEN);
    expect(c.t90).toMatchObject({ argon8: [], sealed: false, statut: "MANQUEE" });
    expect(raisonT90(c)).toBe("argon_t90_manquee");
  });

  it("T-90 PARTIELLE (50 à 90 % de cotes, aucun cheval servi) : raison argon_t90_partielle, définitive", () => {
    // Forme servie par Argon depuis le 19/10 au soir : argon8 vide, valeurs dans argon8_partiel.
    const c = lue(AGEN, (t) => { t.statut = "PARTIELLE"; t.argon8 = []; t.argon8_partiel = [1, 2, 3, 4, 5, 6, 7, 8]; t.cotes_pct = 72; });
    expect(c.t90).toMatchObject({ argon8: [], sealed: false, statut: "PARTIELLE" });
    expect(raisonT90(c)).toBe("argon_t90_partielle");
    expect(t90Definitive("argon_t90_partielle")).toBe(true);
  });

  it("T-90 en attente de cotes (EN_ATTENTE_COTES) : on attend le passage suivant", () => {
    const c = lue(EQUIDAYS, (t) => { t.statut = "EN_ATTENTE_COTES"; t.argon8 = []; });
    expect(raisonT90(c)).toBe("argon_non_scelle");
    expect(t90Definitive("argon_non_scelle")).toBe(false);
    expect(t90Definitive("argon_t90_manquee")).toBe(true);
  });

  it("T-90 PROVISOIRE avant le scellement : on attend le passage suivant", () => {
    const c = lue(EQUIDAYS);
    expect(c.t90).toMatchObject({ sealed: false, statut: "PROVISOIRE", lockGmt: "10:25" });
    expect(raisonT90(c)).toBe("argon_non_scelle");
  });

  it("édition non scellée sans chevaux (NON_VERIFIEE, argon8 vide) : on attend", () => {
    const c = lue(EQUIDAYS, (t) => { t.statut = "NON_VERIFIEE"; t.argon8 = []; });
    expect(raisonT90(c)).toBe("argon_non_scelle");
  });

  it("sealed et statut contradictoires : format inattendu", () => {
    expect(lire20(SABLES, (t) => { t.statut = "PROVISOIRE"; })).toEqual(FORMAT);
    expect(lire20(EQUIDAYS, (t) => { t.statut = "SCELLEE"; })).toEqual(FORMAT);
  });

  it("édition scellée avec 7 chevaux : toujours format inattendu", () => {
    expect(lire20(SABLES, (t) => { t.argon8.pop(); })).toEqual(FORMAT);
  });

  it("statut d'un type inattendu, ou chevaux non entiers dans une édition non scellée : format inattendu", () => {
    expect(lire20(SABLES, (t) => { t.statut = 3; })).toEqual(FORMAT);
    expect(lire20(EQUIDAYS, (t) => { t.argon8[0] = "2"; })).toEqual(FORMAT);
  });

  it("ancien format sans statut (16/10) : statut null, la T-90 scellée suffit", () => {
    expect(raisonT90(courseLue())).toBeNull();
    expect(raisonT90(courseLue(avec((c) => { c.editions_schedule.T90.sealed = false; })))).toBe("argon_non_scelle");
  });
});

describe("controlerChevauxArgon", () => {
  it("vraies données : les 8 chevaux d'Argon sont les partants du PMU", () => {
    expect(controlerChevauxArgon(courseLue(), PARTICIPANTS_THEMIS)).toBeNull();
  });

  it("un nom différent pour un même numéro : incohérent", () => {
    const c = courseLue(avec((k) => { k.runners.find((r: any) => r.num === 7).name = "AUTRE CHEVAL"; }));
    expect(controlerChevauxArgon(c, PARTICIPANTS_THEMIS)).toBe("argon_partants_incoherents");
  });

  it("numéro de argon8 absent des coureurs Argon : incohérent", () => {
    const c = courseLue(avec((k) => { k.runners = k.runners.filter((r: any) => r.num !== 14); }));
    expect(controlerChevauxArgon(c, PARTICIPANTS_THEMIS)).toBe("argon_partants_incoherents");
  });

  it("numéro de argon8 absent du PMU : incohérent", () => {
    expect(controlerChevauxArgon(courseLue(), PARTICIPANTS_THEMIS.filter((p) => p.numero !== 14))).toBe("argon_partants_incoherents");
  });
});

describe("chargerArgon (lecture réseau)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ARGON_API_URL;
    delete process.env.ARGON_ACCESS_CLIENT_ID;
    delete process.env.ARGON_ACCESS_CLIENT_SECRET;
  });

  const reponse = (corps: string, statut = 200, type = "application/json; charset=utf-8") =>
    new Response(corps, { status: statut, headers: { "content-type": type } });

  function espion(r: () => Promise<Response>) {
    const f = vi.fn((_url: string, _init: any) => r());
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("URL par défaut, sans jeton : pas d'en-têtes Access ; JSON valide → objet", async () => {
    const f = espion(async () => reponse('{"status":"ok","races":[]}'));
    expect(await chargerArgon()).toEqual({ status: "ok", races: [] });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://argon.elite-turf.fr/api/races");
    expect(init.headers["CF-Access-Client-Id"]).toBeUndefined();
    expect(init.headers["CF-Access-Client-Secret"]).toBeUndefined();
  });

  it("jeton de service présent : en-têtes CF-Access-Client-Id et CF-Access-Client-Secret envoyés", async () => {
    process.env.ARGON_ACCESS_CLIENT_ID = "id-de-test.access";
    process.env.ARGON_ACCESS_CLIENT_SECRET = "secret-de-test";
    const f = espion(async () => reponse('{"status":"ok","races":[]}'));
    await chargerArgon();
    const [, init] = f.mock.calls[0];
    expect(init.headers["CF-Access-Client-Id"]).toBe("id-de-test.access");
    expect(init.headers["CF-Access-Client-Secret"]).toBe("secret-de-test");
  });

  it("ARGON_API_URL définie : c'est elle qui est lue", async () => {
    process.env.ARGON_API_URL = "https://argon.exemple.test/api/races";
    const f = espion(async () => reponse('{"status":"ok","races":[]}'));
    await chargerArgon();
    expect(f.mock.calls[0][0]).toBe("https://argon.exemple.test/api/races");
  });

  it("page HTML de connexion Cloudflare Access (200, text/html) → null, jamais lue comme des données", async () => {
    espion(async () => reponse("<!DOCTYPE html><title>Cloudflare Access</title>", 200, "text/html; charset=UTF-8"));
    expect(await chargerArgon()).toBeNull();
  });

  it("Argon en erreur (503) → null", async () => {
    espion(async () => reponse('{"error":"maintenance"}', 503));
    expect(await chargerArgon()).toBeNull();
  });

  it("JSON illisible → null", async () => {
    espion(async () => reponse("{pas du json"));
    expect(await chargerArgon()).toBeNull();
  });

  it("erreur réseau → null", async () => {
    espion(async () => { throw new TypeError("fetch failed"); });
    expect(await chargerArgon()).toBeNull();
  });
});
