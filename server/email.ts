// Invitation email delivery via Resend.
//
// Uses @replit/connectors-sdk to proxy requests through the Replit Resend connector.
// Falls back to RESEND_API_KEY + RESEND_FROM_EMAIL env vars if the connector is unavailable.
//
// Email is best-effort: if Resend is not configured or the send fails, the
// invitation is still persisted and the accept link is logged so it can be
// shared manually. Callers must never let a failed email abort the operation
// that triggered it (e.g. creating a child or teacher).

import { ReplitConnectors } from "@replit/connectors-sdk";

// Escape user-provided values before interpolating them into email HTML so a
// crafted school name or inviter name cannot inject markup into the message.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inviteHtml(opts: { role: string; inviteUrl: string; invitedByName: string; schoolName: string }): string {
  const roleLabel = opts.role === "teacher" ? "teacher" : "parent";
  const inviteUrl = escapeHtml(opts.inviteUrl);
  const schoolName = escapeHtml(opts.schoolName);
  const who = opts.invitedByName ? `${escapeHtml(opts.invitedByName)} at ${schoolName}` : schoolName;
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #41444b;">
    <h1 style="color: #7a3428; font-size: 24px;">You're invited to ${schoolName}</h1>
    <p>${who} has invited you to join <strong>${schoolName}</strong> as a ${roleLabel}.</p>
    <p>Click the button below to set your password and access your account.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" style="background: linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 600; display: inline-block;">Accept invitation</a>
    </p>
    <p style="font-size: 13px; color: #8a8a8a;">Or paste this link into your browser:<br/>${inviteUrl}</p>
    <p style="font-size: 13px; color: #8a8a8a;">This invitation will expire in 7 days.</p>
  </div>`;
}

function resetHtml(opts: { resetUrl: string; schoolName: string }): string {
  const resetUrl = escapeHtml(opts.resetUrl);
  const schoolName = escapeHtml(opts.schoolName);
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #41444b;">
    <h1 style="color: #7a3428; font-size: 24px;">Reset your password</h1>
    <p>We received a request to reset the password for your <strong>${schoolName}</strong> account.</p>
    <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 600; display: inline-block;">Reset password</a>
    </p>
    <p style="font-size: 13px; color: #8a8a8a;">Or paste this link into your browser:<br/>${resetUrl}</p>
    <p style="font-size: 13px; color: #8a8a8a;">If you didn't request a password reset, you can safely ignore this email.</p>
  </div>`;
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  resetUrl: string;
  schoolName: string;
}): Promise<boolean> {
  const { to, resetUrl, schoolName } = opts;

  const fromEmail = process.env.RESEND_FROM_EMAIL || "";
  const subject = `Reset your ${schoolName || "Miss Sunshine"} password`;
  const html = resetHtml({ resetUrl, schoolName });
  const fromName = schoolName || "Miss Sunshine";

  // Try Resend via connector SDK first
  try {
    const connectors = new ReplitConnectors();
    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail ? `${fromName} <${fromEmail}>` : `${fromName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (res.ok) {
      console.log(`[email] Password reset sent via Resend connector to ${to}`);
      return true;
    }
    const detail = await res.text().catch(() => "");
    console.warn(`[email] Resend connector reset send failed (${res.status}) for ${to}: ${detail}. Reset link: ${resetUrl}`);
  } catch (err) {
    console.warn(`[email] Resend connector unavailable for reset:`, err);
  }

  // Fallback: direct Resend API with env var key
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    console.warn(
      `[email] Resend not configured; password reset for ${to} not emailed. Reset link: ${resetUrl}`,
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail ? `${fromName} <${fromEmail}>` : `${fromName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[email] Resend API reset send failed (${res.status}) for ${to}: ${detail}. Reset link: ${resetUrl}`);
      return false;
    }
    console.log(`[email] Password reset sent via Resend API key to ${to}`);
    return true;
  } catch (err) {
    console.warn(`[email] Resend API reset send error for ${to}:`, err, `Reset link: ${resetUrl}`);
    return false;
  }
}

export async function sendInvitationEmail(opts: {
  to: string;
  role: string;
  inviteUrl: string;
  invitedByName: string;
  schoolName: string;
}): Promise<boolean> {
  const { to, role, inviteUrl, invitedByName, schoolName } = opts;

  const fromEmail = process.env.RESEND_FROM_EMAIL || "";
  const subject = `You're invited to ${schoolName || "Miss Sunshine"}`;
  const html = inviteHtml({ role, inviteUrl, invitedByName, schoolName });
  const fromName = schoolName || "Miss Sunshine";

  // Try Resend via connector SDK first
  try {
    const connectors = new ReplitConnectors();
    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail ? `${fromName} <${fromEmail}>` : `${fromName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (res.ok) {
      console.log(`[email] Invitation sent via Resend connector to ${to}`);
      return true;
    }
    const detail = await res.text().catch(() => "");
    console.warn(`[email] Resend connector send failed (${res.status}) for ${to}: ${detail}. Accept link: ${inviteUrl}`);
    // Fall through to API key fallback
  } catch (err) {
    console.warn(`[email] Resend connector unavailable:`, err);
    // Fall through to API key fallback
  }

  // Fallback: direct Resend API with env var key
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    console.warn(
      `[email] Resend not configured; invitation for ${to} (${role}) not emailed. Accept link: ${inviteUrl}`,
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail ? `${fromName} <${fromEmail}>` : `${fromName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[email] Resend API send failed (${res.status}) for ${to}: ${detail}. Accept link: ${inviteUrl}`);
      return false;
    }
    console.log(`[email] Invitation sent via Resend API key to ${to}`);
    return true;
  } catch (err) {
    console.warn(`[email] Resend API send error for ${to}:`, err, `Accept link: ${inviteUrl}`);
    return false;
  }
}
