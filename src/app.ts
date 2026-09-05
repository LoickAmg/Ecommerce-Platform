import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import type { AppDeps } from "./deps.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCartRouter } from "./routes/cart.js";
import { createCheckoutRouter } from "./routes/checkout.js";
import { createProductsRouter } from "./routes/products.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { ensureSession } from "./services/session.js";

const SESSION_COOKIE = "sid";

/** Factory injectable (db + fournisseur de paiement) — testable sans serveur réel. */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const baseUrl = deps.baseUrl ?? "http://localhost:3000";

  app.use(cookieParser());

  // Monté AVANT express.json() : le webhook Stripe a besoin du corps brut
  // pour vérifier sa signature (voir routes/webhooks.ts).
  app.use("/webhooks", createWebhookRouter(deps));

  app.use(express.json());

  app.use((req, res, next) => {
    const existingId = req.cookies[SESSION_COOKIE] as string | undefined;
    const session = ensureSession(deps.db, existingId);
    if (session.id !== existingId) {
      res.cookie(SESSION_COOKIE, session.id, {
        httpOnly: true,
        sameSite: "lax",
        expires: new Date(session.expiresAt),
      });
    }
    req.sessionId = session.id;
    req.userId = session.userId;
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/products", createProductsRouter(deps));
  app.use("/cart", createCartRouter(deps));
  app.use("/auth", createAuthRouter(deps));
  app.use("/checkout", createCheckoutRouter(deps, baseUrl));

  app.use(errorHandler);

  return app;
}
