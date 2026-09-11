import type { DatabaseSync } from "node:sqlite";
import type { OrderItemRecord, OrderRecord, OrderStatus } from "../domain.js";

function mapOrderRow(row: Record<string, unknown>): OrderRecord {
  return {
    id: row.id as number,
    userId: (row.user_id as number | null) ?? null,
    sessionId: row.session_id as string,
    status: row.status as OrderStatus,
    totalCents: row.total_cents as number,
    currency: row.currency as string,
    stripeSessionId: (row.stripe_session_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapItemRow(row: Record<string, unknown>): OrderItemRecord {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    productId: row.product_id as number,
    quantity: row.quantity as number,
    unitPriceCents: row.unit_price_cents as number,
  };
}

export function getOrderById(db: DatabaseSync, id: number): OrderRecord | undefined {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return row ? mapOrderRow(row) : undefined;
}

export function getOrderByStripeSessionId(
  db: DatabaseSync,
  stripeSessionId: string
): OrderRecord | undefined {
  const row = db.prepare("SELECT * FROM orders WHERE stripe_session_id = ?").get(stripeSessionId);
  return row ? mapOrderRow(row) : undefined;
}

export function getOrderItems(db: DatabaseSync, orderId: number): OrderItemRecord[] {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(orderId)
    .map(mapItemRow);
}

export function insertOrder(
  db: DatabaseSync,
  input: { userId: number | null; sessionId: string; totalCents: number; currency: string }
): OrderRecord {
  const result = db
    .prepare(
      "INSERT INTO orders (user_id, session_id, total_cents, currency) VALUES (?, ?, ?, ?)"
    )
    .run(input.userId, input.sessionId, input.totalCents, input.currency);
  const created = getOrderById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("échec de création de la commande (introuvable après insertion)");
  return created;
}

export function insertOrderItem(
  db: DatabaseSync,
  input: { orderId: number; productId: number; quantity: number; unitPriceCents: number }
): void {
  db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
     VALUES (?, ?, ?, ?)`
  ).run(input.orderId, input.productId, input.quantity, input.unitPriceCents);
}

export function setOrderStripeSessionId(
  db: DatabaseSync,
  orderId: number,
  stripeSessionId: string
): void {
  db.prepare(
    `UPDATE orders SET stripe_session_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).run(stripeSessionId, orderId);
}

/**
 * Met à jour le statut UNIQUEMENT si la commande est actuellement dans
 * `fromStatus` (ex: `PENDING`) — rend les handlers de webhook idempotents :
 * un événement Stripe reçu deux fois ne redécrémente/re-restocke rien la
 * seconde fois, `changes` vaudra simplement 0.
 */
export function setOrderStatus(
  db: DatabaseSync,
  orderId: number,
  toStatus: OrderStatus,
  fromStatus: OrderStatus
): boolean {
  const result = db
    .prepare(
      `UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = ?`
    )
    .run(toStatus, orderId, fromStatus);
  return result.changes === 1;
}
