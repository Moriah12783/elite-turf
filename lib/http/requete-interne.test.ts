import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requeteInterne, lireReponse } from "./requete-interne";

describe("requeteInterne", () => {
  const secretOrigine = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "secret-de-test"; });
  afterEach(() => { process.env.CRON_SECRET = secretOrigine; });

  it("porte le jeton CRON en Bearer — requireAdminAuth court-circuite dessus", () => {
    const r = requeteInterne("/api/admin/pronostic-gratuit", { course_id: "abc" });
    expect(r.headers.get("authorization")).toBe("Bearer secret-de-test");
  });

  it("est un POST JSON", async () => {
    const r = requeteInterne("/api/admin/pronostic-gratuit", { course_id: "abc" });
    expect(r.method).toBe("POST");
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(await r.json()).toEqual({ course_id: "abc" });
  });

  it("accepte une requête sans corps", () => {
    const r = requeteInterne("/api/admin/sync-resultats");
    expect(r.method).toBe("POST");
  });

  // L'hôte ne doit jamais désigner le site : c'est précisément l'appel au nom
  // d'hôte public qui déclenchait la boucle et le 522.
  it("n'utilise JAMAIS le nom d'hôte public du site", () => {
    const r = requeteInterne("/api/admin/pronostic-gratuit", {});
    expect(r.nextUrl.hostname).toBe("interne.invalid");
    expect(r.url).not.toContain("elite-turf.fr");
  });

  it("préserve le chemin, y compris les routes dynamiques", () => {
    const r = requeteInterne("/api/admin/ai-review/abc-123/publish", {});
    expect(r.nextUrl.pathname).toBe("/api/admin/ai-review/abc-123/publish");
  });
});

describe("lireReponse", () => {
  it("rend les données quand le corps est du JSON", async () => {
    const r = await lireReponse(new Response(JSON.stringify({ ok: true, id: "x" }), { status: 200 }));
    expect(r.ok).toBe(true);
    expect(r.statut).toBe(200);
    expect(r.donnees).toEqual({ ok: true, id: "x" });
  });

  // C'est ce cas qui rendait l'ancienne panne illisible : le corps valait
  // « error code: 522 », et `res.json()` levait « Unexpected token 'e' ».
  it("ne lève pas quand le corps n'est pas du JSON, et expose le texte", async () => {
    const r = await lireReponse(new Response("error code: 522\n", { status: 522 }));
    expect(r.ok).toBe(false);
    expect(r.statut).toBe(522);
    expect(r.donnees).toBeNull();
    expect(r.texte).toBe("error code: 522\n");
  });

  it("signale l'échec sur un statut d'erreur même avec un corps JSON", async () => {
    const r = await lireReponse(new Response(JSON.stringify({ error: "conflit" }), { status: 409 }));
    expect(r.ok).toBe(false);
    expect(r.statut).toBe(409);
    expect(r.donnees).toEqual({ error: "conflit" });
  });
});
