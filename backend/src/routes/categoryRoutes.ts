import { Router } from "express";
import { listCategories } from "../controllers/categoryController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, listCategories);

export default router;
