import { NotificationChannel } from "@prisma/client";
import { prisma } from "../config/db";
import { sendEmail } from "./emailService";
import { sendSms, sendWhatsApp } from "./smsService";

interface NotifyArgs {
  userId: string;
  to: string; // email address
  subject: string;
  message: string;
  appointmentId?: string; // omitted for notifications not tied to one appointment (e.g. waitlist alerts)
}

// Fans a notification out across every channel available for the user:
// email always, plus SMS and WhatsApp if they have a phone number on file.
// Looks the phone number up internally (via userId) so callers only ever
// need to pass an email address -- no need to thread `phone` through
// every call site in appointmentController.ts.
//
// Logs one Notification row per channel attempted, regardless of
// success/failure, so there's a full audit trail per appointment.
export async function notify({ userId, to, subject, message, appointmentId }: NotifyArgs): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  const phone = user?.phone ?? null;

  const jobs: { channel: NotificationChannel; send: () => Promise<boolean> }[] = [
    { channel: "EMAIL", send: () => sendEmail(to, subject, message) },
  ];

  if (phone) {
    jobs.push({ channel: "SMS", send: () => sendSms(phone, message) });
    jobs.push({ channel: "WHATSAPP", send: () => sendWhatsApp(phone, message) });
  }

  for (const job of jobs) {
    const notification = await prisma.notification.create({
      data: { userId, appointmentId, channel: job.channel, status: "PENDING", message },
    });

    let success = false;
    try {
      success = await job.send();
    } catch (err) {
      console.error(`Notification send failed (channel=${job.channel}):`, err);
      success = false;
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: success ? "SENT" : "FAILED",
        sentAt: success ? new Date() : null,
      },
    });
  }
}