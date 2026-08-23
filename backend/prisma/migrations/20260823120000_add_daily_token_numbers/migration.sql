-- Add persistent daily token numbers.
ALTER TABLE "Appointment" ADD COLUMN "tokenDate" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "tokenNumber" INTEGER;

WITH numbered AS (
  SELECT
    a."id",
    to_char(s."startTime", 'YYYY-MM-DD') AS "tokenDate",
    row_number() OVER (
      PARTITION BY a."businessId", to_char(s."startTime", 'YYYY-MM-DD')
      ORDER BY s."startTime", a."createdAt", a."id"
    )::INTEGER AS "tokenNumber"
  FROM "Appointment" a
  JOIN "Slot" s ON s."id" = a."slotId"
)
UPDATE "Appointment" a
SET "tokenDate" = numbered."tokenDate", "tokenNumber" = numbered."tokenNumber"
FROM numbered
WHERE a."id" = numbered."id";

ALTER TABLE "Appointment" ALTER COLUMN "tokenDate" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "tokenNumber" SET NOT NULL;

CREATE TABLE "BusinessTokenSequence" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tokenDate" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessTokenSequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BusinessTokenSequence" ("id", "businessId", "tokenDate", "nextNumber", "createdAt", "updatedAt")
SELECT
  md5(a."businessId" || a."tokenDate")::uuid,
  a."businessId",
  a."tokenDate",
  MAX(a."tokenNumber") + 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Appointment" a
GROUP BY a."businessId", a."tokenDate";

CREATE UNIQUE INDEX "Appointment_businessId_tokenDate_tokenNumber_key"
  ON "Appointment"("businessId", "tokenDate", "tokenNumber");
CREATE UNIQUE INDEX "BusinessTokenSequence_businessId_tokenDate_key"
  ON "BusinessTokenSequence"("businessId", "tokenDate");

ALTER TABLE "BusinessTokenSequence" ADD CONSTRAINT "BusinessTokenSequence_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
