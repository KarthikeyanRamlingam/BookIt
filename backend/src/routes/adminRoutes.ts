import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { decideBusinessApplication, deleteBusiness, listBusinessApplications } from "../controllers/adminController";

const router = Router();
router.use(requireAuth, requireRole("PLATFORM_ADMIN"));
router.get("/businesses", listBusinessApplications);
router.patch("/businesses/:id/decision", decideBusinessApplication);
router.delete("/businesses/:id", deleteBusiness);

export default router;
