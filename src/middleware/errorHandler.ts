import type { ErrorRequestHandler } from "express";
import {
  EmailAlreadyUsedError,
  EmptyCartError,
  InsufficientStockError,
  InvalidCredentialsError,
  InvalidWebhookSignatureError,
  OrderNotFoundError,
  ProductNotFoundError,
} from "../errors.js";

const STATUS_BY_ERROR: [new (...args: never[]) => Error, number][] = [
  [ProductNotFoundError, 404],
  [OrderNotFoundError, 404],
  [EmptyCartError, 400],
  [InsufficientStockError, 409],
  [EmailAlreadyUsedError, 409],
  [InvalidCredentialsError, 401],
  [InvalidWebhookSignatureError, 400],
];

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  for (const [ErrorClass, status] of STATUS_BY_ERROR) {
    if (err instanceof ErrorClass) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
  }
  if (err instanceof RangeError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "erreur interne" });
};
