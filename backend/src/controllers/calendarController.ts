import { Request, Response } from "express";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { DateTime } from "luxon";
import {
  generateICSFile,
  generateBusinessCalendarFeed,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from "../services/calendarService";

function calendarWindow(appointment: any) {
  if (appointment.slot) return { startTime: appointment.slot.startTime, endTime: appointment.slot.endTime };
  if (!appointment.tokenDate) throw new ApiError(409, "This queue booking has no service date.");
  const day = DateTime.fromISO(appointment.tokenDate, { zone: appointment.business.timezone || "Asia/Kolkata" });
  const hours = appointment.business.businessHours?.find((entry: any) => entry.dayOfWeek === day.weekday % 7);
  if (!hours) throw new ApiError(409, "Business hours are not configured for this queue date.");
  const [openHour, openMinute] = hours.startTime.split(":").map(Number);
  const [closeHour, closeMinute] = hours.endTime.split(":").map(Number);
  return {
    startTime: day.set({ hour: openHour, minute: openMinute }).toJSDate(),
    endTime: day.set({ hour: closeHour, minute: closeMinute }).toJSDate(),
  };
}

async function assertCalendarAccess(user: NonNullable<Request["user"]>, appointment: { customerId: string; businessId: string }) {
  if (appointment.customerId === user.userId) return;
  if (user.role === "ADMIN") {
    const business = await prisma.business.findUnique({ where: { ownerId: user.userId }, select: { id: true } });
    if (business?.id === appointment.businessId) return;
  }
  if (user.role === "STAFF") {
    const staff = await prisma.staffProfile.findUnique({ where: { userId: user.userId }, select: { businessId: true } });
    if (staff?.businessId === appointment.businessId) return;
  }
  throw new ApiError(403, "Not authorized to access this calendar event");
}

export async function downloadAppointmentICS(req: Request, res: Response) {
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: true,
      business: { include: { businessHours: true } },
      staff: { include: { user: true } },
      customer: true,
      slot: true,
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");
  await assertCalendarAccess(req.user!, appointment);
  const window = calendarWindow(appointment);

  const icsContent = generateICSFile({
    id: appointment.id,
    title: `${appointment.service.name} at ${appointment.business.name}`,
    description: `BookIt ${appointment.tokenDate ? "queue booking" : "appointment"} for ${appointment.service.name}.\n${appointment.staff?.user?.name ? `Staff / Provider: ${appointment.staff.user.name}\n` : ""}Status: ${appointment.status}\nLocation: ${appointment.business.address || "Venue Address"}\nBooking QR Code: ${appointment.qrCode}`,
    location: appointment.business.address || `${appointment.business.name}, Bengaluru`,
    startTime: new Date(window.startTime),
    endTime: new Date(window.endTime),
    organizerName: appointment.business.name,
    status: appointment.status,
  });

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="appointment-${appointment.service.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ics"`
  );
  res.send(icsContent);
}

export async function getAppointmentCalendarLinks(req: Request, res: Response) {
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: true,
      business: { include: { businessHours: true } },
      staff: { include: { user: true } },
      slot: true,
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");
  await assertCalendarAccess(req.user!, appointment);
  const window = calendarWindow(appointment);

  const event = {
    id: appointment.id,
    title: `${appointment.service.name} at ${appointment.business.name}`,
    description: `BookIt ${appointment.tokenDate ? "queue booking" : "appointment"} for ${appointment.service.name}.${appointment.staff?.user?.name ? `\nProvider: ${appointment.staff.user.name}` : ""}\nAddress: ${appointment.business.address || ""}\nStatus: ${appointment.status}`,
    location: appointment.business.address || `${appointment.business.name}, Bengaluru`,
    startTime: new Date(window.startTime),
    endTime: new Date(window.endTime),
  };

  const googleUrl = generateGoogleCalendarUrl(event);
  const outlookUrl = generateOutlookCalendarUrl(event);
  const icsUrl = `${process.env.BACKEND_URL || "http://localhost:4000"}/api/calendar/appointment/${appointment.id}.ics`;

  res.json({
    googleUrl,
    outlookUrl,
    icsUrl,
  });
}

export async function getBusinessCalendarFeed(req: Request, res: Response) {
  const { slugOrId } = req.params;

  const business = await prisma.business.findFirst({
    where: {
      OR: [{ id: slugOrId }, { slug: slugOrId }],
    },
  });

  if (!business) throw new ApiError(404, "Business not found");

  if (req.user!.role === "ADMIN" && business.ownerId !== req.user!.userId) {
    throw new ApiError(403, "Not authorized to access this calendar feed");
  }
  if (req.user!.role === "STAFF") {
    const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user!.userId } });
    if (!staff || staff.businessId !== business.id) {
      throw new ApiError(403, "Not authorized to access this calendar feed");
    }
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30); // past 30 days
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90); // next 90 days

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      OR: [
        { slot: { startTime: { gte: windowStart, lte: windowEnd } } },
        { tokenDate: { gte: DateTime.fromJSDate(windowStart).setZone(business.timezone).toISODate()!, lte: DateTime.fromJSDate(windowEnd).setZone(business.timezone).toISODate()! } },
      ],
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      customer: { select: { name: true, email: true } },
      service: { select: { name: true } },
      slot: { select: { startTime: true, endTime: true } },
      business: { include: { businessHours: true } },
    },
    orderBy: [{ tokenDate: "asc" }, { createdAt: "asc" }],
  });

  const feedContent = generateBusinessCalendarFeed(business.name, appointments);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${business.slug}-calendar.ics"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(feedContent);
}
