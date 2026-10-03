CREATE TYPE "BookingMode" AS ENUM ('APPOINTMENT', 'QUEUE');

ALTER TABLE "Category"
ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'APPOINTMENT';

UPDATE "Category"
SET "bookingMode" = 'QUEUE'
WHERE "slug" IN (
  'doctor-appointment', 'government-office', 'general-practitioners',
  'cardiologists', 'pediatricians', 'dermatologists', 'neurologists',
  'endocrinologists', 'gastroenterologists', 'psychiatrists', 'orthopedics',
  'dentists', 'ophthalmologists', 'gynecologists'
);

ALTER TABLE "BusinessSettings"
ADD COLUMN "cancellationCutoffMinutes" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "Payment"
ADD COLUMN "refundAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "providerRefundRefId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "Slot_staffId_startTime_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Slot_serviceId_staffId_startTime_key" ON "Slot"("serviceId", "staffId", "startTime");

ALTER TABLE "Appointment" ALTER COLUMN "staffId" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "slotId" DROP NOT NULL;
