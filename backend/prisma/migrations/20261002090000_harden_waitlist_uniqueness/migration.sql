-- Keep the oldest entry if historical duplicates exist, then enforce the
-- invariant used by the waitlist API under concurrent requests.
DELETE FROM "WaitlistEntry" a
USING "WaitlistEntry" b
WHERE a."customerId" = b."customerId"
  AND a."serviceId" = b."serviceId"
  AND a."preferredDate" = b."preferredDate"
  AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX "WaitlistEntry_customerId_serviceId_preferredDate_key"
ON "WaitlistEntry"("customerId", "serviceId", "preferredDate");

CREATE INDEX "WaitlistEntry_serviceId_preferredDate_notified_idx"
ON "WaitlistEntry"("serviceId", "preferredDate", "notified");
