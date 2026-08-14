"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-9 rounded-none border border-night/25 bg-card px-3 text-sm text-night focus-visible:border-gold focus-visible:ring-gold/40";

/** URL-driven order filters: status, search, date range. */
export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam("q", value.trim()), 300);
  }

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const hasFilters = ["status", "q", "from", "to"].some((k) =>
    searchParams.get(k),
  );

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-52 flex-1">
        <label
          htmlFor="order-search"
          className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
        >
          Search
        </label>
        <Input
          id="order-search"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Order no., customer, phone…"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="order-status"
          className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
        >
          Status
        </label>
        <select
          id="order-status"
          value={searchParams.get("status") ?? "all"}
          onChange={(e) =>
            setParam("status", e.target.value === "all" ? "" : e.target.value)
          }
          className={fieldClass}
        >
          <option value="all">All</option>
          <option value="new">New</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="order-from"
          className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
        >
          From
        </label>
        <input
          id="order-from"
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="order-to"
          className="mb-1 block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
        >
          To
        </label>
        <input
          id="order-to"
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className={fieldClass}
        />
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            const params = new URLSearchParams(searchParams);
            ["status", "q", "from", "to"].forEach((k) => params.delete(k));
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }}
          className="h-9 rounded-none text-xs uppercase tracking-wider text-muted-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
