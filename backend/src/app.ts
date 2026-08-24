import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { handleStripeWebhook } from "./controllers/paymentController";

const app = express();

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
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ message: "Appointment Platform API is running", status: "ok" });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", routes);

app.use(errorHandler);

export default app;