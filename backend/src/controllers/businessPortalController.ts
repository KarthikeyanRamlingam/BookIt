import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { processCheckInRefund } from "../services/refundService";
import { sweepNoShows } from "../services/noShowService";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getBusinessId(req: Request): string {
  const bId = (req as any).businessId as string | undefined;
  if (!bId) throw new ApiError(403, "Business context missing");
  return bId;
}

const CHECK_IN_SESSION_TTL_SECONDS = 60;

// ─── Business Profile ────────────────────────────────────────────────────────

const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  mapUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().optional(),
});

export async function getMyBusiness(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      services: true,
      staff: { include: { user: { select: { id: true, name: true, email: true } } } },
      businessHours: { orderBy: { dayOfWeek: "asc" } },
      category: true,
      settings: true,
    },
  });
  if (!business) throw new ApiError(404, "Business not found");
  res.json(business);
}

export async function updateMyBusiness(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  if (req.user!.role !== "ADMIN") throw new ApiError(403, "Only business owners can update profile");

  const data = updateBusinessSchema.parse(req.body);
  const updated = await prisma.business.update({
    where: { id: businessId },
    data,
    include: { category: true, settings: true },
  });
  res.json(updated);
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getDashboardStats(req: Request, res: Response) {
  const businessId = getBusinessId(req);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    todayTotal,
    todayCheckedIn,
    todayAttended,
    todayNoShow,
    todayCancelled,
    upcomingCount,
    pendingCheckIns,
    recentCheckIns,
  ] = await Promise.all([
    // Today's total bookings (all non-cancelled)
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: todayStart, lte: todayEnd } },
        status: { notIn: ["CANCELLED"] },
      },
    }),
    // Checked in today
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: todayStart, lte: todayEnd } },
        status: { in: ["CHECKED_IN", "ATTENDED"] },
      },
    }),
    // Attended today
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: todayStart, lte: todayEnd } },
        status: "ATTENDED",
      },
    }),
    // No shows today
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: todayStart, lte: todayEnd } },
        status: "NO_SHOW",
      },
    }),
    // Cancelled today
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: todayStart, lte: todayEnd } },
        status: "CANCELLED",
      },
    }),
    // Upcoming (from now, next 7 days)
    prisma.appointment.count({
      where: {
        businessId,
        slot: { startTime: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
        status: { in: ["CONFIRMED", "CHECK_IN_PENDING"] },
      },
    }),
    // Pending check-ins needing confirmation
    prisma.checkIn.count({
      where: { businessId, status: "PENDING" },
    }),
    // Recent check-ins (last 10)
    prisma.checkIn.findMany({
      where: { businessId },
      include: {
        user: { select: { name: true, email: true } },
        booking: {
          include: {
            service: { select: { name: true } },
            slot: { select: { startTime: true } },
          },
        },
      },
      orderBy: { initiatedAt: "desc" },
      take: 10,
    }),
  ]);

  res.json({
    today: {
      total: todayTotal,
      checkedIn: todayCheckedIn,
      attended: todayAttended,
      noShow: todayNoShow,
      cancelled: todayCancelled,
    },
    upcoming: upcomingCount,
    pendingCheckIns,
    recentCheckIns,
  });
}

// Live queue: the first verified arrival is currently being served.
export async function getLiveQueue(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: "CHECKED_IN",
      checkedInAt: { gte: todayStart, lt: tomorrow },
    },
    include: {
      customer: { select: { name: true } },
      service: { select: { name: true, durationMin: true } },
      staff: { include: { user: { select: { name: true } } } },
      slot: { select: { startTime: true, endTime: true } },
    },
    orderBy: { checkedInAt: "asc" },
  });

  res.json({
    updatedAt: new Date().toISOString(),
    current: appointments[0] || null,
    waiting: appointments.slice(1).map((appointment, index) => ({
      ...appointment,
      queuePosition: index + 2,
    })),
    totalWaiting: Math.max(0, appointments.length - 1),
  });
}

// ─── Check-in Session (Dynamic QR) ───────────────────────────────────────────

/**
 * Generates (or refreshes) a short-lived check-in session token for the business.
 * The QR displayed at the business counter encodes this token.
 * Tokens are cryptographically random UUIDs stored server-side with a 60s TTL.
 */
export async function generateCheckInSession(req: Request, res: Response) {
  const businessId = getBusinessId(req);

  // Deactivate any existing active sessions for this business
  await prisma.checkInSession.updateMany({
    where: { businessId, active: true },
    data: { active: false },
  });

  const expiresAt = new Date(Date.now() + CHECK_IN_SESSION_TTL_SECONDS * 1000);
  const session = await prisma.checkInSession.create({
    data: {
      businessId,
      token: crypto.randomUUID(),
      expiresAt,
      active: true,
    },
  });

  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    expiresInSeconds: CHECK_IN_SESSION_TTL_SECONDS,
  });
}

export async function getCurrentSession(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const now = new Date();

  const session = await prisma.checkInSession.findFirst({
    where: { businessId, active: true, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    return res.json({ session: null });
  }

  const secondsLeft = Math.max(0, Math.round((session.expiresAt.getTime() - now.getTime()) / 1000));
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    secondsLeft,
  });
}

// ─── Check-in Management ─────────────────────────────────────────────────────

export async function listCheckIns(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const statusFilter = req.query.status as string | undefined;

  const checkIns = await prisma.checkIn.findMany({
    where: {
      businessId,
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      booking: {
        include: {
          service: { select: { name: true, durationMin: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
      },
      verifiedBy: { select: { name: true } },
    },
    orderBy: { initiatedAt: "desc" },
    take: 50,
  });

  res.json(checkIns);
}

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export async function confirmCheckIn(req: Request, res: Response) {
  const businessId = getBusinessId(req);

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: req.params.id },
    include: { booking: { include: { slot: true } } },
  });
  if (!checkIn) throw new ApiError(404, "Check-in record not found");
  if (checkIn.businessId !== businessId) throw new ApiError(403, "Not authorized for this check-in");
  if (checkIn.status !== "PENDING") throw new ApiError(409, `Check-in already ${checkIn.status.toLowerCase()}`);

  // Validate booking is in the right state
  if (!["CONFIRMED", "CHECK_IN_PENDING"].includes(checkIn.booking.status)) {
    throw new ApiError(400, `Cannot confirm check-in for appointment with status ${checkIn.booking.status}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.checkIn.update({
      where: { id: checkIn.id },
      data: { status: "CONFIRMED", verifiedAt: new Date(), verifiedById: req.user!.userId },
    });
    await tx.appointment.update({
      where: { id: checkIn.bookingId },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    });
  });

  // Trigger 90% token fee refund back to user
  const refundResult = await processCheckInRefund(checkIn.bookingId);

  const updated = await prisma.checkIn.findUnique({
    where: { id: checkIn.id },
    include: {
      user: { select: { name: true, email: true } },
      booking: { include: { service: true, slot: true, payment: true } },
      verifiedBy: { select: { name: true } },
    },
  });

  res.json({ ...updated, refund: refundResult });
}

export async function rejectCheckIn(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const { reason } = rejectSchema.parse(req.body);

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: req.params.id },
    include: { booking: true },
  });
  if (!checkIn) throw new ApiError(404, "Check-in record not found");
  if (checkIn.businessId !== businessId) throw new ApiError(403, "Not authorized for this check-in");
  if (checkIn.status !== "PENDING") throw new ApiError(409, `Check-in already ${checkIn.status.toLowerCase()}`);

  await prisma.$transaction([
    prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        status: "REJECTED",
        verifiedAt: new Date(),
        verifiedById: req.user!.userId,
        rejectionReason: reason,
      },
    }),
    // Revert appointment back to CONFIRMED so user can try again
    prisma.appointment.update({
      where: { id: checkIn.bookingId },
      data: { status: "CONFIRMED" },
    }),
  ]);

  res.json({ message: "Check-in rejected", reason });
}

// ─── Mark Attended ────────────────────────────────────────────────────────────

export async function markAttended(req: Request, res: Response) {
  const businessId = getBusinessId(req);

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.businessId !== businessId) throw new ApiError(403, "Not your appointment");
  if (appointment.status !== "CHECKED_IN") {
    throw new ApiError(400, `Can only mark CHECKED_IN appointments as attended. Current status: ${appointment.status}`);
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "ATTENDED", attendedAt: new Date() },
    include: {
      customer: { select: { name: true, email: true } },
      service: true,
      slot: true,
    },
  });

  // Award loyalty points
  await prisma.user.update({
    where: { id: appointment.customerId },
    data: { loyaltyPoints: { increment: 50 } },
  });

  res.json(updated);
}

// ─── Business Appointments (Portal View) ─────────────────────────────────────

export async function getBusinessAppointments(req: Request, res: Response) {
  const businessId = getBusinessId(req);

  const where: any = { businessId };
  if (req.query.status) where.status = req.query.status;
  if (req.query.date) {
    const date = new Date(String(req.query.date));
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    where.slot = { startTime: { gte: dayStart, lte: dayEnd } };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { name: true, email: true } },
      service: { select: { name: true, durationMin: true } },
      slot: { select: { startTime: true, endTime: true } },
      checkIn: true,
      payment: true,
    },
    orderBy: { slot: { startTime: "asc" } },
    take: 100,
  });

  res.json(appointments);
}

// ─── No-show Sweep ────────────────────────────────────────────────────────────

/**
 * Marks overdue appointments as NO_SHOW.
 * Safe to run as a cron job or via an internal endpoint.
 * Only processes appointments where:
 *   - status is CONFIRMED or CHECK_IN_PENDING
 *   - slot.startTime + gracePeriodMinutes < now
 *   - business has autoNoShow = true
 */
export async function runNoShowSweep(req: Request, res: Response) {
  const now = new Date();
  const swept = await sweepNoShows(now);
  res.json({ swept, at: now.toISOString() });
}

// ─── Business Settings ────────────────────────────────────────────────────────

const settingsSchema = z.object({
  checkInBeforeMinutes: z.number().min(0).max(120).optional(),
  gracePeriodMinutes: z.number().min(0).max(60).optional(),
  autoNoShow: z.boolean().optional(),
  locationVerificationEnabled: z.boolean().optional(),
  breakfastStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  breakfastEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  lunchStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  dinnerStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  dinnerEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function getBusinessSettings(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
  if (!settings) throw new ApiError(404, "Settings not found");
  res.json(settings);
}

export async function updateBusinessSettings(req: Request, res: Response) {
  const businessId = getBusinessId(req);
  if (req.user!.role !== "ADMIN") throw new ApiError(403, "Only business owners can update settings");

  const data = settingsSchema.parse(req.body);
  const settings = await prisma.businessSettings.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });
  res.json(settings);
}
