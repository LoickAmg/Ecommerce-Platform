import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { insertCategory } from "../src/db/categories.js";
import { createDatabase } from "../src/db/index.js";
import { insertProduct, type NewProduct } from "../src/db/products.js";
import { insertSession } from "../src/db/sessions.js";
import { FakePaymentProvider } from "../src/services/payment/index.js";

export const WEBHOOK_SECRET = "test-webhook-secret";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function createTestDb(): DatabaseSync {
  return createDatabase(":memory:");
}

/**
 * En usage réel, une Session existe toujours avant qu'on touche à un
 * panier (créée par le middleware `ensureSession` sur la toute première
 * requête HTTP). Les tests au niveau service, eux, appellent le panier
 * directement avec un id de session choisi à la main : il faut donc créer
 * la ligne `sessions` correspondante nous-mêmes, sinon la contrainte de
 * clé étrangère `carts.session_id -> sessions.id` échoue — ce qui est le
 * comportement voulu, pas un bug.
 */
export function seedSession(db: DatabaseSync, id: string) {
  return insertSession(db, id, new Date(Date.now() + 60 * 60 * 1000).toISOString());
}

export function createTestApp(db: DatabaseSync = createTestDb()) {
  const paymentProvider = new FakePaymentProvider(WEBHOOK_SECRET);
  const app = createApp({ db, paymentProvider, baseUrl: "http://localhost:3000" });
  return { app, db, paymentProvider };
}

export function seedCategory(db: DatabaseSync, slug?: string) {
  return insertCategory(db, slug ?? unique("category"), "Catégorie de test");
}

export function seedProduct(
  db: DatabaseSync,
  overrides: Partial<NewProduct> = {}
): ReturnType<typeof insertProduct> {
  const categoryId = overrides.categoryId ?? seedCategory(db).id;
  return insertProduct(db, {
    slug: overrides.slug ?? unique("product"),
    name: overrides.name ?? "Produit de test",
    description: overrides.description ?? "Description de test",
    priceCents: overrides.priceCents ?? 1000,
    currency: overrides.currency,
    stock: overrides.stock ?? 10,
    categoryId,
  });
}
