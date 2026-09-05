import { Router } from "express";
import type { AppDeps } from "../deps.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { attachStripeSession, createOrderFromCart, getOrder } from "../services/orders.js";

export function createCheckoutRouter(deps: AppDeps, baseUrl: string): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const order = createOrderFromCart(deps.db, req.sessionId, req.userId);
      const checkoutSession = await deps.paymentProvider.createCheckoutSession(
        order,
        `${baseUrl}/checkout/success`,
        `${baseUrl}/checkout/cancel`
      );
      attachStripeSession(deps.db, order.id, checkoutSession.id);
      res.status(201).json({ orderId: order.id, checkoutUrl: checkoutSession.url });
    })
  );

  router.get("/orders/:id", (req, res) => {
    res.json(getOrder(deps.db, Number(req.params.id)));
  });

  return router;
}
