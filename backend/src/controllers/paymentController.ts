import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";
import { stripe, isStripeConfigured } from "../services/paymentService";
import { notify } from "../services/notificationService";

// Creates a Stripe Checkout Session for an appointment. The price always
// comes from the Service record on the server -- never trust a price
// passed in from the client.
export async function createCheckoutSession(req: Request, res: Response) {
  if (!isStripeConfigured() || !stripe) {
    throw new ApiError(503, "Payments are not configured on this server yet");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: { service: true, payment: true },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.customerId !== req.user!.userId) throw new ApiError(403, "Not your appointment");
  if (appointment.status === "CANCELLED") throw new ApiError(400, "Cannot pay for a cancelled appointment");
  if (appointment.status === "NO_SHOW") throw new ApiError(400, "Cannot pay for an appointment marked as no-show");
  if (appointment.payment?.status === "PAID") throw new ApiError(409, "This appointment is already paid for");

  const tokenFee = (appointment.service as any).tokenFee ?? 50;
  const amountInSubunits = Math.round(Number(tokenFee) * 100);

  // Stripe enforces a per-currency minimum chargeable amount (₹50 for INR).
  const MIN_INR_SUBUNITS = 5000; // ₹50.00
  if (amountInSubunits < MIN_INR_SUBUNITS) {
    throw new ApiError(
      400,
      `Token booking fee is priced below Stripe's ₹50 minimum for card payments (currently ₹${tokenFee}). Update the token fee to at least ₹50 to enable online payment.`
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: { name: `Token Booking Fee - ${appointment.service.name}` },
          unit_amount: amountInSubunits,
        },
        quantity: 1,
      },
    ],
    metadata: { appointmentId: appointment.id },
    success_url: `${process.env.FRONTEND_URL}/payment/success?appointmentId=${appointment.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?appointmentId=${appointment.id}`,
  });

  // Upsert so re-clicking "Pay Now" (e.g. after abandoning checkout) reuses
  // the Payment row instead of erroring, and the webhook can always find it
  // later by providerRefId (the session id).
  await prisma.payment.upsert({
    where: { appointmentId: appointment.id },
    update: { providerRefId: session.id, status: "PENDING", amount: tokenFee },
    create: {
      appointmentId: appointment.id,
      amount: tokenFee,
      provider: "stripe",
      providerRefId: session.id,
      status: "PENDING",
    },
  });

  res.json({ checkoutUrl: session.url });
}

// Verifies a payment upon checkout completion / success redirect and marks it PAID.
export async function verifyPayment(req: Request, res: Response) {
  const { appointmentId } = req.params;
  const sessionId = (req.body?.sessionId || req.query?.session_id) as string | undefined;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, payment: true, customer: true, business: { select: { ownerId: true } } },
  });

  if (!appointment) throw new ApiError(404, "Appointment not found");
  const canVerifyPayment =
    appointment.customerId === req.user!.userId ||
    (req.user!.role === "ADMIN" && appointment.business.ownerId === req.user!.userId);
  if (!canVerifyPayment) throw new ApiError(403, "Not authorized to verify this payment");

  // If already marked PAID, return success immediately
  if (appointment.payment?.status === "PAID") {
    return res.json({ status: "PAID", payment: appointment.payment });
  }

  const tokenFee = (appointment.service as any).tokenFee ?? 50;
  let isVerifiedPaid = false;

  // 1. Check with Stripe session if available
  const checkSessionId = sessionId || appointment.payment?.providerRefId;
  if (stripe && checkSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(checkSessionId);
      if (session.payment_status === "paid" || session.status === "complete") {
        isVerifiedPaid = true;
      }
    } catch (err: any) {
      console.warn("Stripe session check note (proceeding with verification):", err?.message);
    }
  }

  // 2. If Stripe confirmed or customer was redirected from successful checkout
  if (isVerifiedPaid) {
    const payment = await prisma.payment.upsert({
      where: { appointmentId: appointment.id },
      update: {
        status: "PAID",
        providerRefId: checkSessionId || appointment.payment?.providerRefId,
      },
      create: {
        appointmentId: appointment.id,
        amount: tokenFee,
        provider: "stripe",
        providerRefId: checkSessionId,
        status: "PAID",
      },
    });

    await notify({
      userId: appointment.customerId,
      appointmentId: appointment.id,
      to: appointment.customer.email,
      subject: "Token Booking Payment Confirmed",
      message: `We've verified your token booking payment of ₹${payment.amount} for ${appointment.service.name}. See you soon!`,
    });

    return res.json({ status: "PAID", payment });
  }

  res.json({ status: appointment.payment?.status ?? "PENDING", payment: appointment.payment });
}

// Stripe webhook. Must receive the RAW request body (not JSON-parsed) for
// signature verification -- see the special-case route registration in
// app.ts, which mounts this before express.json().
export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) return res.status(503).send("Payments not configured");

  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, webhookSecret!);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;

    if (appointmentId) {
      const payment = await prisma.payment.upsert({
        where: { appointmentId },
        update: { status: "PAID", providerRefId: session.id },
        create: {
          appointmentId,
          amount: Number(session.amount_total || 0) / 100,
          provider: "stripe",
          providerRefId: session.id,
          status: "PAID",
        },
        include: { appointment: { include: { customer: true, service: true } } },
      });

      await notify({
        userId: payment.appointment.customerId,
        appointmentId: payment.appointment.id,
        to: payment.appointment.customer.email,
        subject: "Token Booking Payment Received",
        message: `We've received your token booking payment of ₹${payment.amount} for ${payment.appointment.service.name}. See you soon!`,
      });
    }
  }

  res.json({ received: true });
}

export async function getPaymentStatus(req: Request, res: Response) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    select: { customerId: true, business: { select: { ownerId: true } } },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  const canViewPayment =
    appointment.customerId === req.user!.userId ||
    (req.user!.role === "ADMIN" && appointment.business.ownerId === req.user!.userId);
  if (!canViewPayment) throw new ApiError(403, "Not authorized to view this payment");

  const payment = await prisma.payment.findUnique({ where: { appointmentId: req.params.appointmentId } });
  res.json(payment ?? { status: "UNPAID" });
}