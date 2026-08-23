import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!client || !process.env.TWILIO_SMS_FROM) {
    console.log(`[sms:skipped, no Twilio configured] to=${to} body="${body}"`);
    return false;
  }
  try {
    await client.messages.create({ to, from: process.env.TWILIO_SMS_FROM, body });
    return true;
  } catch (err) {
    console.error("SMS send failed:", err);
    return false;
  }
}

export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  if (!client || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log(`[whatsapp:skipped, no Twilio configured] to=${to} body="${body}"`);
    return false;
  }
  try {
    await client.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      body,
    });
    return true;
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    return false;
  }
}