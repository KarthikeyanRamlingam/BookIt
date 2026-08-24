import { Request, Response } from "express";
import { z } from "zod";
import { BusinessHours } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

const TOKEN_CATEGORY_SLUGS = new Set([
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
]);

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
    prisma.staffProfile.findFirst({ where: { id: staffId, businessId: business.id } }),
    prisma.service.findFirst({ where: { id: serviceId, businessId: business.id } }),
    prisma.businessHours.findMany({ where: { businessId: business.id } }),
    prisma.businessSettings.findUnique({ where: { businessId: business.id } }),
  ]);
  if (!staff) throw new ApiError(404, "Staff member not found");
  if (!service) throw new ApiError(404, "Service not found");
  if (hours.length === 0) throw new ApiError(400, "Set business hours before generating slots");

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

  // skipDuplicates relies on the @@unique([staffId, startTime]) constraint,
  // which is also our last line of defense against double-booking.
  const result = await prisma.slot.createMany({ data: slotsToCreate, skipDuplicates: true });
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
  const tokenFlow = TOKEN_CATEGORY_SLUGS.has(service.business.category?.slug || "");

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
    take: 200,
  });

  res.json(slots);
}
