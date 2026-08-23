import { Router } from "express";
import {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  myAppointments,
  businessAppointments,
  completeAppointment,
  checkIn,
} from "../controllers/appointmentController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.use(requireAuth);
router.post("/", bookAppointment);
router.get("/mine", myAppointments);
router.get("/business", requireRole("ADMIN", "STAFF"), businessAppointments);
router.post("/:id/cancel", cancelAppointment);
router.post("/:id/reschedule", rescheduleAppointment);
router.post("/:id/complete", requireRole("ADMIN", "STAFF"), completeAppointment);
router.post("/checkin/:qrCode", requireRole("ADMIN", "STAFF"), checkIn);

export default router;
