import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { initiateCheckIn, getCheckInStatus, getMyLiveQueue } from "../controllers/userCheckInController";

const router = Router();

router.use(requireAuth);

// Customer initiates check-in by scanning business QR
router.post("/checkin", requireRole("CUSTOMER"), initiateCheckIn);

// Customer polls check-in status for a specific appointment
router.get("/checkin/:appointmentId", getCheckInStatus);
router.get("/queue/:appointmentId", getMyLiveQueue);

export default router;
