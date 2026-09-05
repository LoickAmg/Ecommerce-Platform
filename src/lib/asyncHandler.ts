import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 n'intercepte pas automatiquement les rejets de Promise dans
 * les handlers `async`. Ce wrapper les transmet à `next(err)`, pour
 * qu'ils finissent dans `errorHandler` comme n'importe quelle erreur
 * synchrone.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
