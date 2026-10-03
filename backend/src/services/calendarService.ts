import { DateTime } from "luxon";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  organizerName?: string;
  organizerEmail?: string;
  status?: string;
}

/**
 * Formats a JavaScript Date to UTC iCalendar format: YYYYMMDDTHHmmssZ
 */
export function formatDateToICS(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Generates a 1-click Google Calendar web link.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const start = formatDateToICS(event.startTime);
  const end = formatDateToICS(event.endTime);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
    location: event.location || "BookIt Verified Venue",
    sprop: "name:BookIt",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a 1-click Outlook Live / Microsoft 365 web calendar link.
 */
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const start = event.startTime.toISOString();
  const end = event.endTime.toISOString();

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start,
    enddt: end,
    body: event.description,
    location: event.location || "BookIt Verified Venue",
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generates an RFC 5545 compliant .ics (iCalendar) file string for a single event.
 */
export function generateICSFile(event: CalendarEvent): string {
  const now = formatDateToICS(new Date());
  const start = formatDateToICS(event.startTime);
  const end = formatDateToICS(event.endTime);
  const uid = `bookit-${event.id}@bookit.app`;

  // Escape special characters in text fields per RFC 5545
  const escapeICS = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookIt Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    event.location ? `LOCATION:${escapeICS(event.location)}` : "",
    "STATUS:CONFIRMED",
    event.organizerName
      ? `ORGANIZER;CN=${escapeICS(event.organizerName)}:mailto:${event.organizerEmail || "support@bookit.app"}`
      : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: Your BookIt appointment is in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return icsLines.join("\r\n");
}

/**
 * Generates a subscribable live calendar feed (.ics) for a business / staff member.
 */
export function generateBusinessCalendarFeed(businessName: string, appointments: any[]): string {
  const now = formatDateToICS(new Date());
  const escapeICS = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//BookIt//${businessName}//EN`,
    `X-WR-CALNAME:${businessName} Bookings - BookIt`,
    "X-WR-CALDESC:Live schedule and appointments from BookIt",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const events = appointments.map((appt) => {
    let startDate: Date;
    let endDate: Date;
    if (appt.slot) {
      startDate = new Date(appt.slot.startTime);
      endDate = new Date(appt.slot.endTime);
    } else {
      const day = DateTime.fromISO(appt.tokenDate, { zone: appt.business?.timezone || "Asia/Kolkata" });
      const hours = appt.business?.businessHours?.find((entry: any) => entry.dayOfWeek === day.weekday % 7);
      const [openHour, openMinute] = (hours?.startTime || "09:00").split(":").map(Number);
      const [closeHour, closeMinute] = (hours?.endTime || "17:00").split(":").map(Number);
      startDate = day.set({ hour: openHour, minute: openMinute }).toJSDate();
      endDate = day.set({ hour: closeHour, minute: closeMinute }).toJSDate();
    }
    const start = formatDateToICS(startDate);
    const end = formatDateToICS(endDate);
    const uid = `bookit-${appt.id}@bookit.app`;
    const customerName = appt.customer?.name || "Customer";
    const serviceName = appt.service?.name || "Service";
    const status = appt.status;

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeICS(`[${status}] ${customerName} - ${serviceName}`)}`,
      `DESCRIPTION:${escapeICS(
        `Customer: ${customerName}\nService: ${serviceName}\n${appt.tokenNumber ? `Queue token: #${appt.tokenNumber}\n` : ""}Status: ${status}\nNotes: ${appt.notes || "None"}\nQR Code: ${appt.qrCode}`
      )}`,
      appt.business?.address ? `LOCATION:${escapeICS(appt.business.address)}` : "",
      `STATUS:${status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });

  return [...header, ...events, "END:VCALENDAR"].join("\r\n");
}
