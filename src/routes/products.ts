import { Router } from "express";
import type { AppDeps } from "../deps.js";
import { getCatalog, getProductOrThrow } from "../services/catalog.js";

export function createProductsRouter(deps: AppDeps): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const categorySlug = typeof req.query.category === "string" ? req.query.category : undefined;
    res.json(getCatalog(deps.db, categorySlug));
  });

  router.get("/:slug", (req, res) => {
    res.json(getProductOrThrow(deps.db, req.params.slug));
  });

  return router;
}
