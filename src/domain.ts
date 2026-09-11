export interface Category {
  id: number;
  slug: string;
  name: string;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  categoryId: number;
  createdAt: string;
}

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface CartRecord {
  id: number;
  sessionId: string;
}

export interface CartItemRecord {
  id: number;
  cartId: number;
  productId: number;
  quantity: number;
}

export type OrderStatus = "PENDING" | "PAID" | "CANCELED" | "EXPIRED";

export interface OrderRecord {
  id: number;
  userId: number | null;
  sessionId: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  stripeSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
}
