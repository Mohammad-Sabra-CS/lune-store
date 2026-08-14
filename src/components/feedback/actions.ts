"use server";

import { z } from "zod";
import { routing } from "@/i18n/routing";
import { EMAIL_RE } from "@/lib/checkout-validation";
import { createFeedback } from "@/lib/feedback";

const feedbackSchema = z.object({
  name: z.string().trim().max(120),
  email: z.string().trim().max(200),
  message: z.string().trim().min(3).max(1000),
  locale: z.enum(routing.locales),
});

export async function submitFeedback(payload: unknown): Promise<{ ok: boolean }> {
  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) return { ok: false };
  const { name, email, message, locale } = parsed.data;
  if (email && !EMAIL_RE.test(email)) return { ok: false };

  try {
    await createFeedback({
      name: name || null,
      email: email || null,
      message,
      locale,
    });
    return { ok: true };
  } catch (err) {
    console.error("[feedback] failed to store:", err);
    return { ok: false };
  }
}
