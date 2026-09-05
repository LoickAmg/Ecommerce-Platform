import type { DatabaseSync } from "node:sqlite";
import type { Product } from "../domain.js";

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    stock: row.stock as number,
    categoryId: row.category_id as number,
    createdAt: row.created_at as string,
  };
}

export function listProducts(db: DatabaseSync, categorySlug?: string): Product[] {
  if (categorySlug) {
    const rows = db
      .prepare(
        `SELECT p.* FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE c.slug = ?
         ORDER BY p.id`
      )
      .all(categorySlug);
    return rows.map(mapRow);
  }
  return db.prepare("SELECT * FROM products ORDER BY id").all().map(mapRow);
}

export function getProductBySlug(db: DatabaseSync, slug: string): Product | undefined {
  const row = db.prepare("SELECT * FROM products WHERE slug = ?").get(slug);
  return row ? mapRow(row) : undefined;
}

export function getProductById(db: DatabaseSync, id: number): Product | undefined {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return row ? mapRow(row) : undefined;
}

export interface NewProduct {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency?: string;
  stock: number;
  categoryId: number;
}

export function insertProduct(db: DatabaseSync, input: NewProduct): Product {
  const result = db
    .prepare(
      `INSERT INTO products (slug, name, description, price_cents, currency, stock, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.slug,
      input.name,
      input.description,
      input.priceCents,
      input.currency ?? "eur",
      input.stock,
      input.categoryId
    );
  const created = getProductById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("échec de création du produit (introuvable après insertion)");
  return created;
}

/**
 * Décrémente le stock UNIQUEMENT si suffisamment disponible, en une seule
 * requête SQL atomique (`UPDATE ... WHERE stock >= ?`). C'est le mécanisme
 * central anti-survente : `changes === 1` si et seulement si le stock a pu
 * être décrémenté sans passer en négatif. Combiné à `node:sqlite` qui est
 * synchrone, deux appels concurrents à cette fonction dans le même
 * processus Node ne peuvent jamais s'entrelacer — voir README.
 */
export function decrementStockIfAvailable(
  db: DatabaseSync,
  productId: number,
  quantity: number
): boolean {
  const result = db
    .prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?")
    .run(quantity, productId, quantity);
  return result.changes === 1;
}

export function restockProduct(db: DatabaseSync, productId: number, quantity: number): void {
  db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(quantity, productId);
}
