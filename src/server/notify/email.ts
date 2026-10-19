import "server-only";

// Email through Resend when RESEND_API_KEY is set; otherwise logged, so nothing fails without it.
// Returns true only when the provider accepted the message.

export async function sendEmail(to: string, msg: { subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] RESEND_API_KEY is not set. Would email ${to}: ${msg.subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Spine <onboarding@resend.dev>", to, subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[email] Resend returned ${res.status}`);
    return res.ok;
  } catch (error) {
    console.error("[email] failed", error instanceof Error ? error.message : error);
    return false;
  }
}
