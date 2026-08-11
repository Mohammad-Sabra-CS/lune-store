"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(adminLogin, { error: false });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        action={action}
        className="relative w-full max-w-sm space-y-6 border border-night/10 bg-card p-8 animate-in fade-in zoom-in-95 duration-500"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gold" />
        <div className="space-y-1 text-center">
          <p className="font-display text-2xl uppercase tracking-[0.25em] text-night">
            Lune
          </p>
          <p className="text-sm text-muted-foreground">Orders dashboard</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoFocus
            className="rounded-none border-night/25 py-6"
          />
          {state.error && (
            <p className="text-xs text-wine animate-in fade-in slide-in-from-top-1 duration-300">
              Wrong password. Try again.
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="w-full rounded-none bg-night py-6 tracking-[0.2em] uppercase text-moon hover:bg-gold hover:text-night"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
