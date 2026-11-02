import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

// Express 5 forwards rejected async handlers here automatically
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }

  const mongoErr = err as { code?: number; keyPattern?: Record<string, number> };
  if (mongoErr?.code === 11000) {
    const field = Object.keys(mongoErr.keyPattern ?? {}).filter((k) => k !== "tenantId")[0] ?? "value";
    return res.status(409).json({ message: `A record with this ${field} already exists`, code: "DUPLICATE" });
  }

  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}
