import { Router } from "express";
import {
  downloadAppointmentICS,
  getAppointmentCalendarLinks,
  getBusinessCalendarFeed,
} from "../controllers/calendarController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

// Public / client-accessible calendar endpoints
router.get("/appointment/:id.ics", requireAuth, downloadAppointmentICS);
router.get("/appointment/:id/links", requireAuth, getAppointmentCalendarLinks);
router.get("/business/:slugOrId.ics", requireAuth, requireRole("ADMIN", "STAFF"), getBusinessCalendarFeed);

export default router;
