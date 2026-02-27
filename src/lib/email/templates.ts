import type { Contact, LeadStage } from "@/lib/types";

interface EmailPayload {
  subject: string;
  html: string;
}

// ── Helpers ───────────────────────────────────────────────────

/** "Emma" | "Emma and Liam" | "Emma, Liam and Noah" */
function nameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BeatBunch</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#09090b;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:20px;font-weight:700;line-height:44px;">B</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:700;color:#09090b;">BeatBunch</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#fff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                © ${new Date().getFullYear()} BeatBunch · You're receiving this because you enquired about lessons.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function header(emoji: string, title: string, color = "#09090b"): string {
  return `<div style="background:${color};padding:32px 36px 24px;text-align:center;">
    <p style="margin:0 0 8px;font-size:36px;">${emoji}</p>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">${title}</h1>
  </div>`;
}

function body(content: string): string {
  return `<div style="padding:28px 36px 36px;">${content}</div>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${text}</p>`;
}

function highlight(text: string): string {
  return `<div style="background:#f4f4f5;border-left:3px solid #09090b;border-radius:4px;padding:14px 18px;margin:20px 0;">
    <p style="margin:0;font-size:14px;color:#52525b;font-style:italic;">${text}</p>
  </div>`;
}

// ── Templates ─────────────────────────────────────────────────

function contactedTemplate(primary: Contact, children: Contact[]): EmailPayload {
  const firstName = primary.first_name;
  const childNames = children.map((c) => c.first_name);
  const forKids = childNames.length > 0;

  return {
    subject: `Thanks for your enquiry, ${firstName}!`,
    html: wrap(
      header("👋", "We got your enquiry!") +
      body(
        p(`Hi ${firstName},`) +
        p(
          forKids
            ? `Thanks for reaching out about music lessons for <strong>${nameList(childNames)}</strong>. We're excited to help them get started!`
            : `Thanks for reaching out about music lessons. We're excited to help you get started!`
        ) +
        p("One of our team members will be in touch very soon to chat about the best options for you.") +
        highlight("Have questions in the meantime? Just reply to this email — we read every one.") +
        p("Talk soon,<br/><strong>The BeatBunch Team</strong>")
      )
    ),
  };
}

function trialBookedTemplate(primary: Contact, children: Contact[]): EmailPayload {
  const firstName = primary.first_name;
  const childNames = children.map((c) => c.first_name);
  const forKids = childNames.length > 0;

  return {
    subject: forKids
      ? `Trial lesson confirmed for ${nameList(childNames)}! 🎵`
      : `Your trial lesson is confirmed, ${firstName}! 🎵`,
    html: wrap(
      header("🎵", "Trial lesson confirmed!", "#1d4ed8") +
      body(
        p(`Hi ${firstName},`) +
        p(
          forKids
            ? `Great news — the trial lesson for <strong>${nameList(childNames)}</strong> is confirmed!`
            : `Great news — your trial lesson is confirmed!`
        ) +
        p("We'll send through the specific time and details shortly. Here's what to expect:") +
        `<ul style="margin:0 0 16px;padding-left:20px;color:#3f3f46;font-size:15px;line-height:2;">
          <li>The session runs for about 30 minutes</li>
          <li>No experience or instrument needed — just show up!</li>
          <li>You'll meet your teacher and try out the instrument</li>
        </ul>` +
        highlight("Can't make it? No worries — just reply to this email and we'll find another time.") +
        p("See you soon,<br/><strong>The BeatBunch Team</strong>")
      )
    ),
  };
}

function trialDoneTemplate(primary: Contact, children: Contact[]): EmailPayload {
  const firstName = primary.first_name;
  const childNames = children.map((c) => c.first_name);
  const forKids = childNames.length > 0;

  return {
    subject: `How was the trial, ${firstName}?`,
    html: wrap(
      header("⭐", "Hope you loved it!", "#7c3aed") +
      body(
        p(`Hi ${firstName},`) +
        p(
          forKids
            ? `We hope <strong>${nameList(childNames)}</strong> had a fantastic time at their trial lesson!`
            : `We hope you had a fantastic time at your trial lesson!`
        ) +
        p("We'd love to know what you thought. Did everything meet your expectations?") +
        highlight("If you're ready to enrol or have any questions, just hit reply — we'd love to hear from you.") +
        p("Warm regards,<br/><strong>The BeatBunch Team</strong>")
      )
    ),
  };
}

function enrolledTemplate(primary: Contact, children: Contact[]): EmailPayload {
  const firstName = primary.first_name;
  const childNames = children.map((c) => c.first_name);
  const forKids = childNames.length > 0;

  const instruments = children
    .filter((c) => c.instrument_interest)
    .map((c) => `${c.first_name} → ${c.instrument_interest}`)
    .join("<br/>");

  const adultInstrument = !forKids && primary.instrument_interest
    ? highlight(`Starting on: <strong>${primary.instrument_interest}</strong>`)
    : "";

  return {
    subject: forKids
      ? `Welcome to BeatBunch, ${nameList(childNames)}! 🎉`
      : `Welcome to BeatBunch, ${firstName}! 🎉`,
    html: wrap(
      header("🎉", "Welcome to the family!", "#15803d") +
      body(
        p(`Hi ${firstName},`) +
        p(
          forKids
            ? `We're absolutely thrilled to welcome <strong>${nameList(childNames)}</strong> to BeatBunch!`
            : `We're absolutely thrilled to welcome you to BeatBunch!`
        ) +
        (instruments
          ? highlight(instruments)
          : adultInstrument) +
        p("Your teacher will be in touch shortly to confirm your regular lesson time and any details you need before your first session.") +
        `<ul style="margin:0 0 16px;padding-left:20px;color:#3f3f46;font-size:15px;line-height:2;">
          <li>Bring your enthusiasm — everything else is provided</li>
          <li>Lessons run weekly at the same time each week</li>
          <li>Our team is always here if you have questions</li>
        </ul>` +
        p("We can't wait to make music together! 🎶<br/><br/><strong>The BeatBunch Team</strong>")
      )
    ),
  };
}

// ── Public API ────────────────────────────────────────────────

/** Stages that trigger a customer-facing email */
export const EMAIL_TRIGGER_STAGES: LeadStage[] = [
  "contacted",
  "trial_booked",
  "trial_done",
  "enrolled",
];

export function buildEmail(
  stage: LeadStage,
  primary: Contact,
  children: Contact[]
): EmailPayload | null {
  switch (stage) {
    case "contacted":    return contactedTemplate(primary, children);
    case "trial_booked": return trialBookedTemplate(primary, children);
    case "trial_done":   return trialDoneTemplate(primary, children);
    case "enrolled":     return enrolledTemplate(primary, children);
    default:             return null;
  }
}
