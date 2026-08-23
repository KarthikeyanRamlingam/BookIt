-- Add push delivery and durable appointment reminder schedules.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = '"NotificationChannel"'::regtype AND enumlabel = 'PUSH'
  ) THEN
    ALTER TYPE "NotificationChannel" ADD VALUE 'PUSH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = '"NotificationStatus"'::regtype AND enumlabel = 'PROCESSING'
  ) THEN
    ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderType') THEN
    CREATE TYPE "ReminderType" AS ENUM ('ONE_HOUR', 'THIRTY_MINUTES');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppointmentReminder_appointmentId_type_key" ON "AppointmentReminder"("appointmentId", "type");
CREATE INDEX IF NOT EXISTS "AppointmentReminder_status_scheduledAt_idx" ON "AppointmentReminder"("status", "scheduledAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppointmentReminder_appointmentId_fkey') THEN
    ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
