import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Limiteur de débit en mémoire, à fenêtre fixe, sans dépendance externe
 * (cohérent avec le choix du projet de n'utiliser que `node:sqlite` et des
 * paquets minimes — voir le commentaire en tête de `db/schema.ts`).
 *
 * Clé par défaut : `req.ip`. C'est volontairement grossier (un attaquant
 * derrière le même NAT/proxy partage le même compteur que des utilisateurs
 * légitimes, et un attaquant multi-IP contourne la limite) mais couvre le
 * cas visé ici : ralentir le brute-force de mot de passe et le spam
 * d'inscriptions depuis une seule machine. Documenté comme limite connue
 * plutôt que présenté comme une protection complète.
 *
 * État en mémoire du process : ne survit pas à un redémarrage et n'est pas
 * partagé entre plusieurs workers — acceptable pour ce projet mono-process
 * (voir la même limite déjà documentée pour la concurrence panier/stock
 * dans `services/orders.ts`).
 */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}): RequestHandler {
  const { windowMs, max, keyFn = (req) => req.ip ?? "unknown", message } = opts;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: message ?? "trop de tentatives, réessayez plus tard",
      });
      return;
    }

    next();
  };
}
