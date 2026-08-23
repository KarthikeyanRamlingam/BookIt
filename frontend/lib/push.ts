import { api } from "./api";

function decodeVapidKey(key: string) {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function supportsPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function enablePushNotifications(publicKey: string) {
  if (!supportsPush() || !publicKey) throw new Error("Push notifications are not configured in this environment.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(publicKey),
  });

  await api.post("/push/subscribe", subscription.toJSON());
}