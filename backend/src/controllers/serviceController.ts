import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationMin: z.number().int().min(5),
  price: z.number().nonnegative(),
});

async function getOwnedBusinessId(userId: string) {
  const business = await prisma.business.findUnique({ where: { ownerId: userId } });
  if (!business) throw new ApiError(404, "You don't own a business");
  return business.id;
}

export async function createService(req: Request, res: Response) {
  const data = serviceSchema.parse(req.body);
  const businessId = await getOwnedBusinessId(req.user!.userId);

  const service = await prisma.service.create({
    data: { ...data, businessId },
  });
  res.status(201).json(service);
}

export async function updateService(req: Request, res: Response) {
  const data = serviceSchema.partial().parse(req.body);
  const businessId = await getOwnedBusinessId(req.user!.userId);

  const service = await prisma.service.findFirst({
    where: { id: req.params.id, businessId },
  });
  if (!service) throw new ApiError(404, "Service not found");

  const updated = await prisma.service.update({ where: { id: service.id }, data });
  res.json(updated);
}

export async function deleteService(req: Request, res: Response) {
  const businessId = await getOwnedBusinessId(req.user!.userId);
  const service = await prisma.service.findFirst({
    where: { id: req.params.id, businessId },
  });
  if (!service) throw new ApiError(404, "Service not found");

  // Soft-delete: keep historical appointments intact.
  await prisma.service.update({ where: { id: service.id }, data: { active: false } });
  res.json({ message: "Service deactivated" });
}

export async function listServices(req: Request, res: Response) {
  const businessId = await getOwnedBusinessId(req.user!.userId);
  const services = await prisma.service.findMany({ where: { businessId } });
  res.json(services);
}
