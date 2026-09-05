import { describe, expect, it } from "vitest";
import { InvalidWebhookSignatureError } from "../src/errors.js";
import { FakePaymentProvider } from "../src/services/payment/index.js";

describe("FakePaymentProvider", () => {
  it("crée une session de paiement factice, sans réseau", async () => {
    const provider = new FakePaymentProvider("secret");
    const session = await provider.createCheckoutSession(
      { id: 42, totalCents: 1000, currency: "eur", items: [] },
      "https://example.test/success",
      "https://example.test/cancel"
    );
    expect(session.id).toBe("fake_cs_42");
    expect(session.url).toContain("https://example.test/success");
  });

  it("accepte un webhook correctement signé", () => {
    const provider = new FakePaymentProvider("secret");
    const payload = JSON.stringify({ type: "checkout.session.completed", orderId: 7 });
    const signature = provider.signPayload(payload);

    const event = provider.constructWebhookEvent(payload, signature);
    expect(event).toEqual({ type: "checkout.session.completed", orderId: 7 });
  });

  it("rejette une signature incorrecte", () => {
    const provider = new FakePaymentProvider("secret");
    const payload = JSON.stringify({ type: "checkout.session.completed", orderId: 7 });
    expect(() => provider.constructWebhookEvent(payload, "signature-invalide")).toThrow(
      InvalidWebhookSignatureError
    );
  });

  it("rejette un payload altéré après signature (contrôle d'intégrité)", () => {
    const provider = new FakePaymentProvider("secret");
    const payload = JSON.stringify({ type: "checkout.session.completed", orderId: 7 });
    const signature = provider.signPayload(payload);
    const tampered = JSON.stringify({ type: "checkout.session.completed", orderId: 999 });

    expect(() => provider.constructWebhookEvent(tampered, signature)).toThrow(
      InvalidWebhookSignatureError
    );
  });

  it("rejette une signature produite avec un secret différent", () => {
    const providerA = new FakePaymentProvider("secret-a");
    const providerB = new FakePaymentProvider("secret-b");
    const payload = JSON.stringify({ type: "checkout.session.completed", orderId: 7 });
    const signature = providerA.signPayload(payload);

    expect(() => providerB.constructWebhookEvent(payload, signature)).toThrow(
      InvalidWebhookSignatureError
    );
  });
});
