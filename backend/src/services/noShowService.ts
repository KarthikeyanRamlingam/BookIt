import { prisma } from "../config/db";

const NO_SHOW_ELIGIBLE_STATUSES = ["CONFIRMED", "CHECK_IN_PENDING"] as const;
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

export async function sweepNoShows(now = new Date()): Promise<number> {
  const settings = await prisma.businessSettings.findMany({
    where: { autoNoShow: true },
    select: {
      businessId: true,
      gracePeriodMinutes: true,
      business: { select: { category: { select: { slug: true } } } },
    },
  });

  let totalMarked = 0;

  for (const businessSettings of settings) {
    const candidates = await prisma.appointment.findMany({
      where: {
        businessId: businessSettings.businessId,
        status: { in: [...NO_SHOW_ELIGIBLE_STATUSES] },
        slot: { startTime: { lte: now } },
      },
      select: { id: true, slot: { select: { startTime: true, endTime: true } } },
    });

    const overdueIds = candidates
      .filter(({ slot }) => {
        const isTokenFlow = TOKEN_CATEGORY_SLUGS.has(businessSettings.business.category?.slug || "");
        const cutoff = isTokenFlow
          ? slot.endTime
          : new Date(slot.startTime.getTime() + businessSettings.gracePeriodMinutes * 60 * 1000);
        return now.getTime() >= cutoff.getTime();
      })
      .map(({ id }) => id);

    if (overdueIds.length === 0) continue;

    const { count } = await prisma.appointment.updateMany({
      where: {
        id: { in: overdueIds },
        status: { in: [...NO_SHOW_ELIGIBLE_STATUSES] },
      },
      data: { status: "NO_SHOW" },
    });

    await prisma.checkIn.updateMany({
      where: { bookingId: { in: overdueIds }, status: "PENDING" },
      data: {
        status: "REJECTED",
        verifiedAt: now,
        rejectionReason: "Appointment expired without arrival.",
      },
    });

    await prisma.payment.updateMany({
      where: {
        appointmentId: { in: overdueIds },
        status: "PAID",
        refundStatus: "NONE",
      },
      data: { refundStatus: "RETAINED_NO_SHOW" },
    });

    totalMarked += count;
  }

  return totalMarked;
}
