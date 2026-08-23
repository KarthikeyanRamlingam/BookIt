import { Router } from "express";
import { listCategories } from "../controllers/categoryController";

const router = Router();

router.get("/", listCategories); // public

export default router;