-- Make token assignment happen at confirmed check-in and add configurable meal breaks.
ALTER TABLE "Appointment" ALTER COLUMN "tokenDate" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "tokenNumber" DROP NOT NULL;

ALTER TABLE "BusinessSettings"
  ADD COLUMN "breakfastStart" TEXT,
  ADD COLUMN "breakfastEnd" TEXT,
  ADD COLUMN "lunchStart" TEXT,
  ADD COLUMN "lunchEnd" TEXT,
  ADD COLUMN "dinnerStart" TEXT,
  ADD COLUMN "dinnerEnd" TEXT;
