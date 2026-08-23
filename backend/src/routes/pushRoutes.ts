import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { subscribeToPush, unsubscribeFromPush } from "../controllers/pushController";

const router = Router();

router.use(requireAuth);
router.post("/subscribe", subscribeToPush);
router.delete("/subscribe", unsubscribeFromPush);

export default router;
