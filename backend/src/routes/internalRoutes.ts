import { Router } from "express";
import { runNoShowSweep } from "../controllers/businessPortalController";
import { requireCronSecret } from "../middleware/cronAuth";
import { retryPendingAppointmentRefunds } from "../controllers/paymentController";

const router = Router();
router.post("/no-show-sweep", requireCronSecret, runNoShowSweep);
router.post("/refunds/retry", requireCronSecret, retryPendingAppointmentRefunds);

export default router;
