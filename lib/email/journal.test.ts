import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { journaliserEmail, TYPES_JOURNAL } from "./journal";

/** Faux client : capture l'appel `from(table).upsert(ligne, options)`. */
function fauxClient(reponse: { error: { message: string } | null } | Error) {
  const appels: { table: string; ligne: Record<string, unknown>; options: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: (ligne: Record<string, unknown>, options: unknown) => {
        appels.push({ table, ligne, options });
        return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse);
      },
    }),
  } as unknown as SupabaseClient;
  return { client, appels };
}

describe("journal des e-mails envoyés (email_sent_log)", () => {
  it("une ligne par (utilisateur, type), le dernier envoi l'emporte", async () => {
    const { client, appels } = fauxClient({ error: null });
    const erreur = await journaliserEmail(client, {
      userId: "u1",
      email: "abonne@exemple.com",
      type: TYPES_JOURNAL.CONFIRMATION_PAIEMENT_CARTE,
      ok: true,
    });
    expect(erreur).toBeNull();
    expect(appels).toHaveLength(1);
    expect(appels[0].table).toBe("email_sent_log");
    expect(appels[0].options).toEqual({ onConflict: "user_id,type" });
    expect(appels[0].ligne).toMatchObject({
      user_id: "u1",
      email: "abonne@exemple.com",
      type: "CONFIRMATION_PAIEMENT_CARTE",
      status: "SENT",
      error: null,
    });
  });

  it("envoi refusé : FAILED avec la raison", async () => {
    const { client, appels } = fauxClient({ error: null });
    await journaliserEmail(client, {
      userId: "u1",
      email: "a@b.c",
      type: TYPES_JOURNAL.CONFIRMATION_RENOUVELLEMENT_CARTE,
      ok: false,
      erreur: "domain not verified",
    });
    expect(appels[0].ligne).toMatchObject({ status: "FAILED", error: "domain not verified", type: "CONFIRMATION_RENOUVELLEMENT_CARTE" });
  });

  it("le journal n'interrompt jamais l'appelant : erreur renvoyée, pas lancée", async () => {
    expect(await journaliserEmail(fauxClient({ error: { message: "violates unique" } }).client, {
      userId: "u1", email: "a@b.c", type: TYPES_JOURNAL.CONFIRMATION_ABONNEMENT, ok: true,
    })).toBe("violates unique");
    expect(await journaliserEmail(fauxClient(new Error("réseau")).client, {
      userId: "u1", email: "a@b.c", type: TYPES_JOURNAL.CONFIRMATION_ABONNEMENT, ok: true,
    })).toBe("réseau");
  });

  it("types distincts, lisibles d'un coup d'œil dans l'historique", () => {
    expect(TYPES_JOURNAL).toEqual({
      CONFIRMATION_ABONNEMENT: "CONFIRMATION_ABONNEMENT",
      CONFIRMATION_PAIEMENT_CARTE: "CONFIRMATION_PAIEMENT_CARTE",
      CONFIRMATION_RENOUVELLEMENT_CARTE: "CONFIRMATION_RENOUVELLEMENT_CARTE",
    });
  });
});
