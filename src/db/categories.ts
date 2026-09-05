import type { DatabaseSync } from "node:sqlite";
import type { Category } from "../domain.js";

function mapRow(row: Record<string, unknown>): Category {
  return { id: row.id as number, slug: row.slug as string, name: row.name as string };
}

export function listCategories(db: DatabaseSync): Category[] {
  return db.prepare("SELECT * FROM categories ORDER BY id").all().map(mapRow);
}

export function getCategoryBySlug(db: DatabaseSync, slug: string): Category | undefined {
  const row = db.prepare("SELECT * FROM categories WHERE slug = ?").get(slug);
  return row ? mapRow(row) : undefined;
}

export function insertCategory(db: DatabaseSync, slug: string, name: string): Category {
  const result = db.prepare("INSERT INTO categories (slug, name) VALUES (?, ?)").run(slug, name);
  return { id: Number(result.lastInsertRowid), slug, name };
}
