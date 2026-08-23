import { Router } from "express";
import {
  getBusinessBySlug,
  setBusinessHours,
  getMyBusiness,
  getNearbyBusinesses,
  getTokenPreview,
} from "../controllers/businessController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.get("/mine", requireAuth, requireRole("ADMIN"), getMyBusiness);
router.put("/hours", requireAuth, requireRole("ADMIN"), setBusinessHours);
router.get("/nearby", getNearbyBusinesses); // public -- must be registered before "/:slug"
router.get("/:slug/token-preview", getTokenPreview);
router.get("/:slug", getBusinessBySlug); // public storefront lookup

export default router;