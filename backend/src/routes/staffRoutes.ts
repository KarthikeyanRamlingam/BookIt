import { Router } from "express";
import { addStaff, listStaff, removeStaff } from "../controllers/staffController";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));
router.get("/", listStaff);
router.post("/", addStaff);
router.delete("/:id", removeStaff);

export default router;
