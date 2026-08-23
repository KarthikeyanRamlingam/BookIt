-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundAmount" DECIMAL(10,2),
ADD COLUMN     "refundStatus" TEXT DEFAULT 'NONE',
ADD COLUMN     "refundedAt" TIMESTAMP(3);
