import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { notify } from "../services/notificationService";
import { processCheckInRefund } from "../services/refundService";

type Tx = Prisma.TransactionClient;

function getTokenDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function allocateToken(tx: Tx, businessId: string, date: Date, timezone: string) {
  const tokenDate = getTokenDate(date, timezone);
  const sequence = await tx.businessTokenSequence.upsert({
    where: { businessId_tokenDate: { businessId, tokenDate } },
    create: { businessId, tokenDate, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  return { tokenDate, tokenNumber: sequence.nextNumber - 1 };
}

const bookSchema = z.object({
  slotId: z.string().uuid(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
});

// Books a slot atomically. The key to preventing double-booking under
// concurrent requests is a single conditional UPDATE: we only flip
// isBooked to true if it is currently false, and check the affected row
// count. If two requests race for the same slot, only one UPDATE matches
// a row, so only one booking succeeds -- no lost updates, no lock needed.
export async function bookAppointment(req: Request, res: Response) {
  const { slotId, notes, couponCode } = bookSchema.parse(req.body);

  const appointment = await prisma.$transaction(async (tx: Tx) => {
    const targetSlot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!targetSlot) {
      throw new ApiError(404, "Slot not found");
    }

    const staff = await tx.staffProfile.findUniqueOrThrow({ where: { id: targetSlot.staffId } });
    const business = await tx.business.findUniqueOrThrow({
      where: { id: staff.businessId },
      include: { category: true },
    });
    if (business.status !== "ACTIVE") {
      throw new ApiError(400, "This business is not available for bookings yet.");
    }
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
    ].includes(business.category?.slug || "");
    const now = new Date();
    if (tokenFlow ? targetSlot.endTime <= now : targetSlot.startTime <= now) {
      throw new ApiError(400, "This appointment time has passed. Please choose a later slot.");
    }

    // Overlapping Time Validation: Prevent time slot collisions across any bookings
    const overlappingAppointment = await tx.appointment.findFirst({
      where: {
        customerId: req.user!.userId,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        slot: {
          startTime: { lt: targetSlot.endTime },
          endTime: { gt: targetSlot.startTime },
        },
      },
      include: { slot: true, service: true },
    });

    if (overlappingAppointment) {
      const conflictStart = new Date(overlappingAppointment.slot.startTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const conflictEnd = new Date(overlappingAppointment.slot.endTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      throw new ApiError(
        400,
        `Time conflict: You already have an active booking for ${overlappingAppointment.service.name} from ${conflictStart} to ${conflictEnd}. Please select a non-overlapping time slot.`
      );
    }

    let coupon = null;
    if (couponCode) {
      coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt < new Date())) {
        throw new ApiError(400, "Invalid or expired coupon code");
      }
      
      const existing = await tx.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: req.user!.userId } },
      });
      if (existing) {
        throw new ApiError(400, "You have already used this coupon");
      }
      
      if (coupon.maxRedemptions) {
        const count = await tx.couponRedemption.count({ where: { couponId: coupon.id } });
        if (count >= coupon.maxRedemptions) {
          throw new ApiError(400, "Coupon redemption limit reached");
        }
      }
    }

    const updateResult = tokenFlow
      ? { count: 1 }
      : await tx.slot.updateMany({
          where: { id: slotId, isBooked: false },
          data: { isBooked: true },
        });

    if (updateResult.count === 0) {
      throw new ApiError(409, "This slot was just booked by someone else. Please pick another.");
    }

    const slot = targetSlot;
    if (coupon && coupon.businessId !== staff.businessId) {
      throw new ApiError(400, "Coupon is not valid for this business");
    }

    const token = await allocateToken(tx, staff.businessId, slot.startTime, business.timezone);

    // A slot can only ever have one Appointment row (slotId is unique), so
    // if this slot was booked-then-cancelled before, a CANCELLED row is
    // still sitting on it. Reuse that row instead of inserting a new one --
    // this is safe because the isBooked flip above guarantees no ACTIVE
    // appointment currently holds this slot.
    const existing = tokenFlow
      ? await tx.appointment.findFirst({ where: { slotId: slot.id, status: "CANCELLED" } })
      : await tx.appointment.findFirst({ where: { slotId: slot.id } });

    const appointmentData = {
      customerId: req.user!.userId,
      businessId: staff.businessId,
      staffId: slot.staffId,
      serviceId: slot.serviceId,
      notes,
      couponId: coupon?.id,
      status: "CONFIRMED" as const,
      ...token,
      qrCode: crypto.randomUUID(), // fresh QR so the old cancelled appointment's code can't be used to check in
      checkedInAt: null,
    };

    const newAppointment = existing
      ? await tx.appointment.update({
          where: { id: existing.id },
          data: appointmentData,
          include: {
            service: true,
            staff: { include: { user: true } },
            slot: true,
            customer: true,
            business: true,
          },
        })
      : await tx.appointment.create({
          data: { ...appointmentData, slotId: slot.id },
          include: {
            service: true,
            staff: { include: { user: true } },
            slot: true,
            customer: true,
            business: true,
          },
        });

    if (coupon) {
      await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId: req.user!.userId },
      });
    }

    return newAppointment;
  });

  await notify({
    appointmentId: appointment.id,
    userId: appointment.customerId,
    to: appointment.customer.email,
    subject: "Appointment confirmed",
    message: `Your ${appointment.service.name} appointment is confirmed for ${appointment.slot.startTime.toLocaleString()} with ${appointment.staff.user.name}.`,
  });

  res.status(201).json(appointment);
}

export async function cancelAppointment(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { customer: true, service: true, slot: true, business: true },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const isOwner = appointment.customerId === req.user!.userId;
  const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  if (!isOwner && !isPrivileged) throw new ApiError(403, "Not your appointment");

  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } }),
    prisma.slot.update({ where: { id: appointment.slotId }, data: { isBooked: false } }),
    prisma.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } }),
  ]);

  await notify({
    userId: appointment.customerId,
    appointmentId: appointment.id,
    to: appointment.customer.email,
    subject: `Booking cancelled — ${appointment.service.name}`,
    message: `Your appointment for ${appointment.service.name} at ${appointment.business.name} on ${appointment.slot.startTime.toLocaleString()} has been cancelled.`,
  });

  // Notify anyone waitlisted for this service on the same day that a slot opened up.
  const dayStart = new Date(appointment.slot.startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const waiters = await prisma.waitlistEntry.findMany({
    where: {
      serviceId: appointment.serviceId,
      notified: false,
      preferredDate: { gte: dayStart, lt: dayEnd },
    },
    include: { customer: true },
  });

  if (waiters.length > 0) {
    const business = await prisma.business.findUnique({ where: { id: appointment.businessId } });
    for (const w of waiters) {
      await notify({
        userId: w.customerId,
        to: w.customer.email,
        subject: `A slot opened up — ${appointment.service.name}`,
        message: `Good news — a ${appointment.service.name} slot just opened at ${appointment.business.name} on ${appointment.slot.startTime.toLocaleDateString()}. Book it before it's gone: ${process.env.FRONTEND_URL}/book/${business?.slug}`,
      });
      await prisma.waitlistEntry.update({ where: { id: w.id }, data: { notified: true } });
    }
  }

  res.json({ message: "Appointment cancelled" });
}

const rescheduleSchema = z.object({ newSlotId: z.string().uuid() });

export async function rescheduleAppointment(req: Request, res: Response) {
  const { newSlotId } = rescheduleSchema.parse(req.body);

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.customerId !== req.user!.userId) throw new ApiError(403, "Not your appointment");

  const updated = await prisma.$transaction(async (tx: Tx) => {
    const claim = await tx.slot.updateMany({
      where: { id: newSlotId, isBooked: false },
      data: { isBooked: true },
    });
    if (claim.count === 0) throw new ApiError(409, "That slot is no longer available");

    await tx.slot.update({ where: { id: appointment.slotId }, data: { isBooked: false } });
    await tx.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } });

    const newSlot = await tx.slot.findUniqueOrThrow({ where: { id: newSlotId } });
    const business = await tx.business.findUniqueOrThrow({ where: { id: appointment.businessId } });
    const token = await allocateToken(tx, appointment.businessId, newSlot.startTime, business.timezone);
    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        slotId: newSlot.id,
        staffId: newSlot.staffId,
        serviceId: newSlot.serviceId,
        status: "CONFIRMED",
        ...token,
      },
      include: { service: true, slot: true, customer: true, business: true },
    });
  });

  await notify({
    userId: updated.customerId,
    appointmentId: updated.id,
    to: updated.customer.email,
    subject: `Booking rescheduled — ${updated.service.name}`,
    message: `Your appointment for ${updated.service.name} at ${updated.business.name} has been moved to ${updated.slot.startTime.toLocaleString()}.`,
  });

  res.json(updated);
}

export async function myAppointments(req: Request, res: Response) {
  const appointments = await prisma.appointment.findMany({
    where: { customerId: req.user!.userId },
    include: {
      service: true,
      staff: { include: { user: true } },
      slot: true,
      business: { include: { category: true } },
      payment: true,
      review: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(appointments);
}

// Business-side view: all appointments for the owner's business, optionally filtered by date/staff.
export async function businessAppointments(req: Request, res: Response) {
  let businessId: string | undefined;

  if (req.user!.role === "ADMIN") {
    const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
    if (!business) throw new ApiError(404, "You don't own a business");
    businessId = business.id;
  } else if (req.user!.role === "STAFF") {
    const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user!.userId } });
    if (!staff) throw new ApiError(404, "Staff profile not found");
    businessId = staff.businessId;
  } else {
    throw new ApiError(403, "Insufficient permissions for this action");
  }

  const where: Prisma.AppointmentWhereInput = { businessId };
  if (req.query.staffId) where.staffId = String(req.query.staffId);
  if (req.query.status) where.status = String(req.query.status) as any;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      customer: { select: { name: true, email: true } },
      service: true,
      slot: true,
      review: true,
      payment: true,
    },
    orderBy: { slot: { startTime: "asc" } },
  });
  res.json(appointments);
}

async function assertCanManageAppointment(req: Request, appointment: { businessId: string }) {
  if (req.user!.role === "ADMIN") {
    const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
    if (!business || business.id !== appointment.businessId) {
      throw new ApiError(403, "Not authorized for this appointment");
    }
    return;
  }

  if (req.user!.role === "STAFF") {
    const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user!.userId } });
    if (!staff || staff.businessId !== appointment.businessId) {
      throw new ApiError(403, "Not authorized for this appointment");
    }
    return;
  }

  throw new ApiError(403, "Insufficient permissions for this action");
}

export async function completeAppointment(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) throw new ApiError(404, "Appointment not found");

  await assertCanManageAppointment(req, appointment);

  if (appointment.status === "CANCELLED") {
    throw new ApiError(400, "Cannot complete a cancelled appointment");
  }
  if (appointment.status === "COMPLETED") {
    throw new ApiError(409, "Appointment is already completed");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED" },
      include: { service: true, slot: true, customer: { select: { name: true, email: true } }, review: true },
    });
    await tx.user.update({
      where: { id: appointment.customerId },
      data: { loyaltyPoints: { increment: 50 } },
    });
    return appt;
  });
  res.json(updated);
}

// QR check-in: staff scans the customer's QR (their appointment.qrCode) to mark arrival.
export async function checkIn(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({ where: { qrCode: req.params.qrCode } });
  if (!appointment) throw new ApiError(404, "Invalid QR code");
  if (appointment.checkedInAt) throw new ApiError(409, "Already checked in");

  await assertCanManageAppointment(req, appointment);

  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: appointment.id },
      data: { checkedInAt: new Date(), status: "COMPLETED" },
    });
    await tx.user.update({
      where: { id: appointment.customerId },
      data: { loyaltyPoints: { increment: 50 } },
    });
    return appt;
  });

  // Trigger 90% token fee refund upon verified arrival
  await processCheckInRefund(appointment.id);

  res.json(updated);
}
