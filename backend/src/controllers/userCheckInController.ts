import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

const initiateSchema = z.object({
  sessionToken: z.string().uuid("Invalid session token format"),
  appointmentId: z.string().uuid("Invalid appointment ID"),
});

/**
 * Called by the customer when they scan the business's dynamic QR code.
 *
 * Validation chain:
 *  1. User is authenticated
 *  2. Session token exists, is active, not expired
 *  3. Appointment belongs to this user
 *  4. Appointment belongs to the same business as the session
 *  5. Appointment is in a bookable state (CONFIRMED)
 *  6. Current time is within the check-in window
 *  7. No duplicate check-in record exists
 */
export async function initiateCheckIn(req: Request, res: Response) {
  const { sessionToken, appointmentId } = initiateSchema.parse(req.body);
  const userId = req.user!.userId;
  const now = new Date();

  // 1. Validate session token
  const session = await prisma.checkInSession.findUnique({ where: { token: sessionToken } });
  if (!session) throw new ApiError(404, "Invalid check-in session. Please scan a valid business QR code.");
  if (!session.active) throw new ApiError(410, "This check-in session is no longer active.");
  if (session.expiresAt < now) throw new ApiError(410, "This check-in session has expired. Please ask the business to refresh the QR code.");

  // 2. Fetch appointment with full context
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      slot: true,
      business: { include: { settings: true, category: true } },
      service: true,
    },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found.");
  if (appointment.customerId !== userId) throw new ApiError(403, "This booking does not belong to your account.");
  if (appointment.businessId !== session.businessId) {
    throw new ApiError(400, "This QR code is for a different business. Please scan the correct QR code.");
  }

  // 3. Status check
  if (appointment.status === "CANCELLED") throw new ApiError(400, "This booking has been cancelled.");
  if (appointment.status === "NO_SHOW") throw new ApiError(400, "This booking has been marked as no-show.");
  if (appointment.status === "CHECKED_IN") throw new ApiError(409, "You have already been checked in for this appointment.");
  if (appointment.status === "ATTENDED") throw new ApiError(409, "This appointment has already been completed.");
  if (appointment.status === "CHECK_IN_PENDING") {
    throw new ApiError(409, "Check-in already initiated. Waiting for business confirmation.");
  }
  if (appointment.status !== "CONFIRMED") {
    throw new ApiError(400, `Cannot check in with appointment status: ${appointment.status}`);
  }

  // 4. Check-in window validation (server-side time)
  const settings = appointment.business.settings;
  const checkInBeforeMs = (settings?.checkInBeforeMinutes ?? 30) * 60 * 1000;
  const gracePeriodMs = (settings?.gracePeriodMinutes ?? 15) * 60 * 1000;
  const slotStart = appointment.slot.startTime;
  const tokenFlow = [
    "doctor-appointment",
    "government-office",
    "general-practitioners",
    "cardiologists",
    "pediatricians",
    "dermatologists",
    "neurologists",
    "endocrinologists",
    "gastroenterologists",
    "psychiatrists",
    "orthopedics",
    "dentists",
    "ophthalmologists",
    "gynecologists",
  ].includes(appointment.business.category?.slug || "");
  const windowOpen = tokenFlow ? slotStart : new Date(slotStart.getTime() - checkInBeforeMs);
  const windowClose = tokenFlow ? appointment.slot.endTime : new Date(slotStart.getTime() + gracePeriodMs);

  if (now < windowOpen) {
    const minutesUntil = Math.round((windowOpen.getTime() - now.getTime()) / 60000);
    throw new ApiError(
      400,
      `Check-in is not open yet. It opens ${minutesUntil} minute(s) before your appointment at ${windowOpen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
    );
  }
  if (now > windowClose) {
    throw new ApiError(
      400,
      "The check-in window for this appointment has passed. Please contact the business."
    );
  }

  // 5. Prevent duplicate check-in records (race condition safe via unique constraint on bookingId)
  const existingCheckIn = await prisma.checkIn.findUnique({ where: { bookingId: appointmentId } });
  if (existingCheckIn) {
    if (existingCheckIn.status === "PENDING") {
      throw new ApiError(409, "Check-in already initiated. Waiting for business confirmation.");
    }
    if (existingCheckIn.status === "CONFIRMED") {
      throw new ApiError(409, "You have already been checked in.");
    }
    if (existingCheckIn.status === "REJECTED") {
      // Allow re-attempt if previously rejected — delete old record
      await prisma.checkIn.delete({ where: { id: existingCheckIn.id } });
    }
  }

  // 6. Create check-in record and update appointment status atomically
  const [checkIn] = await prisma.$transaction([
    prisma.checkIn.create({
      data: {
        bookingId: appointmentId,
        userId,
        businessId: session.businessId,
        sessionId: session.id,
        status: "PENDING",
        method: "QR_SCAN",
        initiatedAt: now,
      },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CHECK_IN_PENDING" },
    }),
  ]);

  res.status(201).json({
    checkInId: checkIn.id,
    status: "PENDING",
    message: "Check-in initiated successfully. Waiting for business confirmation.",
    business: appointment.business.name,
    service: appointment.service.name,
    slotTime: appointment.slot.startTime,
  });
}

/**
 * Returns the current check-in status for a specific appointment.
 * Used by the customer app to poll for updates.
 */
export async function getCheckInStatus(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { appointmentId } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      checkIn: true,
      service: { select: { name: true } },
      slot: { select: { startTime: true } },
      business: { select: { name: true } },
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.customerId !== userId) throw new ApiError(403, "Not your appointment");

  res.json({
    appointmentId,
    appointmentStatus: appointment.status,
    checkIn: appointment.checkIn
      ? {
          id: appointment.checkIn.id,
          status: appointment.checkIn.status,
          initiatedAt: appointment.checkIn.initiatedAt,
          verifiedAt: appointment.checkIn.verifiedAt,
          rejectionReason: appointment.checkIn.rejectionReason,
        }
      : null,
    service: appointment.service.name,
    slotTime: appointment.slot.startTime,
    businessName: appointment.business.name,
  });
}

export async function getMyLiveQueue(req: Request, res: Response) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.appointmentId, customerId: req.user!.userId },
    include: { service: { select: { name: true } } },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const queue = await prisma.appointment.findMany({
    where: {
      businessId: appointment.businessId,
      status: { in: ["CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
      tokenDate: appointment.tokenDate || "__unassigned__",
    },
    select: { id: true, status: true, tokenNumber: true, service: { select: { name: true } } },
    orderBy: { tokenNumber: "asc" },
  });
  const position = queue.findIndex((item) => item.id === appointment.id);
  const current = queue.find((item) => item.status === "CHECKED_IN") || null;
  const status = appointment.status === "CHECKED_IN" ? "WAITING_IN_QUEUE" : "WAITING_FOR_CHECK_IN";

  res.json({
    updatedAt: new Date().toISOString(),
    appointmentStatus: status,
    serviceName: appointment.service.name,
    currentServiceName: current?.service.name || null,
    currentTokenNumber: current?.tokenNumber || null,
    myTokenNumber: position >= 0 ? queue[position].tokenNumber : appointment.tokenNumber,
    myQueueNumber: position >= 0 ? position + 1 : null,
    peopleAhead: position > 0 ? queue.slice(0, position).filter((item) => item.status === "CHECKED_IN").length : 0,
    waitingCount: queue.length,
  });
}
