import { Router } from "express";
import type { AppDeps } from "../deps.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { login, register } from "../services/auth.js";

// Format volontairement simple (pas de RFC 5322 complet) : on veut rejeter
// les saisies manifestement invalides ("pas un email"), pas valider une
// adresse comme le ferait un envoi réel — cette dernière vérification ne
// peut de toute façon se faire qu'en envoyant un email de confirmation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAuthRouter(deps: AppDeps): Router {
  const router = Router();

  // Un limiteur par instance de routeur (donc par instance d'app), pas un
  // singleton au niveau du module : sinon son état (Map en mémoire) serait
  // partagé entre toutes les apps créées dans le même process — ce qui
  // casserait l'isolation des tests (`createTestApp()` doit démarrer avec
  // un compteur à zéro à chaque appel) et, plus généralement, entre
  // plusieurs instances logiques tournant dans le même process.
  //
  // Fenêtres généreuses : l'objectif est de ralentir un brute-force
  // automatisé, pas de gêner un utilisateur qui se trompe deux fois de mot
  // de passe. Voir les limites documentées dans `middleware/rateLimit.ts`
  // (clé par IP : imparfait derrière un NAT/proxy partagé ou face à un
  // attaquant multi-IP, mais c'est la référence minimale standard).
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "trop de tentatives de connexion, réessayez plus tard",
  });
  const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "trop d'inscriptions depuis cette adresse, réessayez plus tard",
  });

  router.post("/register", registerLimiter, (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length < 8 ||
      !EMAIL_RE.test(email)
    ) {
      res
        .status(400)
        .json({ error: "email valide et password (>= 8 caractères) sont requis" });
      return;
    }
    const user = register(deps.db, email, password);
    res.status(201).json({ id: user.id, email: user.email });
  });

  router.post("/login", loginLimiter, (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "email valide et password sont requis" });
      return;
    }
    const user = login(deps.db, req.sessionId, email, password);
    req.userId = user.id;
    res.json({ id: user.id, email: user.email });
  });

  return router;
}
