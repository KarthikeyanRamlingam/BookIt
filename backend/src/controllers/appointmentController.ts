import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { notify } from "../services/notificationService";
import { processCancellationRefund, processCheckInRefund } from "../services/refundService";
import { usesTokenQueue } from "../domain/bookingRules";
import { DateTime } from "luxon";

type Tx = Prisma.TransactionClient;

async function acquireBookingLock(tx: Tx, key: string) {
  // Keep pg_advisory_xact_lock's void result inside a materialized CTE so
  // Prisma only has to deserialize the integer returned by the outer query.
  await tx.$queryRaw`WITH advisory_lock AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(hashtext(${key}))
  )
  SELECT 1::int AS locked FROM advisory_lock`;
}

const bookSchema = z.object({
  slotId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
  couponCode: z.string().trim().max(50).transform((value) => value.toUpperCase()).optional(),
});

const queueBookingSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
});

// Books a slot atomically. The key to preventing double-booking under
// concurrent requests is a single conditional UPDATE: we only flip
// isBooked to true if it is currently false, and check the affected row
// count. If two requests race for the same slot, only one UPDATE matches
// a row, so only one booking succeeds -- no lost updates, no lock needed.
export async function bookAppointment(req: Request, res: Response) {
  const { slotId, notes, couponCode } = bookSchema.parse(req.body);

  // 1. Pre-fetch targetSlot with joined staff and business before transaction to avoid multi-hop round trips
  const targetSlot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: {
      staff: {
        include: {
          business: { include: { category: true } },
          user: true,
        },
      },
      service: true,
    },
  });

  if (!targetSlot) {
    throw new ApiError(404, "Slot not found");
  }

  const staff = targetSlot.staff;
  const business = staff.business;
  if (targetSlot.service.businessId !== staff.businessId || !targetSlot.service.active) {
    throw new ApiError(400, "This slot is not available for the selected service");
  }
  if (business.status !== "ACTIVE") {
    throw new ApiError(400, "This business is not available for bookings yet.");
  }

  const tokenFlow = usesTokenQueue(business.category?.bookingMode);
  if (tokenFlow) throw new ApiError(400, "Queue services must be booked by date, not by selecting a time slot.");

  const now = new Date();
  if (targetSlot.startTime <= now) {
    throw new ApiError(400, "This appointment time has passed. Please choose a later slot.");
  }

  // Overlapping customer booking validation.
  const overlappingAppointment = await prisma.appointment.findFirst({
    where: {
      customerId: req.user!.userId,
      status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
      slotId: { not: targetSlot.id },
      slot: {
        startTime: { lt: targetSlot.endTime },
        endTime: { gt: targetSlot.startTime },
      },
    },
    include: { slot: true, service: true },
  });

  if (overlappingAppointment) {
    if (!overlappingAppointment.slot) throw new ApiError(409, "The conflicting booking has no appointment time.");
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

  // Coupon validation.
  let coupon: any = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      throw new ApiError(400, "Invalid or expired coupon code");
    }
    if (coupon.businessId !== staff.businessId) {
      throw new ApiError(400, "Coupon is not valid for this business");
    }

    const existing = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId: req.user!.userId } },
    });
    if (existing) {
      throw new ApiError(400, "You have already used this coupon");
    }

    if (coupon.maxRedemptions) {
      const count = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
      if (count >= coupon.maxRedemptions) {
        throw new ApiError(400, "Coupon redemption limit reached");
      }
    }
  }

  // Atomic transaction: serialize both this customer's bookings and this
  // staff member's calendar before checking overlap and claiming the slot.
  const appointment = await prisma.$transaction(
    async (tx: Tx) => {
      // Serialize bookings for one customer so simultaneous requests cannot
      // bypass the overlap check on different slots.
      await acquireBookingLock(tx, req.user!.userId);
      await acquireBookingLock(tx, targetSlot.staffId);
      const transactionConflict = await tx.appointment.findFirst({
        where: {
          customerId: req.user!.userId,
          status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
          slotId: { not: targetSlot.id },
          slot: { startTime: { lt: targetSlot.endTime }, endTime: { gt: targetSlot.startTime } },
        },
      });
      if (transactionConflict) {
        throw new ApiError(409, "You already have an active booking that overlaps this time");
      }

      const staffConflict = await tx.appointment.findFirst({
        where: {
          staffId: targetSlot.staffId,
          status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
          slotId: { not: targetSlot.id },
          slot: { startTime: { lt: targetSlot.endTime }, endTime: { gt: targetSlot.startTime } },
        },
      });
      if (staffConflict) throw new ApiError(409, "This staff member is already booked during that time.");

      if (coupon) {
        await acquireBookingLock(tx, coupon.id);
        const [alreadyRedeemed, redemptionCount] = await Promise.all([
          tx.couponRedemption.findUnique({
            where: { couponId_userId: { couponId: coupon.id, userId: req.user!.userId } },
          }),
          tx.couponRedemption.count({ where: { couponId: coupon.id } }),
        ]);
        if (alreadyRedeemed) throw new ApiError(409, "You have already used this coupon");
        if (coupon.maxRedemptions && redemptionCount >= coupon.maxRedemptions) {
          throw new ApiError(409, "Coupon redemption limit reached");
        }
      }

      const updateResult = await tx.slot.updateMany({
        where: { id: slotId, isBooked: false },
        data: { isBooked: true },
      });

      if (updateResult.count === 0) {
        throw new ApiError(409, "This slot was just booked by someone else. Please pick another.");
      }

      const appointmentData = {
        customerId: req.user!.userId,
        businessId: staff.businessId,
        staffId: targetSlot.staffId,
        serviceId: targetSlot.serviceId,
        notes,
        couponId: coupon?.id,
        status: "CONFIRMED" as const,
        tokenDate: null,
        tokenNumber: null,
        qrCode: crypto.randomUUID(),
        checkedInAt: null,
      };

      const newAppointment = await tx.appointment.create({
        data: { ...appointmentData, slotId: targetSlot.id },
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
    },
    { maxWait: 15000, timeout: 25000 }
  );

  try {
    await notify({
      appointmentId: appointment.id,
      userId: appointment.customerId,
      to: appointment.customer.email,
      subject: "Appointment confirmed",
      message: `Your ${appointment.service.name} appointment is confirmed for ${appointment.slot!.startTime.toLocaleString()} with ${appointment.staff!.user.name}.`,
    });
  } catch (notifyErr) {
    console.error("Booking notification error (non-fatal):", notifyErr);
  }

  res.status(201).json(appointment);
}

export async function bookQueueAppointment(req: Request, res: Response) {
  const { serviceId, date, notes } = queueBookingSchema.parse(req.body);
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { business: { include: { category: true, businessHours: true, settings: true } } },
  });
  if (!service || !service.active) throw new ApiError(404, "Service not found or unavailable");
  const business = service.business;
  if (business.status !== "ACTIVE") throw new ApiError(400, "This business is not available for bookings yet.");
  if (!usesTokenQueue(business.category?.bookingMode)) throw new ApiError(400, "This service requires an appointment time.");

  const localDay = DateTime.fromISO(date, { zone: business.timezone });
  const today = DateTime.now().setZone(business.timezone).toISODate();
  if (!localDay.isValid || localDay.toISODate() !== date || date < (today || "")) {
    throw new ApiError(400, "Choose a valid date today or later in the business timezone.");
  }
  const dayOfWeek = localDay.weekday % 7;
  if (!business.businessHours.some((hours) => hours.dayOfWeek === dayOfWeek)) {
    throw new ApiError(400, "The business is closed on the selected date.");
  }

  const activeStatuses = ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] as const;
  const existing = await prisma.appointment.findFirst({
    where: { customerId: req.user!.userId, serviceId, tokenDate: date, status: { in: [...activeStatuses] } },
    include: { service: true, slot: true, staff: { include: { user: true } }, customer: true, business: true },
  });
  if (existing) return res.json(existing);

  const appointment = await prisma.$transaction(async (tx: Tx) => {
    await acquireBookingLock(tx, req.user!.userId);
    await acquireBookingLock(tx, `${business.id}:${date}`);
    const concurrentDuplicate = await tx.appointment.findFirst({
      where: { customerId: req.user!.userId, serviceId, tokenDate: date, status: { in: [...activeStatuses] } },
      include: { service: true, slot: true, staff: { include: { user: true } }, customer: true, business: true },
    });
    if (concurrentDuplicate) return concurrentDuplicate;

    const sequence = await tx.businessTokenSequence.upsert({
      where: { businessId_tokenDate: { businessId: business.id, tokenDate: date } },
      create: { businessId: business.id, tokenDate: date, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    return tx.appointment.create({
      data: {
        customerId: req.user!.userId,
        businessId: business.id,
        serviceId,
        staffId: null,
        slotId: null,
        tokenDate: date,
        tokenNumber: sequence.nextNumber - 1,
        notes,
        status: "CONFIRMED",
        qrCode: crypto.randomUUID(),
      },
      include: { service: true, slot: true, staff: { include: { user: true } }, customer: true, business: true },
    });
  }, { maxWait: 15000, timeout: 25000 });

  try {
    await notify({
      appointmentId: appointment.id,
      userId: appointment.customerId,
      to: appointment.customer.email,
      subject: "Queue token confirmed",
      message: `Your ${appointment.service.name} queue token is #${appointment.tokenNumber} for ${date} at ${business.name}. Please arrive during the business's opening hours.`,
    });
  } catch (notifyErr) {
    console.error("Queue booking notification error (non-fatal):", notifyErr);
  }
  res.status(201).json(appointment);
}

export async function cancelAppointment(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { customer: true, service: true, slot: true, payment: true, business: { include: { settings: true, businessHours: true } } },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const isOwner = appointment.customerId === req.user!.userId;
  const isPrivileged = req.user!.role === "ADMIN" || req.user!.role === "STAFF";
  if (!isOwner && !isPrivileged) throw new ApiError(403, "Not your appointment");
  if (isPrivileged && !isOwner) await assertCanManageAppointment(req, appointment);
  if (appointment.status === "CANCELLED") return res.json({ message: "Appointment already cancelled" });
  if (["COMPLETED", "ATTENDED", "NO_SHOW"].includes(appointment.status)) {
    throw new ApiError(409, `Cannot cancel an appointment with status ${appointment.status}`);
  }

  let cancellationDeadline: Date | null = null;
  if (appointment.slot) {
    cancellationDeadline = new Date(appointment.slot.startTime.getTime() - (appointment.business.settings?.cancellationCutoffMinutes ?? 120) * 60_000);
  } else if (appointment.tokenDate) {
    const day = DateTime.fromISO(appointment.tokenDate, { zone: appointment.business.timezone });
    const hours = appointment.business.businessHours.find((item) => item.dayOfWeek === day.weekday % 7);
    if (hours) {
      const [hour, minute] = hours.startTime.split(":").map(Number);
      cancellationDeadline = day.set({ hour, minute }).minus({ minutes: appointment.business.settings?.cancellationCutoffMinutes ?? 120 }).toJSDate();
    }
  }
  const withinCancellationWindow = !cancellationDeadline || Date.now() < cancellationDeadline.getTime();
  if (isOwner && !withinCancellationWindow) {
    throw new ApiError(409, `Online cancellation closes ${appointment.business.settings?.cancellationCutoffMinutes ?? 120} minutes before the service starts. Contact the business for help.`);
  }

  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
      },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count === 0) throw new ApiError(409, "Appointment state changed; refresh and try again");
    if (appointment.slotId) await tx.slot.update({ where: { id: appointment.slotId }, data: { isBooked: false } });
    await tx.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } });
  });

  let refund: { refundAmount?: number; refundStatus: string; error?: string } | null = null;
  if (appointment.payment?.status === "PAID" && (isPrivileged || withinCancellationWindow)) {
    refund = await processCancellationRefund(appointment.id);
  }

  try {
    await notify({
      userId: appointment.customerId,
      appointmentId: appointment.id,
      to: appointment.customer.email,
      subject: `Booking cancelled — ${appointment.service.name}`,
      message: appointment.slot
        ? `Your appointment for ${appointment.service.name} at ${appointment.business.name} on ${appointment.slot.startTime.toLocaleString()} has been cancelled.`
        : `Your queue booking for ${appointment.service.name} at ${appointment.business.name} on ${appointment.tokenDate} has been cancelled.`,
    });
  } catch (error) {
    console.error("Cancellation notification failed (non-fatal):", error);
  }

  // Notify anyone waitlisted for this service on the same day that a slot opened up.
  if (!appointment.slot) {
    res.json({ message: "Appointment cancelled", refund });
    return;
  }

  const businessDate = DateTime.fromJSDate(appointment.slot.startTime).setZone(appointment.business.timezone).toISODate()!;
  const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${DateTime.fromISO(businessDate, { zone: "UTC" }).plus({ days: 1 }).toISODate()}T00:00:00.000Z`);

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
      try {
        await notify({
          userId: w.customerId,
          to: w.customer.email,
          subject: `A slot opened up — ${appointment.service.name}`,
          message: `Good news — a ${appointment.service.name} slot just opened at ${appointment.business.name} on ${businessDate}. Book it before it's gone: ${process.env.FRONTEND_URL}/book/${business?.slug}?service=${appointment.serviceId}&date=${businessDate}&slot=${appointment.slotId}`,
        });
        await prisma.waitlistEntry.update({ where: { id: w.id }, data: { notified: true } });
      } catch (error) {
        console.error(`Waitlist notification failed (entry=${w.id}):`, error);
      }
    }
  }

  res.json({ message: "Appointment cancelled", refund });
}

const rescheduleSchema = z.object({
  newSlotId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((data) => Boolean(data.newSlotId) !== Boolean(data.date), "Choose a new slot or queue date");

export async function rescheduleAppointment(req: Request, res: Response) {
  const { newSlotId, date } = rescheduleSchema.parse(req.body);

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { slot: true, business: { include: { category: true, businessHours: true, settings: true } } },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.customerId !== req.user!.userId) throw new ApiError(403, "Not your appointment");
  if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
    throw new ApiError(409, `Cannot reschedule an appointment with status ${appointment.status}`);
  }

  const isQueue = usesTokenQueue(appointment.business.category?.bookingMode);
  const cutoffMinutes = appointment.business.settings?.cancellationCutoffMinutes ?? 120;
  const currentBookingStart = appointment.slot?.startTime || (appointment.tokenDate
    ? (() => {
        const tokenDay = DateTime.fromISO(appointment.tokenDate, { zone: appointment.business.timezone });
        const opening = appointment.business.businessHours.find((hours) => hours.dayOfWeek === tokenDay.weekday % 7);
        if (!opening) return null;
        const [hour, minute] = opening.startTime.split(":").map(Number);
        return tokenDay.set({ hour, minute }).toJSDate();
      })()
    : null);
  if (currentBookingStart && Date.now() >= currentBookingStart.getTime() - cutoffMinutes * 60_000) {
    throw new ApiError(409, `Online rescheduling closes ${cutoffMinutes} minutes before the service starts.`);
  }
  if (isQueue) {
    if (!date || newSlotId) throw new ApiError(400, "Choose a new queue date.");
    const day = DateTime.fromISO(date, { zone: appointment.business.timezone });
    const today = DateTime.now().setZone(appointment.business.timezone).toISODate();
    if (!day.isValid || day.toISODate() !== date || date < (today || "")) {
      throw new ApiError(400, "Choose a valid date today or later in the business timezone.");
    }
    if (!appointment.business.businessHours.some((hours) => hours.dayOfWeek === day.weekday % 7)) {
      throw new ApiError(400, "The business is closed on the selected date.");
    }
    const duplicate = await prisma.appointment.findFirst({
      where: {
        id: { not: appointment.id }, customerId: req.user!.userId,
        serviceId: appointment.serviceId, tokenDate: date,
        status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
      },
    });
    if (duplicate) throw new ApiError(409, "You already have a queue token for this service and date.");

    const moved = await prisma.$transaction(async (tx: Tx) => {
      await acquireBookingLock(tx, req.user!.userId);
      await acquireBookingLock(tx, `${appointment.businessId}:${date}`);
      const concurrentDuplicate = await tx.appointment.findFirst({
        where: {
          id: { not: appointment.id }, customerId: req.user!.userId,
          serviceId: appointment.serviceId, tokenDate: date,
          status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
        },
      });
      if (concurrentDuplicate) throw new ApiError(409, "You already have a queue token for this service and date.");
      const sequence = await tx.businessTokenSequence.upsert({
        where: { businessId_tokenDate: { businessId: appointment.businessId, tokenDate: date } },
        create: { businessId: appointment.businessId, tokenDate: date, nextNumber: 2 },
        update: { nextNumber: { increment: 1 } },
      });
      await tx.checkIn.deleteMany({ where: { bookingId: appointment.id } });
      await tx.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } });
      return tx.appointment.update({
        where: { id: appointment.id },
        data: { tokenDate: date, tokenNumber: sequence.nextNumber - 1, status: "CONFIRMED", checkedInAt: null },
        include: { service: true, slot: true, staff: true, customer: true, business: true },
      });
    });
    await notify({
      userId: moved.customerId, appointmentId: moved.id, to: moved.customer.email,
      subject: `Queue booking rescheduled — ${moved.service.name}`,
      message: `Your queue booking at ${moved.business.name} has been moved to ${date}. Your new token is #${moved.tokenNumber}.`,
    }).catch((error) => console.error("Queue reschedule notification failed:", error));
    return res.json(moved);
  }

  if (!newSlotId || date) throw new ApiError(400, "Choose a new appointment time.");
  if (!appointment.slotId) throw new ApiError(409, "This appointment has no reschedulable time slot.");
  const proposedSlot = await prisma.slot.findUnique({
    where: { id: newSlotId },
    include: { staff: true, service: true },
  });
  if (!proposedSlot || proposedSlot.staff.businessId !== appointment.businessId) {
    throw new ApiError(400, "The new slot does not belong to this business");
  }
  if (proposedSlot.serviceId !== appointment.serviceId || !proposedSlot.service.active) {
    throw new ApiError(400, "Choose a slot for the same active service");
  }
  if (proposedSlot.startTime <= new Date()) throw new ApiError(400, "Choose a future slot");

  const tokenFlow = usesTokenQueue(appointment.business.category?.bookingMode);
  if (tokenFlow) throw new ApiError(400, "Queue bookings must be rescheduled to another date.");

  const updated = await prisma.$transaction(async (tx: Tx) => {
    await acquireBookingLock(tx, req.user!.userId);
    await acquireBookingLock(tx, proposedSlot.staffId);
    const customerConflict = await tx.appointment.findFirst({
      where: {
        customerId: req.user!.userId,
        id: { not: appointment.id },
        status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
        slot: { startTime: { lt: proposedSlot.endTime }, endTime: { gt: proposedSlot.startTime } },
      },
    });
    if (customerConflict) throw new ApiError(409, "You already have another booking at that time.");
    const staffConflict = await tx.appointment.findFirst({
      where: {
        staffId: proposedSlot.staffId,
        id: { not: appointment.id },
        status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
        slot: { startTime: { lt: proposedSlot.endTime }, endTime: { gt: proposedSlot.startTime } },
      },
    });
    if (staffConflict) throw new ApiError(409, "That staff member is already booked during the selected time.");
    const claim = await tx.slot.updateMany({
      where: { id: newSlotId, isBooked: false },
      data: { isBooked: true },
    });
    if (claim.count === 0) throw new ApiError(409, "That slot is no longer available");

    await tx.slot.update({ where: { id: appointment.slotId! }, data: { isBooked: false } });
    await tx.appointmentReminder.deleteMany({ where: { appointmentId: appointment.id } });

    const newSlot = await tx.slot.findUniqueOrThrow({ where: { id: newSlotId } });
    const moved = await tx.appointment.updateMany({
      where: { id: appointment.id, status: { in: ["PENDING", "CONFIRMED"] } },
      data: {
        slotId: newSlot.id,
        staffId: newSlot.staffId,
        serviceId: newSlot.serviceId,
        status: "CONFIRMED",
        tokenDate: null,
        tokenNumber: null,
      },
    });
    if (moved.count === 0) throw new ApiError(409, "Appointment state changed; refresh and try again");
    return tx.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { service: true, slot: true, customer: true, business: true },
    });
  });

  try {
    await notify({
      userId: updated.customerId,
      appointmentId: updated.id,
      to: updated.customer.email,
      subject: `Booking rescheduled — ${updated.service.name}`,
      message: `Your appointment for ${updated.service.name} at ${updated.business.name} has been moved to ${updated.slot!.startTime.toLocaleString()}.`,
    });
  } catch (error) {
    console.error("Reschedule notification failed (non-fatal):", error);
  }

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

  if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(appointment.status)) {
    throw new ApiError(409, `Cannot complete an appointment with status ${appointment.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.appointment.updateMany({
      where: { id: appointment.id, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
      data: { status: "COMPLETED" },
    });
    if (!claim.count) throw new ApiError(409, "Booking state changed; refresh and try again.");
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
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

// Legacy staff scanner flow: mark arrival without awarding completion points.
export async function checkIn(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({ where: { qrCode: req.params.qrCode } });
  if (!appointment) throw new ApiError(404, "Invalid QR code");
  if (appointment.checkedInAt) throw new ApiError(409, "Already checked in");

  await assertCanManageAppointment(req, appointment);

  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: appointment.id },
      data: { checkedInAt: new Date(), status: "CHECKED_IN" },
    });
    return appt;
  });

  // Trigger 90% token fee refund upon verified arrival
  await processCheckInRefund(appointment.id);

  res.json(updated);
}
