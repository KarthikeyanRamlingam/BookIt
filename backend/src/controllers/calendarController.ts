import { Request, Response } from "express";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import {
  generateICSFile,
  generateBusinessCalendarFeed,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from "../services/calendarService";

export async function downloadAppointmentICS(req: Request, res: Response) {
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: true,
      business: true,
      staff: { include: { user: true } },
      customer: true,
      slot: true,
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");

  const icsContent = generateICSFile({
    id: appointment.id,
    title: `${appointment.service.name} at ${appointment.business.name}`,
    description: `BookIt Appointment for ${appointment.service.name}.\nStaff / Provider: ${appointment.staff.user.name}\nStatus: ${appointment.status}\nLocation: ${appointment.business.address || "Venue Address"}\nBooking QR Code: ${appointment.qrCode}`,
    location: appointment.business.address || `${appointment.business.name}, Bengaluru`,
    startTime: new Date(appointment.slot.startTime),
    endTime: new Date(appointment.slot.endTime),
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
      business: true,
      staff: { include: { user: true } },
      slot: true,
    },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");

  const event = {
    id: appointment.id,
    title: `${appointment.service.name} at ${appointment.business.name}`,
    description: `BookIt Appointment for ${appointment.service.name}.\nProvider: ${appointment.staff.user.name}\nAddress: ${appointment.business.address || ""}\nStatus: ${appointment.status}`,
    location: appointment.business.address || `${appointment.business.name}, Bengaluru`,
    startTime: new Date(appointment.slot.startTime),
    endTime: new Date(appointment.slot.endTime),
  };

  const googleUrl = generateGoogleCalendarUrl(event);
  const outlookUrl = generateOutlookCalendarUrl(event);
  const icsUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/calendar/appointment/${appointment.id}.ics`;

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

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30); // past 30 days
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 90); // next 90 days

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      slot: { startTime: { gte: windowStart, lte: windowEnd } },
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      customer: { select: { name: true, email: true } },
      service: { select: { name: true } },
      slot: { select: { startTime: true, endTime: true } },
      business: true,
    },
    orderBy: { slot: { startTime: "asc" } },
  });

  const feedContent = generateBusinessCalendarFeed(business.name, appointments);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${business.slug}-calendar.ics"`);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(feedContent);
}
