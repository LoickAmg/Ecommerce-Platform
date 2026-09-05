// Augmente `express.Request` avec les champs posés par le middleware de
// session (voir `src/app.ts`), pour que les routes y accèdent typé.
declare namespace Express {
  interface Request {
    sessionId: string;
    userId: number | null;
  }
}
