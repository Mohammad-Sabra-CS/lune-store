import { Button } from "@/components/ui/button";
import { adminLogout } from "../actions";
import { AdminNav } from "./nav";

/**
 * Sidebar layout for authenticated admin pages. On mobile the sidebar
 * collapses to a top bar with horizontally scrolling nav links.
 */
export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col bg-night text-ivory lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between border-b border-ivory/10 px-6 py-4 lg:block lg:py-6">
          <div>
            <p className="font-display text-xl uppercase tracking-[0.2em]">Lune</p>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.25em] text-gold">
              Admin
            </p>
          </div>
          <form action={adminLogout} className="lg:hidden">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="rounded-none text-xs uppercase tracking-wider text-ivory/60 hover:bg-ivory/10 hover:text-ivory"
            >
              Sign out
            </Button>
          </form>
        </div>
        <AdminNav />
        <form
          action={adminLogout}
          className="mt-auto hidden border-t border-ivory/10 p-4 lg:block"
        >
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start rounded-none text-xs uppercase tracking-wider text-ivory/60 hover:bg-ivory/10 hover:text-ivory"
          >
            Sign out
          </Button>
        </form>
      </aside>

      <div className="bg-ivory">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-night/10 pb-6 animate-in fade-in duration-500">
            <div>
              <h1 className="font-display text-2xl uppercase tracking-[0.15em] text-night">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-gold-deep">
                  {subtitle}
                </p>
              )}
            </div>
            {actions}
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
