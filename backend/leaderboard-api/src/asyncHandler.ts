import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't await async route handlers, so a rejected promise
// (e.g. a failed pg query) becomes an unhandled rejection instead of
// reaching the error-handling middleware. Wrap every async handler with
// this so failures actually produce a 500 instead of a hung request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
