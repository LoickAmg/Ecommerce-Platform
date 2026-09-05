import type { DatabaseSync } from "node:sqlite";
import { listCategories } from "../db/categories.js";
import { getProductBySlug, listProducts } from "../db/products.js";
import { ProductNotFoundError } from "../errors.js";
import type { Category, Product } from "../domain.js";

export interface Catalog {
  categories: Category[];
  products: Product[];
}

export function getCatalog(db: DatabaseSync, categorySlug?: string): Catalog {
  return { categories: listCategories(db), products: listProducts(db, categorySlug) };
}

export function getProductOrThrow(db: DatabaseSync, slug: string): Product {
  const product = getProductBySlug(db, slug);
  if (!product) throw new ProductNotFoundError(slug);
  return product;
}
