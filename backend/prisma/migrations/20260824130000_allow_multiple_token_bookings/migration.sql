-- Token queues share one daily slot; normal appointments remain protected by isBooked.
DROP INDEX IF EXISTS "Appointment_slotId_key";
CREATE INDEX IF NOT EXISTS "Appointment_slotId_idx" ON "Appointment"("slotId");