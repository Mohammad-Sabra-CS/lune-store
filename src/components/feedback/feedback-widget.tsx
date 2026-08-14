"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import type { Locale } from "@/i18n/routing";
import { submitFeedback } from "./actions";

const inputClass =
  "rounded-none border-night/25 bg-card px-4 py-5 text-night focus-visible:border-gold focus-visible:ring-gold/40";

/** Dispatched (e.g. by the mobile menu) to open the feedback sheet. */
export const OPEN_FEEDBACK_EVENT = "lune:open-feedback";

/** Fixed tab on the right edge of the screen that opens a quick-feedback
 *  sheet. Rendered site-wide from the locale layout. */
export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const openSheet = () => setOpen(true);
    window.addEventListener(OPEN_FEEDBACK_EVENT, openSheet);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, openSheet);
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") ?? "").trim();
    if (message.length < 3) {
      setError(true);
      return;
    }
    setError(false);
    startTransition(async () => {
      const result = await submitFeedback({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message,
        locale,
      });
      if (result.ok) {
        setSent(true);
      } else {
        setError(true);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSent(false);
          setError(false);
        }
      }}
    >
      <SheetTrigger
        className={
          "fixed right-0 top-1/2 z-40 hidden h-36 w-9 -translate-y-1/2 items-center justify-center border border-r-0 border-gold-bright/70 bg-gold uppercase text-night transition-colors hover:bg-gold-bright [writing-mode:vertical-rl] sm:flex " +
          (locale === "ar"
            ? "text-[0.85rem] tracking-[0.12em]"
            : "text-[0.65rem] tracking-[0.25em]")
        }
      >
        {t("tab")}
      </SheetTrigger>
      <SheetContent
        side={locale === "ar" ? "right" : "left"}
        className="flex w-full flex-col gap-0 bg-ivory p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-night/10 px-6 py-5 pr-12">
          <SheetTitle className="font-display text-xl tracking-[0.08em] uppercase text-night">
            {t("title")}
          </SheetTitle>
          <SheetDescription className="text-sm text-night/60">
            {t("description")}
          </SheetDescription>
        </SheetHeader>

        {sent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <MoonPhaseGlyph phase="full" className="h-10 w-10 text-gold-deep" />
            <p className="font-display text-lg text-night">{t("thanks")}</p>
            <p className="text-sm text-night/60">{t("thanksNote")}</p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="feedback-name" className="text-night/80">
                {t("name")}
              </Label>
              <Input
                id="feedback-name"
                name="name"
                autoComplete="name"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-email" className="text-night/80">
                {t("email")}
              </Label>
              <Input
                id="feedback-email"
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message" className="text-night/80">
                {t("message")}
              </Label>
              <Textarea
                id="feedback-message"
                name="message"
                rows={5}
                className="rounded-none border-night/25 bg-card px-4 py-3 text-night focus-visible:border-gold focus-visible:ring-gold/40"
              />
            </div>
            {error && (
              <p className="border border-wine/40 bg-wine/5 p-3 text-xs text-wine">
                {t("error")}
              </p>
            )}
            <Button
              type="submit"
              disabled={isPending}
              className="mt-auto w-full rounded-none bg-gold py-6 text-sm tracking-[0.25em] uppercase text-night transition-colors hover:bg-gold-bright"
            >
              {isPending ? t("sending") : t("submit")}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
