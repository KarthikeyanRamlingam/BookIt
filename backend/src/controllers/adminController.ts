import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

export async function listBusinessApplications(req: Request, res: Response) {
  const status = z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "REJECTED"]).optional().parse(req.query.status);
  const search = z.string().trim().optional().parse(req.query.q);
  const businesses = await prisma.business.findMany({
    where: {
      status: status || "PENDING_VERIFICATION",
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { state: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
              { owner: { name: { contains: search, mode: "insensitive" } } },
              { owner: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      owner: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      _count: { select: { services: true, staff: true, appointments: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(businesses);
}

const decisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
});

export async function decideBusinessApplication(req: Request, res: Response) {
  const { action } = decisionSchema.parse(req.body);
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) throw new ApiError(404, "Business application not found");
  if (business.status !== "PENDING_VERIFICATION") {
    throw new ApiError(409, `Business is already ${business.status.toLowerCase()}`);
  }

  const updated = await prisma.business.update({
    where: { id: business.id },
    data: { status: action === "APPROVE" ? "ACTIVE" : "REJECTED" },
    include: { category: true, owner: { select: { name: true, email: true } } },
  });
  res.json(updated);
}

export async function deleteBusiness(req: Request, res: Response) {
  const business = await prisma.business.findUnique({
    where: { id: req.params.id },
    select: { id: true, ownerId: true },
  });
  if (!business) throw new ApiError(404, "Business not found");

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { appointment: { businessId: business.id } } });
    await tx.appointmentReminder.deleteMany({ where: { appointment: { businessId: business.id } } });
    await tx.checkIn.deleteMany({ where: { businessId: business.id } });
    await tx.checkInSession.deleteMany({ where: { businessId: business.id } });
    await tx.payment.deleteMany({ where: { appointment: { businessId: business.id } } });
    await tx.review.deleteMany({ where: { businessId: business.id } });
    await tx.appointment.deleteMany({ where: { businessId: business.id } });
    await tx.slot.deleteMany({ where: { staff: { businessId: business.id } } });
    await tx.slot.deleteMany({ where: { service: { businessId: business.id } } });
    await tx.couponRedemption.deleteMany({ where: { coupon: { businessId: business.id } } });
    await tx.coupon.deleteMany({ where: { businessId: business.id } });
    await tx.waitlistEntry.deleteMany({ where: { businessId: business.id } });
    await tx.businessHours.deleteMany({ where: { businessId: business.id } });
    await tx.businessSettings.deleteMany({ where: { businessId: business.id } });
    await tx.businessTokenSequence.deleteMany({ where: { businessId: business.id } });
    await tx.staffProfile.deleteMany({ where: { businessId: business.id } });
    await tx.service.deleteMany({ where: { businessId: business.id } });
    await tx.business.delete({ where: { id: business.id } });
    await tx.user.update({ where: { id: business.ownerId }, data: { role: "CUSTOMER" } });
  });

  res.json({ message: "Business deleted" });
}
