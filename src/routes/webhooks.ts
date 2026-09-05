import express, { Router } from "express";
import type { AppDeps } from "../deps.js";
import { InvalidWebhookSignatureError } from "../errors.js";
import { markOrderExpired, markOrderPaid } from "../services/orders.js";

export function createWebhookRouter(deps: AppDeps): Router {
  const router = Router();

  // `express.raw` (et non `express.json`) : la vérification de signature a
  // besoin du corps EXACTEMENT tel qu'envoyé, avant toute désérialisation.
  router.post("/stripe", express.raw({ type: "application/json" }), (req, res) => {
    const signature = req.header("stripe-signature") ?? "";
    const rawBody = (req.body as Buffer).toString("utf8");

    let event;
    try {
      event = deps.paymentProvider.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (event.type === "checkout.session.completed") {
      markOrderPaid(deps.db, event.orderId);
    } else if (event.type === "checkout.session.expired") {
      markOrderExpired(deps.db, event.orderId);
    }
    res.status(200).json({ received: true });
  });

  return router;
}
