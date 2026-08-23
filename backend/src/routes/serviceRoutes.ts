import { Router } from "express";
import { createService, updateService, deleteService, listServices } from "../controllers/serviceController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));
router.get("/", listServices);
router.post("/", createService);
router.put("/:id", updateService);
router.delete("/:id", deleteService);

export default router;
