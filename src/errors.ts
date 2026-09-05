export class InsufficientStockError extends Error {
  constructor(public readonly productId: number) {
    super(`stock insuffisant pour le produit ${productId}`);
    this.name = "InsufficientStockError";
  }
}

export class EmptyCartError extends Error {
  constructor() {
    super("le panier est vide");
    this.name = "EmptyCartError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(public readonly identifier: string | number) {
    super(`produit introuvable: ${identifier}`);
    this.name = "ProductNotFoundError";
  }
}

export class EmailAlreadyUsedError extends Error {
  constructor(public readonly email: string) {
    super(`email déjà utilisé: ${email}`);
    this.name = "EmailAlreadyUsedError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("email ou mot de passe invalide");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super("signature de webhook invalide");
    this.name = "InvalidWebhookSignatureError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(public readonly identifier: string | number) {
    super(`commande introuvable: ${identifier}`);
    this.name = "OrderNotFoundError";
  }
}
