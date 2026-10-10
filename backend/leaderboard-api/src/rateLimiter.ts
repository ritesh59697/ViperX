import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipLimits = new Map<string, RateLimitRecord>();

// Periodically evict expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipLimits.entries()) {
    if (now > record.resetTime) {
      ipLimits.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Lightweight, memory-efficient IP rate limiter middleware.
 * @param windowMs Time window in milliseconds
 * @param maxRequests Maximum requests allowed per IP within the window
 */
export function ipRateLimiter(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const ip = Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === "string" ? rawIp.split(",")[0].trim() : "unknown";
    const now = Date.now();

    const record = ipLimits.get(ip);
    if (!record || now > record.resetTime) {
      ipLimits.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: "Too many requests from this IP, please try again later.",
      });
    }

    next();
  };
}
