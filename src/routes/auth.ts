import { Router } from "express";
import type { AppDeps } from "../deps.js";
import { login, register } from "../services/auth.js";

export function createAuthRouter(deps: AppDeps): Router {
  const router = Router();

  router.post("/register", (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "email et password (>= 8 caractères) sont requis" });
      return;
    }
    const user = register(deps.db, email, password);
    res.status(201).json({ id: user.id, email: user.email });
  });

  router.post("/login", (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email et password sont requis" });
      return;
    }
    const user = login(deps.db, req.sessionId, email, password);
    req.userId = user.id;
    res.json({ id: user.id, email: user.email });
  });

  return router;
}
