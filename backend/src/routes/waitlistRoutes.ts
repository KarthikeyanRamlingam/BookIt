import { Router } from "express";
import { joinWaitlist, myWaitlistEntries, leaveWaitlist } from "../controllers/waitlistController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);
router.post("/", joinWaitlist);
router.get("/mine", myWaitlistEntries);
router.delete("/:id", leaveWaitlist);

export default router;
