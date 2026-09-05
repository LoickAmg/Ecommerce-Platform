import type { DatabaseSync } from "node:sqlite";
import type { UserRecord } from "../domain.js";

function mapRow(row: Record<string, unknown>): UserRecord {
  return {
    id: row.id as number,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    createdAt: row.created_at as string,
  };
}

export function getUserByEmail(db: DatabaseSync, email: string): UserRecord | undefined {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  return row ? mapRow(row) : undefined;
}

export function getUserById(db: DatabaseSync, id: number): UserRecord | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? mapRow(row) : undefined;
}

export function insertUser(db: DatabaseSync, email: string, passwordHash: string): UserRecord {
  const result = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);
  const created = getUserById(db, Number(result.lastInsertRowid));
  if (!created) throw new Error("échec de création de l'utilisateur (introuvable après insertion)");
  return created;
}
