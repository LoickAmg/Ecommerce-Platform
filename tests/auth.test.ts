import { describe, expect, it } from "vitest";
import { getSession, insertSession } from "../src/db/sessions.js";
import { EmailAlreadyUsedError, InvalidCredentialsError } from "../src/errors.js";
import { login, register } from "../src/services/auth.js";
import { createTestDb } from "./helpers.js";

function futureIso(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

describe("auth service", () => {
  it("crée un utilisateur avec un mot de passe hashé (jamais en clair)", () => {
    const db = createTestDb();
    const user = register(db, "alice@example.com", "correct horse battery staple");
    expect(user.email).toBe("alice@example.com");
    expect(user.passwordHash).not.toContain("correct horse battery staple");
    expect(user.passwordHash.length).toBeGreaterThan(20);
  });

  it("refuse un email déjà utilisé", () => {
    const db = createTestDb();
    register(db, "alice@example.com", "password123");
    expect(() => register(db, "alice@example.com", "autrepassword")).toThrow(
      EmailAlreadyUsedError
    );
  });

  it("connecte et lie l'utilisateur à la session courante", () => {
    const db = createTestDb();
    const user = register(db, "alice@example.com", "password123");
    insertSession(db, "sess-1", futureIso());

    const loggedIn = login(db, "sess-1", "alice@example.com", "password123");
    expect(loggedIn.id).toBe(user.id);
    expect(getSession(db, "sess-1")?.userId).toBe(user.id);
  });

  it("refuse un mauvais mot de passe", () => {
    const db = createTestDb();
    register(db, "alice@example.com", "password123");
    insertSession(db, "sess-1", futureIso());
    expect(() => login(db, "sess-1", "alice@example.com", "mauvais-mdp")).toThrow(
      InvalidCredentialsError
    );
  });

  it("refuse un email inconnu avec le même message qu'un mauvais mot de passe", () => {
    const db = createTestDb();
    insertSession(db, "sess-1", futureIso());
    expect(() => login(db, "sess-1", "inconnu@example.com", "peu-importe")).toThrow(
      InvalidCredentialsError
    );
  });
});
