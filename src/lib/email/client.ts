import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// Change this once you verify a domain in Resend
// Until then, use onboarding@resend.dev for testing (Resend's sandbox address)
export const FROM_ADDRESS = process.env.EMAIL_FROM ?? "BeatBunch <onboarding@resend.dev>";
