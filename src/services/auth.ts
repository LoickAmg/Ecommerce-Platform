import bcrypt from "bcryptjs";
import type { DatabaseSync } from "node:sqlite";
import { attachUserToSession } from "../db/sessions.js";
import { getUserByEmail, insertUser } from "../db/users.js";
import { EmailAlreadyUsedError, InvalidCredentialsError } from "../errors.js";
import type { UserRecord } from "../domain.js";

const SALT_ROUNDS = 10;

export function register(db: DatabaseSync, email: string, password: string): UserRecord {
  if (getUserByEmail(db, email)) throw new EmailAlreadyUsedError(email);
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  return insertUser(db, email, passwordHash);
}

/** Sur succès, lie l'utilisateur à la session courante (le panier suit). */
export function login(
  db: DatabaseSync,
  sessionId: string,
  email: string,
  password: string
): UserRecord {
  const user = getUserByEmail(db, email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new InvalidCredentialsError();
  }
  attachUserToSession(db, sessionId, user.id);
  return user;
}
