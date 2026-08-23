import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

const addStaffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  title: z.string().optional(),
});

// ADMIN adds a staff member. Generates a temporary password the staff
// member should reset on first login (in a full build, email it to them).
export async function addStaff(req: Request, res: Response) {
  const data = addStaffSchema.parse(req.body);

  const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
  if (!business) throw new ApiError(404, "You don't own a business");

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "A user with this email already exists");

  const tempPassword = crypto.randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const staffUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: "STAFF",
      staffProfile: {
        create: { businessId: business.id, title: data.title },
      },
    },
    include: { staffProfile: true },
  });

  // NOTE: wire this to the notification service (email) instead of returning
  // the password directly once SMTP is configured.
  res.status(201).json({
    staff: { id: staffUser.id, name: staffUser.name, email: staffUser.email },
    tempPassword,
  });
}

export async function listStaff(req: Request, res: Response) {
  const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
  if (!business) throw new ApiError(404, "You don't own a business");

  const staff = await prisma.staffProfile.findMany({
    where: { businessId: business.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(staff);
}

export async function removeStaff(req: Request, res: Response) {
  const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
  if (!business) throw new ApiError(404, "You don't own a business");

  const staff = await prisma.staffProfile.findFirst({
    where: { id: req.params.id, businessId: business.id },
  });
  if (!staff) throw new ApiError(404, "Staff member not found");

  await prisma.staffProfile.delete({ where: { id: staff.id } });
  res.json({ message: "Staff member removed" });
}
