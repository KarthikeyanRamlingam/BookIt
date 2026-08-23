"use client";

import { useState, useRef, useEffect } from "react";

interface AddToCalendarDropdownProps {
  appointmentId: string;
  serviceName: string;
  businessName?: string;
  startTime: string | Date;
  endTime?: string | Date;
  location?: string;
  notes?: string;
}

export default function AddToCalendarDropdown({
  serviceName,
  businessName,
  startTime,
  endTime,
  location,
  notes,
}: AddToCalendarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Safe date parsing with validation
  const rawStart = new Date(startTime);
  const startDate = !isNaN(rawStart.getTime()) ? rawStart : new Date();
  const rawEnd = endTime ? new Date(endTime) : null;
  const endDate =
    rawEnd && !isNaN(rawEnd.getTime())
      ? rawEnd
      : new Date(startDate.getTime() + 60 * 60 * 1000); // 1hr default

  const title = `${serviceName}${businessName ? ` at ${businessName}` : ""}`;
  const description = `BookIt Appointment for ${serviceName}.${
    businessName ? ` Venue: ${businessName}.` : ""
  }${notes ? ` Notes: ${notes}.` : ""}`;
  const loc = location || (businessName ? `${businessName}, India` : "BookIt Venue");

  // Format UTC string: YYYYMMDDTHHmmssZ
  function formatUTC(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }

  // Google Calendar URL
  const googleStart = formatUTC(startDate);
  const googleEnd = formatUTC(endDate);
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleStart}/${googleEnd}`,
    details: description,
    location: loc,
    sprop: "name:BookIt",
  });
  const googleUrl = `https://calendar.google.com/calendar/render?${googleParams.toString()}`;

  // Outlook / Office 365 Web URL
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    body: description,
    location: loc,
  });
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

  // Apple / iCal .ics file download generator
  function downloadICS() {
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BookIt//Appointment Platform//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:appt-${Date.now()}@bookit.app`,
      `DTSTAMP:${formatUTC(new Date())}`,
      `DTSTART:${formatUTC(startDate)}`,
      `DTEND:${formatUTC(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      `LOCATION:${loc}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `appointment-${serviceName.toLowerCase().replace(/\s+/g, "-")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-all"
        title="Add to Google, Outlook, or Apple Calendar"
      >
        <span>📅</span>
        <span>Add to Calendar</span>
        <span className="text-[10px] text-slate-400">▾</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto z-50 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="px-3 py-1.5 border-b border-slate-800/80">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sync Appointment
            </p>
          </div>

          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
          >
            <span className="text-base">🗓️</span>
            <span>Google Calendar</span>
          </a>

          <a
            href={outlookUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
          >
            <span className="text-base">📧</span>
            <span>Outlook / Microsoft 365</span>
          </a>

          <button
            type="button"
            onClick={downloadICS}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-blue-600/20 hover:text-blue-400 transition-colors text-left"
          >
            <span className="text-base">🍎</span>
            <span>Apple / iCal File (.ics)</span>
          </button>
        </div>
      )}
    </div>
  );
}