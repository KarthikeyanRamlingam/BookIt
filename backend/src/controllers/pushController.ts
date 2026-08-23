import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribeToPush(req: Request, res: Response) {
  const subscription = subscriptionSchema.parse(req.body);

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: req.user!.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId: req.user!.userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  res.status(201).json({ message: "Push notifications enabled" });
}

export async function unsubscribeFromPush(req: Request, res: Response) {
  const endpoint = z.string().url().parse(req.body.endpoint);
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.userId, endpoint } });
  res.json({ message: "Push notifications disabled" });
}
