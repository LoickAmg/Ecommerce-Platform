import Stripe from "stripe";
import { InvalidWebhookSignatureError } from "../../errors.js";
import type {
  CheckoutSessionResult,
  OrderForCheckout,
  PaymentEvent,
  PaymentProvider,
} from "./types.js";

/**
 * Implémentation RÉELLE, appelant l'API Stripe — en **mode test uniquement**
 * (clé `sk_test_...`). Module isolé, jamais importé par la suite de tests
 * automatisés (voir `FakePaymentProvider`, qui vérifie la même logique de
 * vérification de signature sans réseau ni compte Stripe), au même
 * principe que `landmarks.py` dans hand-gesture-recognition ou
 * `StooqProvider` dans trading-dashboard.
 *
 * Ce projet n'a subi AUCUNE revue de sécurité/conformité (PCI-DSS, etc.) :
 * ne jamais utiliser de clé `sk_live_...` avec ce code.
 */
export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    if (secretKey.startsWith("sk_live_")) {
      throw new Error(
        "clé Stripe LIVE refusée : ce projet est un jouet pédagogique, jamais audité pour de " +
          "vrais paiements. Utilisez une clé de test (sk_test_...)."
      );
    }
    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(
    order: OrderForCheckout,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: order.currency,
          unit_amount: item.unitPriceCents,
          product_data: { name: `Produit #${item.productId}` },
        },
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orderId: String(order.id) },
    });
    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
    return { id: session.id, url: session.url };
  }

  constructWebhookEvent(rawBody: string, signature: string): PaymentEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new InvalidWebhookSignatureError();
    }

    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
      throw new Error(`type d'événement Stripe non géré: ${event.type}`);
    }
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = Number(session.metadata?.orderId);
    if (!Number.isInteger(orderId)) {
      throw new Error("métadonnée orderId manquante ou invalide sur la session Stripe");
    }
    return { type: event.type, orderId };
  }
}
