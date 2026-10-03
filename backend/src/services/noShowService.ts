import { prisma } from "../config/db";
import { DateTime } from "luxon";

const NO_SHOW_ELIGIBLE_STATUSES = ["CONFIRMED", "CHECK_IN_PENDING"] as const;
export async function sweepNoShows(now = new Date()): Promise<number> {
  const settings = await prisma.businessSettings.findMany({
    where: { autoNoShow: true },
    select: {
      businessId: true,
      gracePeriodMinutes: true,
      business: {
        select: {
          timezone: true,
          category: { select: { bookingMode: true } },
          businessHours: true,
        },
      },
    },
  });

  let totalMarked = 0;

  for (const businessSettings of settings) {
    const candidates = await prisma.appointment.findMany({
      where: {
        businessId: businessSettings.businessId,
        status: { in: [...NO_SHOW_ELIGIBLE_STATUSES] },
        OR: [
          { slot: { startTime: { lte: now } } },
          { tokenDate: { not: null } },
        ],
      },
      select: { id: true, slot: { select: { startTime: true, endTime: true } }, tokenDate: true },
    });

    const overdueIds = candidates
      .filter((appointment) => {
        const { slot } = appointment;
        const isQueue = businessSettings.business.category?.bookingMode === "QUEUE";
        if (isQueue) {
          if (appointment.tokenDate) {
            const weekday = DateTime.fromISO(appointment.tokenDate, { zone: businessSettings.business.timezone }).weekday % 7;
            const hours = businessSettings.business.businessHours.find((item) => item.dayOfWeek === weekday);
            if (!hours) return DateTime.fromISO(appointment.tokenDate, { zone: businessSettings.business.timezone }).endOf("day").toJSDate() <= now;
            const [hour, minute] = hours.endTime.split(":").map(Number);
            const cutoff = DateTime.fromISO(appointment.tokenDate, { zone: businessSettings.business.timezone }).set({ hour, minute }).toJSDate();
            return cutoff <= now;
          }
          if (slot) return slot.endTime <= now;
          return false;
        }
        if (!slot) return false;
        const cutoff = new Date(slot.startTime.getTime() + businessSettings.gracePeriodMinutes * 60 * 1000);
        return now.getTime() >= cutoff.getTime();
      })
      .map(({ id }) => id);

    if (overdueIds.length === 0) continue;

    for (const id of overdueIds) {
      const marked = await prisma.$transaction(async (tx) => {
        const claim = await tx.appointment.updateMany({
          where: { id, status: { in: [...NO_SHOW_ELIGIBLE_STATUSES] } },
          data: { status: "NO_SHOW" },
        });
        if (!claim.count) return false;
        await tx.checkIn.updateMany({
          where: { bookingId: id, status: "PENDING" },
          data: { status: "REJECTED", verifiedAt: now, rejectionReason: "Appointment expired without arrival." },
        });
        await tx.payment.updateMany({
          where: { appointmentId: id, status: "PAID", refundStatus: "NONE" },
          data: { refundStatus: "RETAINED_NO_SHOW" },
        });
        return true;
      });
      if (marked) totalMarked++;
    }
  }

  return totalMarked;
}
