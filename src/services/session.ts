import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getSession, insertSession, isSessionExpired } from "../db/sessions.js";
import type { SessionRecord } from "../domain.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function generateSessionId(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Réutilise une session existante et valide, ou en crée une nouvelle. */
export function ensureSession(db: DatabaseSync, existingId: string | undefined): SessionRecord {
  if (existingId) {
    const session = getSession(db, existingId);
    if (session && !isSessionExpired(session)) return session;
  }
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  return insertSession(db, id, expiresAt);
}
