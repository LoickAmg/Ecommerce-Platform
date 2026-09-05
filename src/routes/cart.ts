import { Router } from "express";
import type { AppDeps } from "../deps.js";
import { addToCart, getCart, removeFromCart, updateCartItemQuantity } from "../services/cart.js";

export function createCartRouter(deps: AppDeps): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(getCart(deps.db, req.sessionId));
  });

  router.post("/items", (req, res) => {
    const { productId, quantity } = req.body as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "number" || typeof quantity !== "number") {
      res.status(400).json({ error: "productId et quantity (nombres) sont requis" });
      return;
    }
    res.status(201).json(addToCart(deps.db, req.sessionId, productId, quantity));
  });

  router.put("/items/:productId", (req, res) => {
    const productId = Number(req.params.productId);
    const { quantity } = req.body as { quantity?: unknown };
    if (typeof quantity !== "number") {
      res.status(400).json({ error: "quantity (nombre) est requis" });
      return;
    }
    res.json(updateCartItemQuantity(deps.db, req.sessionId, productId, quantity));
  });

  router.delete("/items/:productId", (req, res) => {
    const productId = Number(req.params.productId);
    res.json(removeFromCart(deps.db, req.sessionId, productId));
  });

  return router;
}
