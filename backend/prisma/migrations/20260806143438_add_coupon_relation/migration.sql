-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
