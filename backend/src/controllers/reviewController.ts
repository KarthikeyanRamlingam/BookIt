import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

const reviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// A customer can review an appointment only after it's COMPLETED, and only
// once -- Review.appointmentId is @unique in the schema, so a second
// attempt would hit a Prisma P2002 error (handled generically by
// errorHandler) if this check somehow got bypassed. We check explicitly
// here first so the customer gets a clear message instead of a raw
// "duplicate value" error.
export async function createReview(req: Request, res: Response) {
  const { appointmentId, rating, comment } = reviewSchema.parse(req.body);

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { review: true },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.customerId !== req.user!.userId) throw new ApiError(403, "Not your appointment");
  if (appointment.status !== "COMPLETED") {
    throw new ApiError(400, "You can only review a completed appointment");
  }
  if (appointment.review) throw new ApiError(409, "You've already reviewed this appointment");

  const review = await prisma.review.create({
    data: {
      appointmentId,
      customerId: req.user!.userId,
      businessId: appointment.businessId,
      rating,
      comment,
    },
  });

  res.status(201).json(review);
}

// Public: reviews for a business, newest first, with the customer's first
// name only (not full name/email) to keep the storefront read-only view
// privacy-conscious.
export async function listBusinessReviews(req: Request, res: Response) {
  const business = await prisma.business.findUnique({ where: { slug: req.params.slug } });
  if (!business) throw new ApiError(404, "Business not found");

  const reviews = await prisma.review.findMany({
    where: { businessId: business.id },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  res.json({
    averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    count: reviews.length,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: r.customer.name.split(" ")[0], // first name only
    })),
  });
}