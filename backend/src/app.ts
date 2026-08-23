import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { handleStripeWebhook } from "./controllers/paymentController";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));

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