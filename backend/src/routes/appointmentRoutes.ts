import { Router } from "express";
import {
  bookAppointment,
  bookQueueAppointment,
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
router.post("/queue", requireRole("CUSTOMER"), bookQueueAppointment);
router.post("/", requireRole("CUSTOMER"), bookAppointment);
router.get("/mine", requireRole("CUSTOMER"), myAppointments);
router.get("/business", requireRole("ADMIN", "STAFF"), businessAppointments);
router.post("/:id/cancel", requireRole("CUSTOMER"), cancelAppointment);
router.post("/:id/reschedule", requireRole("CUSTOMER"), rescheduleAppointment);
router.post("/:id/complete", requireRole("ADMIN", "STAFF"), completeAppointment);
router.post("/checkin/:qrCode", requireRole("ADMIN", "STAFF"), checkIn);

export default router;
