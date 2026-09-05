// Déclaration d'ambiance minimale pour `node:sqlite`.
//
// `node:sqlite` est un module intégré à Node.js (stable depuis Node 22.5,
// marqué "expérimental" dans les avertissements runtime) — choisi
// délibérément pour ce projet afin de ne dépendre d'AUCUN binaire natif
// téléchargé à l'installation (contrairement à `better-sqlite3` ou au
// moteur de requête de Prisma, qui vont chercher un binaire précompilé sur
// un registre externe). Les typages officiels de `@types/node` pour ce
// module sont encore jeunes et varient selon les versions ; cette
// déclaration ne couvre que la surface d'API réellement utilisée par ce
// projet, pour rester robuste indépendamment de la version de
// `@types/node` installée.
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number;
  }

  export interface StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
