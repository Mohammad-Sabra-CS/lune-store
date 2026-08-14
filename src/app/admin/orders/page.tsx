import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  filterOrders,
  isArchived,
  listOrders,
  type OrderFilters as Filters,
} from "@/lib/orders";
import type { OrderStatus } from "@/lib/db/schema";
import { ARCHIVE_AFTER_DAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LoginForm } from "../login-form";
import { AdminShell } from "../_components/admin-shell";
import { OrderFilters } from "../_components/order-filters";
import { OrdersTable } from "../_components/orders-table";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const sp = await searchParams;
  const view = str(sp.view) === "archive" ? "archive" : "active";
  const status = str(sp.status);
  const filters: Filters = {
    status:
      status === "new" || status === "delivered" ? (status as OrderStatus) : "all",
    q: str(sp.q),
    from: str(sp.from),
    to: str(sp.to),
  };

  const orders = await listOrders();
  const active = orders.filter((o) => !isArchived(o));
  const archived = orders.filter((o) => isArchived(o));
  const filtered = filterOrders(view === "archive" ? archived : active, filters);

  // Tab links preserve the current filters
  const keep = new URLSearchParams();
  for (const key of ["status", "q", "from", "to"]) {
    const value = str(sp[key]);
    if (value) keep.set(key, value);
  }
  const activeHref = `/admin/orders${keep.size ? `?${keep}` : ""}`;
  keep.set("view", "archive");
  const archiveHref = `/admin/orders?${keep}`;

  const tabs = [
    { href: activeHref, label: `Active (${active.length})`, current: view === "active" },
    { href: archiveHref, label: `Archive (${archived.length})`, current: view === "archive" },
  ];

  return (
    <AdminShell title="Orders" subtitle={`${filtered.length} shown`}>
      <div className="mb-6 flex gap-2 border-b border-night/10">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-xs uppercase tracking-wider transition-colors duration-200",
              tab.current
                ? "border-gold text-night"
                : "border-transparent text-muted-foreground hover:text-night",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <OrderFilters />
      <OrdersTable
        orders={filtered}
        emptyMessage={
          view === "archive" ? "No archived orders." : "No matching orders."
        }
        emptyHint={
          view === "archive"
            ? `Delivered orders move here automatically after ${ARCHIVE_AFTER_DAYS} days.`
            : "Adjust the filters or check the archive."
        }
      />
    </AdminShell>
  );
}
