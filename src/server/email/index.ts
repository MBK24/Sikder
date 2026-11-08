import "server-only";
import { siteConfig } from "@/config/site";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body; also used to build a minimal HTML version. */
  text: string;
  /** Optional call-to-action rendered as a button in the HTML version. */
  action?: { label: string; url: string };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function toHtml(msg: EmailMessage) {
  const paras = msg.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = msg.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(msg.action.url)}" style="background:#1f5f8b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(msg.action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1d2125;max-width:560px;margin:0 auto;padding:24px">
<p style="font-family:system-ui,sans-serif;font-weight:700;color:#1f5f8b;margin:0 0 24px">${escapeHtml(siteConfig.name)}</p>
${paras}${button}
<p style="font-size:13px;color:#5b6570;margin-top:32px">You're receiving this because you have an account at ${escapeHtml(siteConfig.url)}.</p>
</body></html>`;
}

/**
 * Sends a transactional email through Resend's HTTP API.
 * With no RESEND_API_KEY (local dev), the message is printed to the console instead.
 */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(
      `\n📧 [email:dev] to=${msg.to}\n   subject: ${msg.subject}\n   ${msg.text.replace(/\n/g, "\n   ")}` +
        (msg.action ? `\n   ${msg.action.label}: ${msg.action.url}` : "") +
        "\n",
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? `${siteConfig.name} <onboarding@resend.dev>`,
      to: [msg.to],
      subject: msg.subject,
      text: msg.action ? `${msg.text}\n\n${msg.action.label}: ${msg.action.url}` : msg.text,
      html: toHtml(msg),
    }),
  });
  if (!res.ok) {
    // Never let an email failure break the user-facing request; log loudly instead.
    console.error(`[email] Resend error ${res.status}: ${await res.text()}`);
  }
}
