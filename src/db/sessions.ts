import type { DatabaseSync } from "node:sqlite";
import type { SessionRecord } from "../domain.js";

function mapRow(row: Record<string, unknown>): SessionRecord {
  return {
    id: row.id as string,
    userId: (row.user_id as number | null) ?? null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
}

export function getSession(db: DatabaseSync, id: string): SessionRecord | undefined {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
  return row ? mapRow(row) : undefined;
}

export function insertSession(db: DatabaseSync, id: string, expiresAt: string): SessionRecord {
  db.prepare("INSERT INTO sessions (id, expires_at) VALUES (?, ?)").run(id, expiresAt);
  const created = getSession(db, id);
  if (!created) throw new Error("échec de création de la session (introuvable après insertion)");
  return created;
}

export function attachUserToSession(db: DatabaseSync, sessionId: string, userId: number): void {
  db.prepare("UPDATE sessions SET user_id = ? WHERE id = ?").run(userId, sessionId);
}

export function isSessionExpired(session: SessionRecord, now: Date = new Date()): boolean {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}
