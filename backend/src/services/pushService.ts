import webpush from "web-push";
import { prisma } from "../config/db";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@bookit.app",
    publicKey,
    privateKey
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  appointmentId: string;
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<boolean> {
  if (!publicKey || !privateKey) return false;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return false;

  let sent = false;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload)
      );
      sent = true;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      } else {
        console.error("Push notification failed:", error);
      }
    }
  }

  return sent;
}
