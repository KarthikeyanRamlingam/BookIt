import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { haversineKm } from "../utils/geo";

export async function getBusinessBySlug(req: Request, res: Response) {
  const business = await prisma.business.findUnique({
    where: { slug: req.params.slug, status: "ACTIVE" },
    include: {
      services: { where: { active: true } },
      staff: { include: { user: { select: { id: true, name: true } } } },
      businessHours: true,
      category: true,
    },
  });
  if (!business) throw new ApiError(404, "Business not found");
  res.json(business);
}

export async function getTokenPreview(req: Request, res: Response) {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
  const business = await prisma.business.findUnique({ where: { slug: req.params.slug, status: "ACTIVE" } });
  if (!business) throw new ApiError(404, "Business not found");

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const todayValues = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const today = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
  if (date < today) throw new ApiError(400, "Token booking is only available from today onwards.");

  const sequence = await prisma.businessTokenSequence.findUnique({
    where: { businessId_tokenDate: { businessId: business.id, tokenDate: date } },
  });
  res.json({ date, nextTokenNumber: sequence?.nextNumber || 1 });
}

const hoursSchema = z.object({
  hours: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
});

// ADMIN sets/replaces weekly working hours for their business.
export async function setBusinessHours(req: Request, res: Response) {
  const { hours } = hoursSchema.parse(req.body);
  const business = await prisma.business.findUnique({ where: { ownerId: req.user!.userId } });
  if (!business) throw new ApiError(404, "You don't own a business");

  await prisma.$transaction([
    prisma.businessHours.deleteMany({ where: { businessId: business.id } }),
    prisma.businessHours.createMany({
      data: hours.map((h) => ({ ...h, businessId: business.id })),
    }),
  ]);

  res.json({ message: "Business hours updated" });
}

export async function getMyBusiness(req: Request, res: Response) {
  const business = await prisma.business.findUnique({
    where: { ownerId: req.user!.userId },
    include: { services: true, staff: { include: { user: true } }, businessHours: true, category: true },
  });
  if (!business) throw new ApiError(404, "You don't own a business");
  res.json(business);
}

import { MEDICAL_SPECIALTY_SLUGS } from "./categoryController";

// Public: businesses in a category, optionally sorted by distance from a
// given lat/lng (and optionally capped to a radius). If lat/lng aren't
// provided, results come back unsorted by distance (alphabetical) so the
// endpoint still works as a plain category browse.
export async function getNearbyBusinesses(req: Request, res: Response) {
  const { categoryId, lat, lng, radiusKm } = req.query;
  if (!categoryId) throw new ApiError(400, "categoryId is required");

  // Check if requested category is doctor-appointment
  const targetCategory = await prisma.category.findUnique({ where: { id: String(categoryId) } });
  const isDoctorParent = targetCategory?.slug === "doctor-appointment";

  let categoryIdFilter: any = String(categoryId);
  if (isDoctorParent) {
    const medicalCategories = await prisma.category.findMany({
      where: {
        slug: {
          in: MEDICAL_SPECIALTY_SLUGS,
        },
      },
    });
    categoryIdFilter = { in: medicalCategories.map((c) => c.id) };
  }

  const businesses = await prisma.business.findMany({
    where: { categoryId: categoryIdFilter, status: "ACTIVE" },
    include: {
      category: true,
      services: { where: { active: true }, take: 3 },
    },
  });

  const hasOrigin = lat !== undefined && lng !== undefined;
  const originLat = hasOrigin ? Number(lat) : null;
  const originLng = hasOrigin ? Number(lng) : null;

  const withDistance = businesses.map((b) => {
    const distanceKm =
      hasOrigin && b.latitude !== null && b.longitude !== null
        ? Math.round(haversineKm(originLat!, originLng!, b.latitude, b.longitude) * 10) / 10
        : null;
    return { ...b, distanceKm };
  });

  const filtered = radiusKm
    ? withDistance.filter((b) => b.distanceKm === null || b.distanceKm <= Number(radiusKm))
    : withDistance;

  filtered.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return a.name.localeCompare(b.name);
    if (a.distanceKm === null) return 1; // businesses without coordinates sort last
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  res.json(filtered);
}