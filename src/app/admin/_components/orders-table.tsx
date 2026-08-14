"use client";

import { useTransition } from "react";
import type { Order } from "@/lib/orders";
import type { OrderStatus } from "@/lib/db/schema";
import { ARCHIVE_AFTER_DAYS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { setOrderStatus } from "../actions";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  OrderStatus,
  { pill: string; dot: string; next: OrderStatus; nextLabel: string; button: string }
> = {
  new: {
    pill: "bg-gold/20 text-night",
    dot: "bg-gold-deep",
    next: "delivered",
    nextLabel: "Mark delivered",
    button: "border-gold text-night hover:bg-gold",
  },
  delivered: {
    pill: "bg-night/10 text-muted-foreground",
    dot: "bg-night/30",
    next: "new",
    nextLabel: "Mark new",
    button: "border-night/20 text-muted-foreground",
  },
};

function StatusButton({ order }: { order: Order }) {
  const [pending, startTransition] = useTransition();
  const meta = STATUS_META[order.status as OrderStatus] ?? STATUS_META.new;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => setOrderStatus(order.id, meta.next))}
      className={cn("rounded-none text-xs uppercase tracking-wider", meta.button)}
    >
      {pending ? (
        <span
          aria-label="Saving"
          className="inline-block h-3 w-3 animate-spin rounded-full border border-night/30 border-t-night"
        />
      ) : (
        meta.nextLabel
      )}
    </Button>
  );
}

function archiveDate(order: Order): string | null {
  if (order.status !== "delivered" || !order.deliveredAt) return null;
  const at = new Date(order.deliveredAt);
  at.setDate(at.getDate() + ARCHIVE_AFTER_DAYS);
  return at.toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export function OrdersTable({
  orders,
  emptyMessage = "No orders yet.",
  emptyHint = "They will appear here as customers check out.",
}: {
  orders: Order[];
  emptyMessage?: string;
  emptyHint?: string;
}) {
  if (orders.length === 0) {
    return (
      <div className="border border-dashed border-night/15 py-16 text-center animate-in fade-in duration-500">
        <p className="font-display text-lg text-night/60">{emptyMessage}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-night/10 bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-night text-start text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-start">Order</th>
            <th className="px-4 py-3 text-start">Customer</th>
            <th className="px-4 py-3 text-start">Contact</th>
            <th className="px-4 py-3 text-start">Delivery</th>
            <th className="px-4 py-3 text-start">Items</th>
            <th className="px-4 py-3 text-end">Total</th>
            <th className="px-4 py-3 text-start">Payment</th>
            <th className="px-4 py-3 text-start">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night/10">
          {orders.map((order) => {
            const meta = STATUS_META[order.status as OrderStatus] ?? STATUS_META.new;
            const archivesOn = archiveDate(order);
            return (
              <tr
                key={order.id}
                className="align-top transition-colors duration-200 hover:bg-night/[0.03]"
              >
                <td className="px-4 py-4">
                  <p className="font-medium text-night">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </td>
                <td className="px-4 py-4 text-night">{order.customerName}</td>
                <td className="px-4 py-4">
                  <p dir="ltr">{order.phone}</p>
                  <p className="text-xs text-muted-foreground">{order.email}</p>
                </td>
                <td className="px-4 py-4 text-night/80">
                  {order.city} — {order.address}
                </td>
                <td className="px-4 py-4 text-night/80">
                  <div className="flex max-w-48 flex-wrap gap-1.5">
                    {order.items.map((item) => (
                      <span
                        key={item.slug}
                        className="border border-night/10 bg-night/[0.04] px-2 py-0.5 text-xs whitespace-nowrap"
                      >
                        {item.name} × {item.qty}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-end font-medium tabular-nums text-night">
                  {order.total} JD
                </td>
                <td className="px-4 py-4 uppercase text-night/70">
                  {order.paymentMethod}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={cn(
                      "mb-2 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wider transition-colors duration-300",
                      meta.pill,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
                    />
                    {order.status}
                  </span>
                  {archivesOn && (
                    <p className="mb-2 text-[0.7rem] text-muted-foreground">
                      Archives {archivesOn}
                    </p>
                  )}
                  <StatusButton order={order} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
