import { describe, it, expect } from "vitest";
import { buildFailureMetadata } from "./failure-metadata";

describe("buildFailureMetadata", () => {
  it("merge la metadata existante + raison/canal/statut", () => {
    const m = buildFailureMetadata(
      { plan_id: "pro" },
      { status: "failed", channel: "card", gateway_response: "Declined" },
    );
    expect(m).toMatchObject({
      plan_id: "pro",
      paystack_status: "failed",
      paystack_channel: "card",
      echec_raison: "Declined",
    });
  });

  it("repli sur le statut si pas de gateway_response", () => {
    const m = buildFailureMetadata(null, { status: "abandoned" });
    expect(m.echec_raison).toBe("abandoned");
    expect(m.paystack_channel).toBeNull();
  });
});
