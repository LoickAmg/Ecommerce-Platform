import { createApp } from "./app.js";
import { createDatabase } from "./db/index.js";
import { StripePaymentProvider } from "./services/payment/index.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_URL ?? "./dev.db";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey || !stripeWebhookSecret) {
  throw new Error(
    "STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET sont requis (voir .env.example). " +
      "Utilisez des clés de TEST Stripe (sk_test_.../whsec_...) : ce projet n'a subi aucune " +
      "revue de sécurité et ne doit jamais tourner avec une clé sk_live_..."
  );
}

const db = createDatabase(dbPath);
const paymentProvider = new StripePaymentProvider(stripeSecretKey, stripeWebhookSecret);
const app = createApp({
  db,
  paymentProvider,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
});

app.listen(port, () => {
  console.log(`ecommerce-platform à l'écoute sur http://localhost:${port}`);
});
