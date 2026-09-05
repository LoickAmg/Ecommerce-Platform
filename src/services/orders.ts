import type { DatabaseSync } from "node:sqlite";
import { clearCart, getCartItems, getOrCreateCart } from "../db/carts.js";
import {
  getOrderById,
  getOrderByStripeSessionId,
  getOrderItems,
  insertOrder,
  insertOrderItem,
  setOrderStatus,
  setOrderStripeSessionId,
} from "../db/orders.js";
import { decrementStockIfAvailable, getProductById, restockProduct } from "../db/products.js";
import {
  EmptyCartError,
  InsufficientStockError,
  OrderNotFoundError,
  ProductNotFoundError,
} from "../errors.js";
import type { OrderItemRecord, OrderRecord } from "../domain.js";

export interface OrderView extends OrderRecord {
  items: OrderItemRecord[];
}

function toView(db: DatabaseSync, order: OrderRecord): OrderView {
  return { ...order, items: getOrderItems(db, order.id) };
}

/**
 * Crée une commande à partir du panier de la session : décrémente le
 * stock de chaque ligne de façon atomique (`decrementStockIfAvailable`),
 * dans une transaction SQL — si une seule ligne échoue par manque de
 * stock, tout est annulé (`ROLLBACK`), y compris les décréments déjà
 * appliqués aux lignes précédentes de la même commande.
 *
 * `node:sqlite` étant synchrone, cette fonction s'exécute entièrement
 * sans jamais rendre la main à la boucle d'événements : dans un même
 * processus Node, deux appels concurrents (ex. deux requêtes HTTP
 * simultanées) ne peuvent donc jamais s'entrelacer — garantie anti-survente
 * vérifiée par un vrai test de concurrence dans tests/orders.test.ts (voir
 * aussi la limite correspondante dans le README : cette propriété ne tient
 * qu'à l'intérieur d'un seul processus, pas entre plusieurs workers).
 */
export function createOrderFromCart(
  db: DatabaseSync,
  sessionId: string,
  userId: number | null
): OrderView {
  const cart = getOrCreateCart(db, sessionId);
  const items = getCartItems(db, cart.id);
  if (items.length === 0) throw new EmptyCartError();

  db.exec("BEGIN IMMEDIATE");
  try {
    let totalCents = 0;
    const orderItemsInput: { productId: number; quantity: number; unitPriceCents: number }[] = [];

    for (const item of items) {
      const product = getProductById(db, item.productId);
      if (!product) throw new ProductNotFoundError(item.productId);

      if (!decrementStockIfAvailable(db, item.productId, item.quantity)) {
        throw new InsufficientStockError(item.productId);
      }

      totalCents += product.priceCents * item.quantity;
      orderItemsInput.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
      });
    }

    const order = insertOrder(db, { userId, totalCents, currency: "eur" });
    for (const input of orderItemsInput) {
      insertOrderItem(db, { orderId: order.id, ...input });
    }
    clearCart(db, cart.id);

    db.exec("COMMIT");
    return toView(db, order);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getOrder(db: DatabaseSync, orderId: number): OrderView {
  const order = getOrderById(db, orderId);
  if (!order) throw new OrderNotFoundError(orderId);
  return toView(db, order);
}

export function attachStripeSession(
  db: DatabaseSync,
  orderId: number,
  stripeSessionId: string
): void {
  setOrderStripeSessionId(db, orderId, stripeSessionId);
}

/** Idempotent : ne fait rien (renvoie false) si la commande n'était pas PENDING. */
export function markOrderPaid(db: DatabaseSync, orderId: number): boolean {
  return setOrderStatus(db, orderId, "PAID", "PENDING");
}

/** Idempotent, et restocke les produits — la commande n'a jamais été payée. */
export function markOrderExpired(db: DatabaseSync, orderId: number): boolean {
  const changed = setOrderStatus(db, orderId, "EXPIRED", "PENDING");
  if (changed) {
    for (const item of getOrderItems(db, orderId)) {
      restockProduct(db, item.productId, item.quantity);
    }
  }
  return changed;
}

export function findOrderByStripeSessionId(
  db: DatabaseSync,
  stripeSessionId: string
): OrderView | undefined {
  const order = getOrderByStripeSessionId(db, stripeSessionId);
  return order ? toView(db, order) : undefined;
}
