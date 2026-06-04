import { describe, expect, it } from "vitest";
import { effectiveSubscription } from "./subscription";

const NOW = "2026-06-04T12:00:00.000Z";

describe("effectiveSubscription() — garde-fou date_fin", () => {
  it("GRATUIT reste GRATUIT (peu importe la date)", () => {
    expect(effectiveSubscription("GRATUIT", null, NOW)).toBe("GRATUIT");
    expect(effectiveSubscription(null, null, NOW)).toBe("GRATUIT");
    expect(effectiveSubscription(undefined, "2099-01-01", NOW)).toBe("GRATUIT");
  });

  it("EXPIRE reste EXPIRE", () => {
    expect(effectiveSubscription("EXPIRE", null, NOW)).toBe("EXPIRE");
    expect(effectiveSubscription("EXPIRE", "2099-01-01", NOW)).toBe("EXPIRE");
  });

  it("premium NON expiré (date future) → statut conservé", () => {
    expect(effectiveSubscription("PRO", "2026-07-05T00:00:00Z", NOW)).toBe("PRO");
    expect(effectiveSubscription("ELITE", "2099-01-01", NOW)).toBe("ELITE");
    expect(effectiveSubscription("STARTER", "2026-06-11", NOW)).toBe("STARTER");
  });

  it("premium EXPIRÉ (date passée) → EXPIRE, même si le cron n'a pas basculé", () => {
    // Cas réel prod : PRO expiré le 2026-04-30, statut encore "PRO".
    expect(effectiveSubscription("PRO", "2026-04-30T09:06:43Z", NOW)).toBe("EXPIRE");
    expect(effectiveSubscription("ELITE", "2026-01-01", NOW)).toBe("EXPIRE");
    expect(effectiveSubscription("STARTER", "2026-06-03T23:59:59Z", NOW)).toBe("EXPIRE");
  });

  it("premium SANS date d'expiration (null) → conservé (grant à vie / offert)", () => {
    expect(effectiveSubscription("PRO", null, NOW)).toBe("PRO");
    expect(effectiveSubscription("ELITE", undefined, NOW)).toBe("ELITE");
  });

  it("borne exacte : date == now → considéré expiré", () => {
    expect(effectiveSubscription("PRO", NOW, NOW)).toBe("EXPIRE");
  });
});
