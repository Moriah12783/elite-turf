import { describe, it, expect, vi, afterEach } from "vitest";
import { trouverCourseArgon, controlerChevauxArgon, chargerArgon, type CourseArgon } from "./argon";
import { ARGON_JSON, CIBLE_THEMIS, PARTICIPANTS_THEMIS } from "./__fixtures__/themis";

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
    expect(c.t90).toEqual({ argon8: [3, 6, 12, 13, 7, 4, 11, 14], sealed: true, lockGmt: "16:45" });
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
