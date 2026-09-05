export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export type PaymentEventType = "checkout.session.completed" | "checkout.session.expired";

export interface PaymentEvent {
  type: PaymentEventType;
  orderId: number;
}

export interface OrderForCheckout {
  id: number;
  totalCents: number;
  currency: string;
  items: { productId: number; quantity: number; unitPriceCents: number }[];
}

/**
 * Abstraction de fournisseur de paiement — même esprit que `PriceProvider`
 * dans trading-dashboard ou `FetchFn` dans digital-footprint-audit :
 * l'implémentation réelle (réseau, tiers) est injectable, et les tests
 * n'en dépendent jamais directement.
 */
export interface PaymentProvider {
  createCheckoutSession(
    order: OrderForCheckout,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult>;
  constructWebhookEvent(rawBody: string, signature: string): PaymentEvent;
}
