import type { DatabaseSync } from "node:sqlite";
import type { CartItemRecord, CartRecord } from "../domain.js";

function mapCartRow(row: Record<string, unknown>): CartRecord {
  return { id: row.id as number, sessionId: row.session_id as string };
}

function mapItemRow(row: Record<string, unknown>): CartItemRecord {
  return {
    id: row.id as number,
    cartId: row.cart_id as number,
    productId: row.product_id as number,
    quantity: row.quantity as number,
  };
}

export function getOrCreateCart(db: DatabaseSync, sessionId: string): CartRecord {
  const existing = db.prepare("SELECT * FROM carts WHERE session_id = ?").get(sessionId);
  if (existing) return mapCartRow(existing);
  const result = db.prepare("INSERT INTO carts (session_id) VALUES (?)").run(sessionId);
  return { id: Number(result.lastInsertRowid), sessionId };
}

export function getCartItems(db: DatabaseSync, cartId: number): CartItemRecord[] {
  return db
    .prepare("SELECT * FROM cart_items WHERE cart_id = ? ORDER BY id")
    .all(cartId)
    .map(mapItemRow);
}

export function getCartItem(
  db: DatabaseSync,
  cartId: number,
  productId: number
): CartItemRecord | undefined {
  const row = db
    .prepare("SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?")
    .get(cartId, productId);
  return row ? mapItemRow(row) : undefined;
}

/** Remplace la quantité d'une ligne de panier (crée la ligne si absente). */
export function setCartItemQuantity(
  db: DatabaseSync,
  cartId: number,
  productId: number,
  quantity: number
): void {
  db.prepare(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES (?, ?, ?)
     ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = excluded.quantity`
  ).run(cartId, productId, quantity);
}

export function removeCartItem(db: DatabaseSync, cartId: number, productId: number): void {
  db.prepare("DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?").run(
    cartId,
    productId
  );
}

export function clearCart(db: DatabaseSync, cartId: number): void {
  db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cartId);
}
