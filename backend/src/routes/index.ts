import { Router } from "express";
import authRoutes from "./authRoutes";
import businessRoutes from "./businessRoutes";
import businessPortalRoutes from "./businessPortalRoutes";
import userRoutes from "./userRoutes";
import serviceRoutes from "./serviceRoutes";
import staffRoutes from "./staffRoutes";
import slotRoutes from "./slotRoutes";
import appointmentRoutes from "./appointmentRoutes";
import paymentRoutes from "./paymentRoutes";
import reviewRoutes from "./reviewRoutes";
import categoryRoutes from "./categoryRoutes";
import calendarRoutes from "./calendarRoutes";
import pushRoutes from "./pushRoutes";
import adminRoutes from "./adminRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/businesses", businessRoutes);
router.use("/business", businessPortalRoutes);   // Business portal (owner/staff)
router.use("/user", userRoutes);                  // Customer actions (check-in initiation)
router.use("/services", serviceRoutes);
router.use("/staff", staffRoutes);
router.use("/slots", slotRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/categories", categoryRoutes);
router.use("/calendar", calendarRoutes);
router.use("/push", pushRoutes);
router.use("/admin", adminRoutes);

export default router;