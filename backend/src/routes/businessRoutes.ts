import { Router } from "express";
import {
  getBusinessBySlug,
  setBusinessHours,
  getMyBusiness,
  getNearbyBusinesses,
  getTokenPreview,
  getAvailableQueueDates,
} from "../controllers/businessController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.get("/mine", requireAuth, requireRole("ADMIN"), getMyBusiness);
router.put("/hours", requireAuth, requireRole("ADMIN"), setBusinessHours);
router.get("/nearby", requireAuth, getNearbyBusinesses); // must be registered before "/:slug"
router.get("/:slug/queue-dates", requireAuth, getAvailableQueueDates);
router.get("/:slug/token-preview", requireAuth, getTokenPreview);
router.get("/:slug", requireAuth, getBusinessBySlug);

export default router;
