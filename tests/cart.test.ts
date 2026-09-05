import { describe, expect, it } from "vitest";
import { InsufficientStockError, ProductNotFoundError } from "../src/errors.js";
import { addToCart, getCart, removeFromCart, updateCartItemQuantity } from "../src/services/cart.js";
import { createTestDb, seedProduct, seedSession } from "./helpers.js";

describe("cart service", () => {
  it("panier vide par défaut", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const cart = getCart(db, "s1");
    expect(cart.lines).toEqual([]);
    expect(cart.totalCents).toBe(0);
  });

  it("ajoute un produit et calcule le total", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { priceCents: 500, stock: 10 });
    const cart = addToCart(db, "s1", product.id, 3);
    expect(cart.lines).toHaveLength(1);
    expect(cart.totalCents).toBe(1500);
  });

  it("cumule la quantité si le produit est déjà dans le panier", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 10 });
    addToCart(db, "s1", product.id, 2);
    const cart = addToCart(db, "s1", product.id, 3);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(5);
  });

  it("refuse d'ajouter plus que le stock disponible", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 2 });
    expect(() => addToCart(db, "s1", product.id, 3)).toThrow(InsufficientStockError);
  });

  it("refuse d'ajouter plus que le stock disponible même en cumulant", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 2 });
    addToCart(db, "s1", product.id, 2);
    expect(() => addToCart(db, "s1", product.id, 1)).toThrow(InsufficientStockError);
  });

  it("refuse un produit inconnu", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    expect(() => addToCart(db, "s1", 9999, 1)).toThrow(ProductNotFoundError);
  });

  it("rejette une quantité non entière ou < 1 à l'ajout", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 10 });
    expect(() => addToCart(db, "s1", product.id, 0)).toThrow(RangeError);
    expect(() => addToCart(db, "s1", product.id, 1.5)).toThrow(RangeError);
    expect(() => addToCart(db, "s1", product.id, -1)).toThrow(RangeError);
  });

  it("met à jour la quantité, retire la ligne si <= 0", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 10 });
    addToCart(db, "s1", product.id, 4);

    let cart = updateCartItemQuantity(db, "s1", product.id, 2);
    expect(cart.lines[0].quantity).toBe(2);

    cart = updateCartItemQuantity(db, "s1", product.id, 0);
    expect(cart.lines).toHaveLength(0);
  });

  it("refuse une mise à jour au-delà du stock", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 3 });
    addToCart(db, "s1", product.id, 1);
    expect(() => updateCartItemQuantity(db, "s1", product.id, 10)).toThrow(InsufficientStockError);
  });

  it("retire une ligne explicitement", () => {
    const db = createTestDb();
    seedSession(db, "s1");
    const product = seedProduct(db, { stock: 10 });
    addToCart(db, "s1", product.id, 1);
    const cart = removeFromCart(db, "s1", product.id);
    expect(cart.lines).toHaveLength(0);
  });

  it("isole les paniers par session", () => {
    const db = createTestDb();
    seedSession(db, "session-a");
    seedSession(db, "session-b");
    const product = seedProduct(db, { stock: 10 });
    addToCart(db, "session-a", product.id, 1);
    const cartB = getCart(db, "session-b");
    expect(cartB.lines).toHaveLength(0);
  });
});
