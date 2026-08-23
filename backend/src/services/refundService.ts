import { prisma } from "../config/db";
import { stripe } from "./paymentService";
import { notify } from "./notificationService";

/**
 * Processes a 90% refund of the token fee when a customer's check-in is verified.
 * If the customer was a no-show, this function is NOT called, and the payment is retained.
 */
export async function processCheckInRefund(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      payment: true,
      customer: true,
      service: true,
      business: true,
    },
  });

  if (!appointment) return null;

  const payment = appointment.payment;
  if (!payment || payment.status !== "PAID") {
    return null;
  }

  // Prevent duplicate refunds
  if (payment.refundStatus === "REFUNDED_90_PERCENT") {
    return {
      refundAmount: Number(payment.refundAmount),
      refundStatus: payment.refundStatus,
      alreadyRefunded: true,
    };
  }

  const paidAmount = Number(payment.amount);
  // Calculate 90% of token fee (e.g. ₹50.00 -> ₹45.00)
  const refundAmount = Math.round(paidAmount * 0.90 * 100) / 100;

  // Execute Stripe partial refund if available
  if (stripe && payment.provider === "stripe" && payment.providerRefId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(payment.providerRefId);
      if (session.payment_intent) {
        const refundSubunits = Math.round(refundAmount * 100);
        await stripe.refunds.create({
          payment_intent: String(session.payment_intent),
          amount: refundSubunits,
          reason: "requested_by_customer",
          metadata: {
            appointmentId: appointment.id,
            type: "CHECKIN_ATTENDANCE_REFUND_90_PERCENT",
          },
        });
      }
    } catch (err: any) {
      console.warn("Stripe refund call note (simulated/offline or live error):", err?.message);
    }
  }

  // Update payment record with refund information
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundAmount,
      refundStatus: "REFUNDED_90_PERCENT",
      refundedAt: new Date(),
    },
  });

  // Notify customer about the 90% refund
  await notify({
    userId: appointment.customerId,
    appointmentId: appointment.id,
    to: appointment.customer.email,
    subject: `🎟️ 90% Token Fee Refund Processed (₹${refundAmount.toFixed(2)})`,
    message: `Thank you for checking in on time at ${appointment.business.name} for your ${appointment.service.name} appointment! As guaranteed, 90% of your token booking fee (₹${refundAmount.toFixed(2)} out of ₹${paidAmount.toFixed(2)}) has been refunded back to your payment method.`,
  });

  return {
    refundAmount,
    refundStatus: updatedPayment.refundStatus,
    refundedAt: updatedPayment.refundedAt,
  };
}
