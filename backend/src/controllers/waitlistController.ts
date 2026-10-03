import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { DateTime } from "luxon";

const joinSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function joinWaitlist(req: Request, res: Response) {
  const data = joinSchema.parse(req.body);
  const service = await prisma.service.findFirst({
    where: { id: data.serviceId, businessId: data.businessId, active: true, business: { status: "ACTIVE" } },
    include: { business: { select: { timezone: true } } },
  });
  if (!service) throw new ApiError(400, "Service does not belong to this business or is inactive");

  const localDate = DateTime.fromISO(data.preferredDate, { zone: service.business.timezone });
  const today = DateTime.now().setZone(service.business.timezone).toISODate();
  if (!localDate.isValid || localDate.toISODate() !== data.preferredDate || data.preferredDate < (today || "")) {
    throw new ApiError(400, "Preferred date must be valid and today or later in the business timezone");
  }
  const preferredDate = new Date(`${data.preferredDate}T00:00:00.000Z`);

  const existing = await prisma.waitlistEntry.findFirst({
    where: { customerId: req.user!.userId, businessId: data.businessId, serviceId: data.serviceId, preferredDate },
  });
  if (existing) {
    if (existing.notified) {
      const rejoined = await prisma.waitlistEntry.update({ where: { id: existing.id }, data: { notified: false } });
      return res.status(200).json(rejoined);
    }
    throw new ApiError(409, "You are already on this waitlist");
  }

  const entry = await prisma.waitlistEntry.create({
    data: {
      customerId: req.user!.userId,
      businessId: data.businessId,
      serviceId: data.serviceId,
      preferredDate,
    },
  });

  res.status(201).json(entry);
}

export async function myWaitlistEntries(req: Request, res: Response) {
  const entries = await prisma.waitlistEntry.findMany({
    where: { customerId: req.user!.userId },
    include: { service: true, business: { select: { name: true, slug: true } } },
    orderBy: { preferredDate: "asc" },
  });
  res.json(entries);
}

export async function leaveWaitlist(req: Request, res: Response) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: req.params.id } });
  if (!entry || entry.customerId !== req.user!.userId) {
    return res.status(404).json({ error: "Waitlist entry not found" });
  }
  await prisma.waitlistEntry.delete({ where: { id: entry.id } });
  res.json({ message: "Removed from waitlist" });
}
