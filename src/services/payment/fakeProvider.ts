import crypto from "node:crypto";
import { InvalidWebhookSignatureError } from "../../errors.js";
import type {
  CheckoutSessionResult,
  OrderForCheckout,
  PaymentEvent,
  PaymentProvider,
} from "./types.js";

/**
 * Double de test déterministe, sans réseau ni dépendance au SDK Stripe.
 * Reproduit un vrai schéma de signature HMAC-SHA256 (dans l'esprit de ce
 * que fait Stripe) pour que les tests vérifient une vraie propriété de
 * sécurité — payload altéré ou signature incorrecte => rejeté — plutôt
 * qu'un chemin heureux artificiel qui ne prouverait rien.
 */
export class FakePaymentProvider implements PaymentProvider {
  constructor(private readonly webhookSecret: string) {}

  async createCheckoutSession(
    order: OrderForCheckout,
    successUrl: string,
    _cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    const id = `fake_cs_${order.id}`;
    return { id, url: `${successUrl}?fake_session=${id}` };
  }

  /** Utilitaire pour les tests : signe un payload comme le ferait le webhook. */
  signPayload(rawBody: string): string {
    return crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
  }

  constructWebhookEvent(rawBody: string, signature: string): PaymentEvent {
    const expected = this.signPayload(rawBody);
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new InvalidWebhookSignatureError();
    }
    const data = JSON.parse(rawBody) as { type: PaymentEvent["type"]; orderId: number };
    return { type: data.type, orderId: data.orderId };
  }
}
