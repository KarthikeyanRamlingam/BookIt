import { Router } from "express";
import { createReview, listBusinessReviews } from "../controllers/reviewController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/", requireAuth, createReview);
router.get("/business/:slug", listBusinessReviews); // public

export default router;