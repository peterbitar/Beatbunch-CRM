"use server";

import { createClient } from "@/lib/supabase/server";
import { resend, FROM_ADDRESS } from "@/lib/email/client";
import { buildEmail, EMAIL_TRIGGER_STAGES } from "@/lib/email/templates";
import { getPrimaryContact, getChildren } from "@/lib/types";
import type { LeadStage, LeadWithContacts } from "@/lib/types";

/**
 * Called after a lead's stage is updated on the client.
 * Fetches the lead, builds the right email, and sends it via Resend.
 * Fire-and-forget safe — errors are logged, not thrown.
 */
export async function triggerStageEmail(
  leadId: string,
  newStage: LeadStage
): Promise<{ sent: boolean; error?: string }> {
  if (!EMAIL_TRIGGER_STAGES.includes(newStage)) {
    return { sent: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*, lead_contacts(is_primary, contact:contacts(*))")
      .eq("id", leadId)
      .single();

    if (error || !data) return { sent: false, error: "Lead not found" };

    const lead = data as LeadWithContacts;
    const primary = getPrimaryContact(lead);
    const children = getChildren(lead);

    if (!primary?.email) {
      return { sent: false, error: "No email on primary contact" };
    }

    const payload = buildEmail(newStage, primary, children);
    if (!payload) return { sent: false };

    const { error: sendError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: primary.email,
      subject: payload.subject,
      html: payload.html,
    });

    if (sendError) {
      console.error("[email] Resend error:", sendError);
      return { sent: false, error: sendError.message };
    }

    console.log(
      `[email] Sent "${payload.subject}" → ${primary.email} (stage: ${newStage})`
    );
    return { sent: true };
  } catch (err) {
    console.error("[email] Unexpected error:", err);
    return { sent: false, error: String(err) };
  }
}
