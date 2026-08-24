import { Request, Response } from "express";
import { prisma } from "../config/db";

// Public: every category currently in use, alphabetical. New categories
// appear here automatically the moment a business owner registers under
// a name that doesn't exist yet (see authController.registerBusinessOwner)
// -- there's no separate "admin creates a category" step required.
export const MEDICAL_SPECIALTY_SLUGS = [
  "doctor-appointment",
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
];

export async function listCategories(req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { businesses: { where: { status: "ACTIVE" } } } } },
  });

  // Calculate total doctor businesses across all medical specialty categories
  const totalDoctorBusinesses = categories
    .filter((c) => MEDICAL_SPECIALTY_SLUGS.includes(c.slug))
    .reduce((sum, c) => sum + c._count.businesses, 0);

  const result = categories.map((c) => {
    if (c.slug === "doctor-appointment") {
      return {
        ...c,
        _count: { businesses: totalDoctorBusinesses },
      };
    }
    return c;
  });

  res.json(result);
}