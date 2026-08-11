"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EASE, RevealItem } from "@/components/motion/primitives";

const STARS = [
  { x: 7, y: 9, r: 1.1, o: 0.9 },
  { x: 41, y: 7, r: 0.8, o: 0.6 },
  { x: 44, y: 36, r: 1.2, o: 0.8 },
  { x: 5, y: 39, r: 0.7, o: 0.5 },
];

/** The order's moon waxes from crescent to full while a gold ring draws
 *  itself — then the words arrive. Reduced motion renders the final state. */
function WaxingMoon() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 48 48" className="h-24 w-24 text-gold" aria-hidden>
      <defs>
        <mask id="confirm-moon">
          <rect width="48" height="48" fill="white" />
          {reduce ? (
            <circle cx={56} cy={21} r={18} fill="black" />
          ) : (
            <motion.circle
              cy={21}
              r={18}
              fill="black"
              initial={{ cx: 14 }}
              animate={{ cx: 56 }}
              transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
            />
          )}
        </mask>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="17"
        fill="currentColor"
        mask="url(#confirm-moon)"
      />
      <motion.circle
        cx="24"
        cy="24"
        r="21.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
      />
      {STARS.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#ebd9a8"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: s.o }}
          transition={{ delay: 1 + i * 0.18, duration: 0.5, ease: EASE }}
        />
      ))}
    </svg>
  );
}

export function ConfirmationReveal({ order }: { order?: string }) {
  const t = useTranslations("confirmation");
  return (
    <motion.div
      className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 px-4 py-32 text-center"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12, delayChildren: 0.9 } },
      }}
    >
      <WaxingMoon />
      <RevealItem>
        <h1 className="font-display text-3xl tracking-wide sm:text-4xl">
          {t("title")}
        </h1>
      </RevealItem>
      <RevealItem>
        <p className="max-w-sm leading-relaxed text-moon/70">{t("subtitle")}</p>
      </RevealItem>
      {order && (
        <RevealItem>
          <p className="border border-gold/40 px-6 py-3 text-sm tracking-[0.2em]">
            {t("orderNumber")}:{" "}
            <span className="text-gold" dir="ltr">
              {order}
            </span>
          </p>
        </RevealItem>
      )}
      <RevealItem>
        <p className="text-sm text-moon/60">{t("emailNote")}</p>
      </RevealItem>
      <RevealItem>
        <Button
          render={<Link href="/" />}
          variant="outline"
          className="mt-4 rounded-none border-gold bg-transparent px-10 py-6 text-xs tracking-[0.3em] uppercase text-gold transition-colors hover:bg-gold hover:text-night"
        >
          {t("backHome")}
        </Button>
      </RevealItem>
    </motion.div>
  );
}
