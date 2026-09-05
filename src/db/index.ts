import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { SCHEMA_SQL } from "./schema.js";

// `node:sqlite` est absent de `module.builtinModules` sur les versions de
// Node où il n'est encore que "expérimental" — Vite (utilisé par Vitest
// pour transformer les tests) ne le reconnaît donc pas comme natif et,
// pire, lui retire son préfixe `node:` avant d'essayer (en vain) de
// résoudre "sqlite" comme un paquet npm. Un `require()` obtenu via
// `createRequire` échappe complètement à l'analyse d'imports ESM de Vite
// (ce n'est qu'un appel de fonction ordinaire à ses yeux) : c'est Node qui
// résout "node:sqlite" à l'exécution, exactement comme il sait le faire.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSyncType };

/**
 * Ouvre (ou crée) une base SQLite et applique le schéma. `path` peut être
 * un fichier (`"./dev.db"`) ou `":memory:"` (utilisé par les tests : base
 * neuve, isolée, jetée à la fin du process).
 */
export function createDatabase(path: string): DatabaseSyncType {
  const db: DatabaseSyncType = new DatabaseSync(path);
  db.exec(SCHEMA_SQL);
  return db;
}
