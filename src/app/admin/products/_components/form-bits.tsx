"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminActionState } from "../actions";

export const fieldClass =
  "rounded-none border-night/25 bg-ivory px-3 py-2 text-sm text-night focus-visible:border-gold focus-visible:ring-gold/40";

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </label>
  );
}

/** Submit button + inline result message for a product editor panel. */
export function FormFooter({
  state,
  pending,
  label = "Save",
}: {
  state: AdminActionState;
  pending: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button
        type="submit"
        disabled={pending}
        className="rounded-none bg-night px-6 text-xs uppercase tracking-wider text-ivory hover:bg-night/85"
      >
        {pending ? (
          <span
            aria-label="Saving"
            className="inline-block h-3 w-3 animate-spin rounded-full border border-ivory/40 border-t-ivory"
          />
        ) : (
          label
        )}
      </Button>
      {!pending && state.error && (
        <p className="text-xs text-wine animate-in fade-in duration-300">{state.error}</p>
      )}
      {!pending && state.ok && (
        <p className="text-xs text-gold-deep animate-in fade-in duration-300">Saved.</p>
      )}
    </div>
  );
}

export function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("border border-night/10 bg-card p-6", className)}
    >
      <h2 className="text-xs uppercase tracking-[0.25em] text-gold-deep">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
