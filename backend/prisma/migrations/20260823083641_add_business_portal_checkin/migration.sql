-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'CHECK_IN_PENDING';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "AppointmentStatus" ADD VALUE 'ATTENDED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "attendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION';

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "checkInBeforeMinutes" INTEGER NOT NULL DEFAULT 30,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "autoNoShow" BOOLEAN NOT NULL DEFAULT true,
    "locationVerificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "CheckInStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'QR_SCAN',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON "BusinessSettings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInSession_token_key" ON "CheckInSession"("token");

-- CreateIndex
CREATE INDEX "CheckInSession_businessId_active_idx" ON "CheckInSession"("businessId", "active");

-- CreateIndex
CREATE INDEX "CheckInSession_token_idx" ON "CheckInSession"("token");

-- CreateIndex
CREATE INDEX "CheckInSession_expiresAt_idx" ON "CheckInSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_bookingId_key" ON "CheckIn"("bookingId");

-- CreateIndex
CREATE INDEX "CheckIn_businessId_status_idx" ON "CheckIn"("businessId", "status");

-- CreateIndex
CREATE INDEX "CheckIn_userId_idx" ON "CheckIn"("userId");

-- CreateIndex
CREATE INDEX "Appointment_businessId_status_idx" ON "Appointment"("businessId", "status");

-- CreateIndex
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInSession" ADD CONSTRAINT "CheckInSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CheckInSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
