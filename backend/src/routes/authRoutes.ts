import { Router } from "express";
import { register, login, logout, me, registerBusiness, googleLogin } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/register-business", registerBusiness);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
