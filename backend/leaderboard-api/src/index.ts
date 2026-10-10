import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import cors from "cors";
import express from "express";
import { PORT } from "./db";
import { ipRateLimiter } from "./rateLimiter";
import { leaderboardRouter } from "./routes/leaderboard";
import { agentsRouter } from "./routes/agents";
import { arenaRouter } from "./routes/arena";
import { copySubscriptionsRouter } from "./routes/copySubscriptions";
import { statsRouter } from "./routes/stats";

const app = express();

// Trust reverse proxy headers (e.g. Vercel, Railway, Cloudflare) for accurate rate limiting
app.set("trust proxy", 1);

// Limit global request rate: 100 requests per minute per IP
app.use(ipRateLimiter(60 * 1000, 100));

// EnterArenaModal.tsx (arena mode, 2026-08-02) is the first browser-side
// (not Server Component) consumer of this API — every prior fetch ran
// server-to-server inside Next.js, which isn't subject to CORS. Permissive
// here is fine: every mutating route is gated by a real wallet signature,
// not cookies/session state, so an open origin doesn't add any actual
// write capability an attacker didn't already have by calling the API
// directly.
app.use(cors());

// Limit JSON payload size to 10kb to prevent server crash from massive payloads
app.use(express.json({ limit: "10kb" }));

app.use(leaderboardRouter);
app.use(agentsRouter);
app.use(arenaRouter);
app.use(copySubscriptionsRouter);
app.use(statsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

app.listen(PORT, () => {
  console.log(`leaderboard-api listening on :${PORT}`);
});
