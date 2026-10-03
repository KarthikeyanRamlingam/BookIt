import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { handleStripeWebhook } from "./controllers/paymentController";
import { rateLimit } from "./middleware/rateLimit";
import { prisma } from "./config/db";
import internalRoutes from "./routes/internalRoutes";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  ...configuredOrigins,
];

app.use(
  helmet(),
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Stripe needs the exact raw bytes of the request body to verify the
// webhook signature, so this route is registered BEFORE express.json()
// and given its own raw-body parser -- it must never go through the
// global JSON middleware below.
app.post(
  "/api/payments/webhook",
  rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: "stripe-webhook" }),
  express.raw({ type: "application/json", limit: "256kb" }),
  handleStripeWebhook
);

app.use(express.json({ limit: "1mb" }));
app.use(process.env.NODE_ENV === "production" ? morgan("combined") : morgan("dev"));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyPrefix: "auth" }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 300, keyPrefix: "api" }));

app.get("/", (_req, res) => {
  res.json({ message: "Appointment Platform API is running", status: "ok" });
});

app.get("/health", (_req, res) => res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) }));
app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use("/api", routes);
app.use("/api/internal", internalRoutes);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

app.use(errorHandler);

export default app;
