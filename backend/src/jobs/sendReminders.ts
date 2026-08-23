import "dotenv/config";
import { prisma } from "../config/db";
import { notify } from "../services/notificationService";
import { sendPushNotification } from "../services/pushService";

const reminderOffsets = [
  { type: "ONE_HOUR" as const, minutes: 60 },
  { type: "THIRTY_MINUTES" as const, minutes: 30 },
];

function formatAppointmentTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function run() {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + 65 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", slot: { startTime: { gt: now, lte: lookAhead } } },
    include: {
      customer: true,
      service: true,
      staff: { include: { user: true } },
      slot: true,
      business: true,
    },
  });

  for (const appointment of appointments) {
    for (const reminder of reminderOffsets) {
      const scheduledAt = new Date(appointment.slot.startTime.getTime() - reminder.minutes * 60 * 1000);
      await prisma.appointmentReminder.upsert({
        where: { appointmentId_type: { appointmentId: appointment.id, type: reminder.type } },
        create: { appointmentId: appointment.id, type: reminder.type, scheduledAt },
        update: { scheduledAt },
      });
    }
  }

  const dueReminders = await prisma.appointmentReminder.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      scheduledAt: { lte: now },
      attempts: { lt: 3 },
      appointment: { status: "CONFIRMED" },
    },
    include: {
      appointment: {
        include: { customer: true, service: true, staff: { include: { user: true } }, slot: true, business: true },
      },
    },
  });

  let sent = 0;
  for (const reminder of dueReminders) {
    const claim = await prisma.appointmentReminder.updateMany({
      where: { id: reminder.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
    });
    if (claim.count === 0) continue;

    const appointment = reminder.appointment;
    const time = formatAppointmentTime(appointment.slot.startTime, appointment.business.timezone);
    const lead = reminder.type === "ONE_HOUR" ? "1 hour" : "30 minutes";
    const message = `Reminder: your ${appointment.service.name} appointment with ${appointment.staff.user.name} is in ${lead}, at ${time}.`;

    try {
      await notify({
        appointmentId: appointment.id,
        userId: appointment.customerId,
        to: appointment.customer.email,
        subject: `Appointment reminder: ${lead} to go`,
        message,
      });

      const pushSent = await sendPushNotification(appointment.customerId, {
        title: `Appointment in ${lead}`,
        body: message.replace("Reminder: ", ""),
        url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`,
        appointmentId: appointment.id,
      });

      if (pushSent) {
        await prisma.notification.create({
          data: {
            userId: appointment.customerId,
            appointmentId: appointment.id,
            channel: "PUSH",
            status: "SENT",
            message,
            sentAt: new Date(),
          },
        });
      }

      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } catch (error: any) {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: "FAILED", lastError: String(error?.message || error) },
      });
      console.error(`Reminder failed (appointment=${appointment.id}, type=${reminder.type}):`, error);
    }
  }

  console.log(`Reminder job complete. ${sent} reminder(s) sent; ${dueReminders.length} due reminder(s) checked.`);
}

run()
  .catch((err) => {
    console.error("Reminder job failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
