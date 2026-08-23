import { Request, Response } from "express";
import { z } from "zod";
import { BusinessHours } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

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

  const now = new Date();
  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const dayHours = hoursByDay.get(day.getDay());
    if (!dayHours) continue; // business closed that day

    const [startH, startM] = dayHours.startTime.split(":").map(Number);
    const [endH, endM] = dayHours.endTime.split(":").map(Number);

    const cursor = new Date(day);
    cursor.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(endH, endM, 0, 0);

    while (cursor.getTime() + service.durationMin * 60000 <= dayEnd.getTime()) {
      if (cursor > now) {
        const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);
        const breaks = [
          [settings?.breakfastStart, settings?.breakfastEnd],
          [settings?.lunchStart, settings?.lunchEnd],
          [settings?.dinnerStart, settings?.dinnerEnd],
        ].filter(([start, end]) => start && end);
        const overlapsBreak = breaks.some(([breakStart, breakEnd]) => {
          const [startH, startM] = String(breakStart).split(":").map(Number);
          const [endH, endM] = String(breakEnd).split(":").map(Number);
          const breakStartDate = new Date(day);
          breakStartDate.setHours(startH, startM, 0, 0);
          const breakEndDate = new Date(day);
          breakEndDate.setHours(endH, endM, 0, 0);
          return cursor < breakEndDate && slotEnd > breakStartDate;
        });
        if (!overlapsBreak) {
          slotsToCreate.push({
            staffId,
            serviceId,
            startTime: new Date(cursor),
            endTime: slotEnd,
          });
        }
      }
      cursor.setMinutes(cursor.getMinutes() + service.durationMin);
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

  const slots = await prisma.slot.findMany({
    where: {
      serviceId: String(serviceId),
      staffId: staffId ? String(staffId) : undefined,
      isBooked: false,
      startTime: {
        gte: from ? new Date(String(from)) : new Date(),
        lte: to ? new Date(String(to)) : undefined,
      },
    },
    include: { staff: { include: { user: { select: { name: true } } } } },
    orderBy: { startTime: "asc" },
    take: 200,
  });

  res.json(slots);
}
