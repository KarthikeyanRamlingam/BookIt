import { Router } from "express";
import { createCheckoutSession, getPaymentStatus, verifyPayment } from "../controllers/paymentController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/checkout/:appointmentId", requireAuth, createCheckoutSession);
router.get("/status/:appointmentId", requireAuth, getPaymentStatus);
router.post("/verify/:appointmentId", requireAuth, verifyPayment);
router.get("/verify/:appointmentId", requireAuth, verifyPayment);

export default router;