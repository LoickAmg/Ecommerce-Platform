import { describe, expect, it } from "vitest";
import { decrementStockIfAvailable, getProductById } from "../src/db/products.js";
import { EmptyCartError, InsufficientStockError } from "../src/errors.js";
import { addToCart } from "../src/services/cart.js";
import {
  attachStripeSession,
  createOrderFromCart,
  findOrderByStripeSessionId,
  markOrderExpired,
  markOrderPaid,
} from "../src/services/orders.js";
import { createTestDb, seedProduct, seedSession } from "./helpers.js";

describe("createOrderFromCart", () => {
  it("rejette un panier vide", () => {
    const db = createTestDb();
    seedSession(db, "session-1");
    expect(() => createOrderFromCart(db, "session-1", null)).toThrow(EmptyCartError);
  });

  it("décrémente le stock et crée la commande avec le bon total", () => {
    const db = createTestDb();
    seedSession(db, "session-1");
    const product = seedProduct(db, { stock: 5, priceCents: 1000 });
    addToCart(db, "session-1", product.id, 2);

    const order = createOrderFromCart(db, "session-1", null);

    expect(order.status).toBe("PENDING");
    expect(order.totalCents).toBe(2000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ productId: product.id, quantity: 2, unitPriceCents: 1000 });
    expect(getProductById(db, product.id)?.stock).toBe(3);
  });

  it("vide le panier après création de la commande", () => {
    const db = createTestDb();
    seedSession(db, "session-1");
    const product = seedProduct(db, { stock: 5 });
    addToCart(db, "session-1", product.id, 1);
    createOrderFromCart(db, "session-1", null);
    expect(() => createOrderFromCart(db, "session-1", null)).toThrow(EmptyCartError);
  });

  it("annule tout (rollback) si une seule ligne manque de stock", () => {
    const db = createTestDb();
    seedSession(db, "session-1");
    const productA = seedProduct(db, { stock: 5 });
    const productB = seedProduct(db, { stock: 1 });
    addToCart(db, "session-1", productA.id, 2);
    addToCart(db, "session-1", productB.id, 1);

    // Un autre client achète le dernier exemplaire de productB entre-temps.
    expect(decrementStockIfAvailable(db, productB.id, 1)).toBe(true);

    expect(() => createOrderFromCart(db, "session-1", null)).toThrow(InsufficientStockError);
    // Le rollback doit annuler le décrément déjà appliqué à productA.
    expect(getProductById(db, productA.id)?.stock).toBe(5);
  });

  it("ne survend jamais sous contention (stock=1, deux commandes concurrentes)", async () => {
    const db = createTestDb();
    seedSession(db, "session-a");
    seedSession(db, "session-b");
    const product = seedProduct(db, { stock: 1 });
    addToCart(db, "session-a", product.id, 1);
    addToCart(db, "session-b", product.id, 1);

    const results = await Promise.allSettled([
      Promise.resolve().then(() => createOrderFromCart(db, "session-a", null)),
      Promise.resolve().then(() => createOrderFromCart(db, "session-b", null)),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);
    expect(getProductById(db, product.id)?.stock).toBe(0);
  });
});

describe("markOrderPaid / markOrderExpired", () => {
  it("marque PAID et est idempotent", () => {
    const db = createTestDb();
    seedSession(db, "s");
    const product = seedProduct(db, { stock: 5 });
    addToCart(db, "s", product.id, 1);
    const order = createOrderFromCart(db, "s", null);

    expect(markOrderPaid(db, order.id)).toBe(true);
    expect(markOrderPaid(db, order.id)).toBe(false); // déjà PAID, second appel sans effet
  });

  it("marque EXPIRED et restocke, de façon idempotente", () => {
    const db = createTestDb();
    seedSession(db, "s");
    const product = seedProduct(db, { stock: 5 });
    addToCart(db, "s", product.id, 2);
    const order = createOrderFromCart(db, "s", null);
    expect(getProductById(db, product.id)?.stock).toBe(3);

    expect(markOrderExpired(db, order.id)).toBe(true);
    expect(getProductById(db, product.id)?.stock).toBe(5);

    expect(markOrderExpired(db, order.id)).toBe(false); // idempotent, pas de double restock
    expect(getProductById(db, product.id)?.stock).toBe(5);
  });

  it("ne restocke jamais une commande déjà payée", () => {
    const db = createTestDb();
    seedSession(db, "s");
    const product = seedProduct(db, { stock: 5 });
    addToCart(db, "s", product.id, 2);
    const order = createOrderFromCart(db, "s", null);
    markOrderPaid(db, order.id);

    expect(markOrderExpired(db, order.id)).toBe(false);
    expect(getProductById(db, product.id)?.stock).toBe(3);
  });
});

describe("attachStripeSession / findOrderByStripeSessionId", () => {
  it("retrouve une commande par son id de session Stripe", () => {
    const db = createTestDb();
    seedSession(db, "s");
    const product = seedProduct(db, { stock: 5 });
    addToCart(db, "s", product.id, 1);
    const order = createOrderFromCart(db, "s", null);

    attachStripeSession(db, order.id, "cs_test_123");
    const found = findOrderByStripeSessionId(db, "cs_test_123");
    expect(found?.id).toBe(order.id);
  });

  it("renvoie undefined pour un id de session Stripe inconnu", () => {
    const db = createTestDb();
    expect(findOrderByStripeSessionId(db, "cs_inconnu")).toBeUndefined();
  });
});
