import { describe, it, expect, afterEach } from "vitest";
import crypto from "crypto";
import { parseIngestPayload } from "./ingest";
import { verifyIngestAuth } from "./ingest-auth";
import { validateConsensusBlock } from "./validate";

/** Payload conforme (contrat v2.4) — Enghien R1C8 du 01/07, 33 sources. */
function validPayload() {
  return {
    contract_version: "2.4",
    run_type: "matin",
    course: { date: "2026-07-01", reunion_course: "R1C8", hippodrome: "Enghien", nb_partants: 15 },
    consensus: {
      nb_sources: 33, nb_sources_brut: 35, echantillon_reduit: false,
      citations: [
        { numero: 7, citations: 33, bases: 12 }, { numero: 8, citations: 33, bases: 10 },
        { numero: 4, citations: 32, bases: 10 }, { numero: 11, citations: 29, bases: 1 },
        { numero: 13, citations: 27, bases: 0 }, { numero: 6, citations: 26, bases: 0 },
        { numero: 9, citations: 26, bases: 0 }, { numero: 15, citations: 23, bases: 0 },
        { numero: 5, citations: 20, bases: 0 }, { numero: 1, citations: 6, bases: 0 },
        { numero: 14, citations: 4, bases: 0 }, { numero: 3, citations: 2, bases: 0 },
        { numero: 10, citations: 2, bases: 0 }, { numero: 12, citations: 1, bases: 0 },
      ],
    },
    commentaires: {
      elite: { confiance: 3, selection: [7, 8, 4, 11, 13, 6], analyse_courte: "teaser", analyse_complete: "long" },
      pro: { confiance: 2, selection: [7, 8, 4, 11, 13, 6, 9, 15], analyse_courte: "t", analyse_complete: "l" },
    },
    meta: { genere_le: "2026-07-01T10:10:00Z", sources: ["stats-quinte"] },
  };
}

describe("parseIngestPayload — structure du contrat v2.4", () => {
  it("payload conforme → ok, bloc reconstruit + commentaires", () => {
    const r = parseIngestPayload(validPayload());
    expect(r.ok).toBe(true);
    expect(r.parsed?.reunion_course).toBe("R1C8");
    expect(r.parsed?.nb_sources).toBe(33);
    expect(r.parsed?.citations.length).toBe(14);
    expect(r.parsed?.texteBloc.split("\n")[0]).toBe("7 33 12");
    expect(r.parsed?.commentaires.elite?.selection).toEqual([7, 8, 4, 11, 13, 6]);
  });

  it("course.non_partants parsé en entiers stricts ; absent → []", () => {
    const p = validPayload(); (p.course as any).non_partants = [2, "5", 3.5];
    expect(parseIngestPayload(p).parsed?.non_partants).toEqual([2, 5]); // 3.5 rejeté
    expect(parseIngestPayload(validPayload()).parsed?.non_partants).toEqual([]);
  });

  it("run_type invalide → erreur", () => {
    const p = validPayload(); (p as any).run_type = "soir";
    expect(parseIngestPayload(p).ok).toBe(false);
  });

  it("reunion_course non RxCx → erreur", () => {
    const p = validPayload(); p.course.reunion_course = "course 8";
    const r = parseIngestPayload(p);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("RxCx");
  });

  it("nb_partants manquant → erreur", () => {
    const p = validPayload(); (p.course as any).nb_partants = null;
    expect(parseIngestPayload(p).ok).toBe(false);
  });

  it("citations vides → erreur", () => {
    const p = validPayload(); p.consensus.citations = [];
    expect(parseIngestPayload(p).ok).toBe(false);
  });

  it("le bloc reconstruit passe la validation Lot 1 (bout en bout)", () => {
    const r = parseIngestPayload(validPayload());
    const report = validateConsensusBlock({
      nbPartants: r.parsed!.nb_partants, nbSources: r.parsed!.nb_sources, texte: r.parsed!.texteBloc,
    });
    expect(report.ok).toBe(true);
  });

  it("cote flottante glissée dans bases (4.6) → ligne fautive → E01 à la validation", () => {
    const p = validPayload();
    (p.consensus.citations[11] as any) = { numero: 3, citations: 2, bases: 4.6 };
    const r = parseIngestPayload(p);
    const report = validateConsensusBlock({
      nbPartants: r.parsed!.nb_partants, nbSources: r.parsed!.nb_sources, texte: r.parsed!.texteBloc,
    });
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === "E01")).toBe(true);
  });

  it("bug 01/07 par l'API (bases=144 pour 2 citations) → E04 à la validation", () => {
    const p = validPayload();
    p.consensus.citations[11] = { numero: 3, citations: 2, bases: 144 }; // le « 144 »
    const r = parseIngestPayload(p);
    expect(r.ok).toBe(true); // structurellement 3 entiers → parse OK
    const report = validateConsensusBlock({
      nbPartants: r.parsed!.nb_partants, nbSources: r.parsed!.nb_sources, texte: r.parsed!.texteBloc,
    });
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === "E04" && e.message.includes("144"))).toBe(true);
  });
});

describe("verifyIngestAuth — Bearer + HMAC", () => {
  const KEY = "etk_live_testkey";
  const SECRET = "testsecret";
  const body = JSON.stringify({ hello: "world" });

  afterEach(() => {
    delete process.env.ELITE_INGEST_KEY;
    delete process.env.ELITE_INGEST_SECRET;
  });

  it("clé serveur absente → 401 (fail-closed)", async () => {
    const r = await verifyIngestAuth(`Bearer ${KEY}`, null, body);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("Bearer correct, pas de secret → ok", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    const r = await verifyIngestAuth(`Bearer ${KEY}`, null, body);
    expect(r.ok).toBe(true);
  });

  it("Bearer absent/mauvais → 401", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    expect((await verifyIngestAuth(null, null, body)).status).toBe(401);
    expect((await verifyIngestAuth("Bearer wrong", null, body)).status).toBe(401);
  });

  it("secret posé, signature absente → 403", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    process.env.ELITE_INGEST_SECRET = SECRET;
    const r = await verifyIngestAuth(`Bearer ${KEY}`, null, body);
    expect(r.status).toBe(403);
  });

  it("secret posé, signature correcte → ok", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    process.env.ELITE_INGEST_SECRET = SECRET;
    const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    const r = await verifyIngestAuth(`Bearer ${KEY}`, sig, body);
    expect(r.ok).toBe(true);
  });

  it("secret posé, signature erronée → 403", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    process.env.ELITE_INGEST_SECRET = SECRET;
    const r = await verifyIngestAuth(`Bearer ${KEY}`, "deadbeef", body);
    expect(r.status).toBe(403);
  });

  it("signature d'un AUTRE corps → 403 (le HMAC lie la signature au payload exact)", async () => {
    process.env.ELITE_INGEST_KEY = KEY;
    process.env.ELITE_INGEST_SECRET = SECRET;
    const sig = crypto.createHmac("sha256", SECRET).update("autre corps").digest("hex");
    const r = await verifyIngestAuth(`Bearer ${KEY}`, sig, body);
    expect(r.status).toBe(403);
  });
});
