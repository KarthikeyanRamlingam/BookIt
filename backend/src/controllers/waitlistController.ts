import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const joinSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  preferredDate: z.string(), // ISO date, e.g. "2026-07-20"
});

export async function joinWaitlist(req: Request, res: Response) {
  const data = joinSchema.parse(req.body);

  const entry = await prisma.waitlistEntry.create({
    data: {
      customerId: req.user!.userId,
      businessId: data.businessId,
      serviceId: data.serviceId,
      preferredDate: new Date(data.preferredDate),
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
