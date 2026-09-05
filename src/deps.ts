import type { DatabaseSync } from "node:sqlite";
import type { PaymentProvider } from "./services/payment/index.js";

export interface AppDeps {
  db: DatabaseSync;
  paymentProvider: PaymentProvider;
  /** Utilisé pour construire les URLs de succès/annulation Stripe. */
  baseUrl?: string;
}
