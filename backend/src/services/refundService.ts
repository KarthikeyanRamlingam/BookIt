import { prisma } from "../config/db";
import { stripe } from "./paymentService";
import { notify } from "./notificationService";

type RefundKind = "ATTENDANCE_90" | "CANCELLATION_100";

async function refundAppointment(appointmentId: string, kind: RefundKind) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { payment: true, customer: true, service: true, business: true },
  });
  if (!appointment?.payment || appointment.payment.status !== "PAID") return { refundStatus: "NOT_PAID" };

  const successStatus = kind === "ATTENDANCE_90" ? "REFUNDED_90_PERCENT" : "REFUNDED_CANCELLATION";
  const pendingStatus = kind === "ATTENDANCE_90" ? "REFUND_PENDING_90_PERCENT" : "REFUND_PENDING_CANCELLATION";
  const failureStatus = kind === "ATTENDANCE_90" ? "REFUND_FAILED_90_PERCENT" : "REFUND_FAILED_CANCELLATION";
  if (appointment.payment.refundStatus === successStatus) {
    return { refundAmount: Number(appointment.payment.refundAmount || 0), refundStatus: successStatus, alreadyRefunded: true };
  }

  const paidAmount = Number(appointment.payment.amount);
  const refundAmount = Math.round(paidAmount * (kind === "ATTENDANCE_90" ? 0.9 : 1) * 100) / 100;
  let claimedPayment = appointment.payment;
  if (appointment.payment.refundStatus === pendingStatus) {
    if (appointment.payment.providerRefundRefId && stripe) {
      const previousRefund = await stripe.refunds.retrieve(appointment.payment.providerRefundRefId);
      if (previousRefund.status === "succeeded") {
        await prisma.payment.update({ where: { id: appointment.payment.id }, data: { refundAmount, refundStatus: successStatus, refundedAt: new Date() } });
        return { refundAmount, refundStatus: successStatus, providerRefundRefId: previousRefund.id };
      }
      if (previousRefund.status === "pending") return { refundAmount, refundStatus: pendingStatus, providerRefundRefId: previousRefund.id };
      await prisma.payment.update({ where: { id: appointment.payment.id }, data: { refundStatus: failureStatus } });
      appointment.payment.refundStatus = failureStatus;
    } else if (Date.now() - appointment.payment.updatedAt.getTime() < 5 * 60_000) {
      return { refundAmount, refundStatus: pendingStatus };
    } else {
      // Reuse the previous idempotency key when a process stopped between
      // claiming the refund and saving the provider's refund ID.
      const reclaimed = await prisma.payment.updateMany({
        where: { id: appointment.payment.id, refundStatus: pendingStatus, updatedAt: appointment.payment.updatedAt },
        data: { refundStatus: pendingStatus },
      });
      if (!reclaimed.count) return { refundAmount, refundStatus: pendingStatus };
    }
  }

  if (appointment.payment.refundStatus !== pendingStatus) {
    const claim = await prisma.payment.updateMany({
      where: { id: appointment.payment.id, refundStatus: { in: ["NONE", failureStatus] } },
      data: { refundStatus: pendingStatus, refundAttempts: { increment: 1 } },
    });
    if (claim.count === 0) {
      const latest = await prisma.payment.findUnique({ where: { id: appointment.payment.id } });
      return { refundAmount, refundStatus: latest?.refundStatus || "REFUND_PENDING" };
    }
    claimedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: appointment.payment.id } });
  }

  if (!stripe || appointment.payment.provider !== "stripe" || !appointment.payment.providerRefId) {
    await prisma.payment.update({ where: { id: appointment.payment.id }, data: { refundStatus: failureStatus } });
    return { refundAmount, refundStatus: failureStatus, error: "Payment provider is unavailable for this refund." };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(appointment.payment.providerRefId);
    if (!session.payment_intent) throw new Error("The payment session has no refundable payment intent.");
    const refund = await stripe.refunds.create({
      payment_intent: String(session.payment_intent),
      amount: Math.round(refundAmount * 100),
      reason: "requested_by_customer",
      metadata: { appointmentId, type: kind },
    }, { idempotencyKey: `bookit-${appointmentId}-${kind.toLowerCase()}-${claimedPayment.refundAttempts}` });

    if (refund.status !== "succeeded") {
      await prisma.payment.update({
        where: { id: appointment.payment.id },
        data: { refundAmount, providerRefundRefId: refund.id, refundStatus: pendingStatus },
      });
      return { refundAmount, refundStatus: pendingStatus, providerRefundRefId: refund.id };
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: appointment.payment.id },
      data: { refundAmount, providerRefundRefId: refund.id, refundStatus: successStatus, refundedAt: new Date() },
    });
    await notify({
      userId: appointment.customerId,
      appointmentId,
      to: appointment.customer.email,
      subject: kind === "ATTENDANCE_90" ? "Booking fee refund processed" : "Cancellation refund processed",
      message: `A refund of ₹${refundAmount.toFixed(2)} for ${appointment.service.name} at ${appointment.business.name} has been processed. Provider reference: ${refund.id}.`,
    });
    return { refundAmount, refundStatus: updatedPayment.refundStatus || pendingStatus, refundedAt: updatedPayment.refundedAt };
  } catch (error: any) {
    console.error(`Refund failed (appointment=${appointmentId}, kind=${kind}):`, error);
    await prisma.payment.update({ where: { id: appointment.payment.id }, data: { refundStatus: failureStatus } });
    return { refundAmount, refundStatus: failureStatus, error: "The payment provider did not confirm the refund. It will be retried." };
  }
}

export function processCheckInRefund(appointmentId: string) {
  return refundAppointment(appointmentId, "ATTENDANCE_90");
}

export function processCancellationRefund(appointmentId: string) {
  return refundAppointment(appointmentId, "CANCELLATION_100");
}

export async function retryPendingRefunds() {
  const pending = await prisma.payment.findMany({
    where: { refundStatus: { in: ["REFUND_PENDING_90_PERCENT", "REFUND_FAILED_90_PERCENT", "REFUND_PENDING_CANCELLATION", "REFUND_FAILED_CANCELLATION"] } },
    select: { appointmentId: true, refundStatus: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  let completed = 0;
  for (const payment of pending) {
    const kind: RefundKind = payment.refundStatus?.includes("CANCELLATION") ? "CANCELLATION_100" : "ATTENDANCE_90";
    const result = await refundAppointment(payment.appointmentId, kind);
    if (result.refundStatus === "REFUNDED_90_PERCENT" || result.refundStatus === "REFUNDED_CANCELLATION") completed++;
  }
  return { attempted: pending.length, completed };
}
