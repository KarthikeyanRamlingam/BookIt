import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { requireBusinessAccess } from "../middleware/businessAccess";
import {
  getMyBusiness,
  updateMyBusiness,
  getDashboardStats,
  getLiveQueue,
  generateCheckInSession,
  getCurrentSession,
  listCheckIns,
  confirmCheckIn,
  rejectCheckIn,
  markAttended,
  getBusinessAppointments,
  runNoShowSweep,
  getBusinessSettings,
  updateBusinessSettings,
} from "../controllers/businessPortalController";

const router = Router();

// All business portal routes require auth + business context resolution
router.use(requireAuth, requireRole("ADMIN", "STAFF"), requireBusinessAccess);

// Business profile
router.get("/me", getMyBusiness);
router.patch("/me", requireRole("ADMIN"), updateMyBusiness);

// Dashboard stats
router.get("/dashboard", getDashboardStats);
router.get("/queue/live", getLiveQueue);

// Check-in sessions (dynamic QR)
router.post("/checkin-session", generateCheckInSession);
router.get("/checkin-session/current", getCurrentSession);

// Check-in management
router.get("/checkins", listCheckIns);
router.post("/checkins/:id/confirm", confirmCheckIn);
router.post("/checkins/:id/reject", rejectCheckIn);

// Appointments (business portal view)
router.get("/appointments", getBusinessAppointments);
router.post("/appointments/:id/attended", markAttended);

// No-show sweep (can be called by a cron job)
router.post("/no-show-sweep", runNoShowSweep);

// Business settings
router.get("/settings", getBusinessSettings);
router.patch("/settings", requireRole("ADMIN"), updateBusinessSettings);

export default router;
