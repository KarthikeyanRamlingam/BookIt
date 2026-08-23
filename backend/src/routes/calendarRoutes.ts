import { Router } from "express";
import {
  downloadAppointmentICS,
  getAppointmentCalendarLinks,
  getBusinessCalendarFeed,
} from "../controllers/calendarController";

const router = Router();

// Public / client-accessible calendar endpoints
router.get("/appointment/:id.ics", downloadAppointmentICS);
router.get("/appointment/:id/links", getAppointmentCalendarLinks);
router.get("/business/:slugOrId.ics", getBusinessCalendarFeed);

export default router;
