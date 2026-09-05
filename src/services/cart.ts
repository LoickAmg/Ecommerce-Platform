import type { DatabaseSync } from "node:sqlite";
import {
  getCartItem,
  getCartItems,
  getOrCreateCart,
  removeCartItem,
  setCartItemQuantity,
} from "../db/carts.js";
import { getProductById } from "../db/products.js";
import { InsufficientStockError, ProductNotFoundError } from "../errors.js";
import type { Product } from "../domain.js";

export interface CartLine {
  productId: number;
  product: Product;
  quantity: number;
  lineTotalCents: number;
}

export interface CartView {
  sessionId: string;
  lines: CartLine[];
  totalCents: number;
}

function buildView(db: DatabaseSync, sessionId: string, cartId: number): CartView {
  const items = getCartItems(db, cartId);
  const lines: CartLine[] = items.map((item) => {
    const product = getProductById(db, item.productId);
    if (!product) throw new ProductNotFoundError(item.productId);
    return {
      productId: item.productId,
      product,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
    };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return { sessionId, lines, totalCents };
}

export function getCart(db: DatabaseSync, sessionId: string): CartView {
  const cart = getOrCreateCart(db, sessionId);
  return buildView(db, sessionId, cart.id);
}

/** Ajoute `quantity` unités d'un produit (cumulatif si déjà présent). */
export function addToCart(
  db: DatabaseSync,
  sessionId: string,
  productId: number,
  quantity: number
): CartView {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError("la quantité doit être un entier >= 1");
  }
  const product = getProductById(db, productId);
  if (!product) throw new ProductNotFoundError(productId);

  const cart = getOrCreateCart(db, sessionId);
  const existing = getCartItem(db, cart.id, productId);
  const newQuantity = (existing?.quantity ?? 0) + quantity;
  if (newQuantity > product.stock) throw new InsufficientStockError(productId);

  setCartItemQuantity(db, cart.id, productId, newQuantity);
  return buildView(db, sessionId, cart.id);
}

/** Remplace la quantité (0 ou moins retire la ligne). */
export function updateCartItemQuantity(
  db: DatabaseSync,
  sessionId: string,
  productId: number,
  quantity: number
): CartView {
  const cart = getOrCreateCart(db, sessionId);
  if (quantity <= 0) {
    removeCartItem(db, cart.id, productId);
    return buildView(db, sessionId, cart.id);
  }
  const product = getProductById(db, productId);
  if (!product) throw new ProductNotFoundError(productId);
  if (quantity > product.stock) throw new InsufficientStockError(productId);

  setCartItemQuantity(db, cart.id, productId, quantity);
  return buildView(db, sessionId, cart.id);
}

export function removeFromCart(db: DatabaseSync, sessionId: string, productId: number): CartView {
  const cart = getOrCreateCart(db, sessionId);
  removeCartItem(db, cart.id, productId);
  return buildView(db, sessionId, cart.id);
}
