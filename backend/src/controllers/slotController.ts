import { Request, Response } from "express";
import { z } from "zod";
import { BusinessHours } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { usesTokenQueue } from "../domain/bookingRules";
import { notify } from "../services/notificationService";

const generateSchema = z.object({
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  daysAhead: z.number().int().min(1).max(60).default(14),
});

export async function generateSlots(req: Request, res: Response) {
  const { staffId, serviceId, daysAhead } = generateSchema.parse(req.body);

  const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
  if (!business) throw new ApiError(404, "You don't own a business");

  const [staff, service, hours, settings] = await Promise.all([
    prisma.staffProfile.findFirst({ where: { id: staffId, businessId: business.id, active: true } }),
    prisma.service.findFirst({ where: { id: serviceId, businessId: business.id }, include: { business: { include: { category: true } } } }),
    prisma.businessHours.findMany({ where: { businessId: business.id } }),
    prisma.businessSettings.findUnique({ where: { businessId: business.id } }),
  ]);
  if (!staff) throw new ApiError(404, "Staff member not found");
  if (!service) throw new ApiError(404, "Service not found");
  if (service.business.category?.bookingMode === "QUEUE") {
    throw new ApiError(400, "Queue services use business hours and do not need generated appointment slots.");
  }
  if (hours.length === 0) throw new ApiError(400, "Set business hours before generating slots");

  await prisma.slot.deleteMany({
    where: {
      staffId,
      serviceId,
      startTime: { gte: new Date() },
      isBooked: false,
      appointments: { none: {} },
    },
  });

  const hoursByDay = new Map<number, BusinessHours>(hours.map((h) => [h.dayOfWeek, h]));
  const slotsToCreate: { staffId: string; serviceId: string; startTime: Date; endTime: Date }[] = [];

  const now = DateTime.now();
  const businessNow = now.setZone(business.timezone);
  if (!businessNow.isValid) throw new ApiError(400, `Invalid business timezone: ${business.timezone}`);

  for (let d = 0; d < daysAhead; d++) {
    const day = businessNow.startOf("day").plus({ days: d });
    const dayHours = hoursByDay.get(day.weekday % 7);
    if (!dayHours) continue; // business closed that day

    const [startH, startM] = dayHours.startTime.split(":").map(Number);
    const [endH, endM] = dayHours.endTime.split(":").map(Number);

    let cursor = day.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
    const dayEnd = day.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });

    while (cursor.plus({ minutes: service.durationMin }) <= dayEnd) {
      if (cursor > now) {
        const slotEnd = cursor.plus({ minutes: service.durationMin });
        const breaks = [
          [settings?.breakfastStart, settings?.breakfastEnd],
          [settings?.lunchStart, settings?.lunchEnd],
          [settings?.dinnerStart, settings?.dinnerEnd],
        ].filter(([start, end]) => start && end);
        const overlapsBreak = breaks.some(([breakStart, breakEnd]) => {
          const [startH, startM] = String(breakStart).split(":").map(Number);
          const [endH, endM] = String(breakEnd).split(":").map(Number);
          const breakStartDate = day.set({ hour: startH, minute: startM, second: 0, millisecond: 0 });
          const breakEndDate = day.set({ hour: endH, minute: endM, second: 0, millisecond: 0 });
          return cursor < breakEndDate && slotEnd > breakStartDate;
        });
        if (!overlapsBreak) {
          slotsToCreate.push({
            staffId,
            serviceId,
            startTime: cursor.toJSDate(),
            endTime: slotEnd.toJSDate(),
          });
        }
      }
      cursor = cursor.plus({ minutes: service.durationMin });
    }
  }

  // This unique key prevents regenerating a duplicate slot for one service,
  // while allowing different services to share the same candidate start time.
  const result = await prisma.slot.createMany({ data: slotsToCreate, skipDuplicates: true });
  if (result.count > 0) {
    const availableDates = [...new Set(slotsToCreate.map((slot) => DateTime.fromJSDate(slot.startTime).setZone(business.timezone).toISODate()).filter((date): date is string => Boolean(date)))];
    for (const date of availableDates) {
      const preferredDate = new Date(`${date}T00:00:00.000Z`);
      const entries = await prisma.waitlistEntry.findMany({
        where: { serviceId, businessId: business.id, preferredDate, notified: false },
        include: { customer: true },
      });
      for (const entry of entries) {
        try {
          await notify({
            userId: entry.customerId,
            to: entry.customer.email,
            subject: `Appointments opened — ${service.name}`,
            message: `Appointments for ${service.name} at ${business.name} are now available on ${date}. Choose a time before it is taken: ${process.env.FRONTEND_URL}/book/${business.slug}?service=${serviceId}&date=${date}`,
          });
          await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { notified: true } });
        } catch (error) {
          console.error(`Waitlist notification failed (entry=${entry.id}):`, error);
        }
      }
    }
  }
  res.status(201).json({ createdCount: result.count });
}

// Public: real-time availability for a service, optionally filtered by staff.
export async function getAvailability(req: Request, res: Response) {
  const { serviceId, staffId, from, to } = req.query;
  if (!serviceId) throw new ApiError(400, "serviceId is required");

  const now = new Date();
  const requestedFrom = from ? new Date(String(from)) : now;
  const availabilityFrom = requestedFrom > now ? requestedFrom : now;
  const service = await prisma.service.findUnique({
    where: { id: String(serviceId) },
    include: { business: { include: { category: true } } },
  });
  if (!service) throw new ApiError(404, "Service not found");
  const tokenFlow = usesTokenQueue(service.business.category?.bookingMode);

  const slots = await prisma.slot.findMany({
    where: {
      serviceId: String(serviceId),
      staffId: staffId ? String(staffId) : undefined,
      ...(tokenFlow ? {} : { isBooked: false }),
      ...(tokenFlow
        ? { endTime: { gt: availabilityFrom, lte: to ? new Date(String(to)) : undefined } }
        : { startTime: { gte: availabilityFrom, lte: to ? new Date(String(to)) : undefined } }),
    },
    include: { staff: { include: { user: { select: { name: true } } } } },
    orderBy: { startTime: "asc" },
    take: 1000,
  });

  const firstStart = slots[0]?.startTime;
  const lastEnd = slots.reduce<Date | undefined>((latest, slot) =>
    !latest || slot.endTime > latest ? slot.endTime : latest, undefined);
  if (firstStart && lastEnd && !tokenFlow) {
    const conflicts = await prisma.appointment.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"] },
        slot: { startTime: { lt: lastEnd }, endTime: { gt: firstStart } },
      },
      select: { slotId: true },
    });
    const occupiedSlotIds = new Set(conflicts.map((appointment) => appointment.slotId).filter((id): id is string => !!id));
    const availableSlots = slots.filter((slot) => !occupiedSlotIds.has(slot.id));
    return res.json(availableSlots.slice(0, 200));
  }

  res.json(slots.slice(0, 200));
}
