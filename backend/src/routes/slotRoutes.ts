import { Router } from "express";
import { generateSlots, getAvailability } from "../controllers/slotController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.get("/availability", getAvailability); // public
router.post("/generate", requireAuth, requireRole("ADMIN"), generateSlots);

export default router;
