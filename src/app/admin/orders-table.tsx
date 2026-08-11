"use client";

import { useTransition } from "react";
import type { Order } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { setOrderStatus } from "./actions";
import { cn } from "@/lib/utils";

function StatusButton({ order }: { order: Order }) {
  const [pending, startTransition] = useTransition();
  const next = order.status === "new" ? "delivered" : "new";

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => setOrderStatus(order.id, next))}
      className={cn(
        "rounded-none text-xs uppercase tracking-wider",
        order.status === "new"
          ? "border-gold text-night hover:bg-gold"
          : "border-night/20 text-muted-foreground",
      )}
    >
      {pending ? "…" : order.status === "new" ? "Mark delivered" : "Mark new"}
    </Button>
  );
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No orders yet. They will appear here as customers check out.
      </p>
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
          {orders.map((order) => (
            <tr key={order.id} className="align-top">
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
                {order.items.map((item) => (
                  <p key={item.slug}>
                    {item.name} × {item.qty}
                  </p>
                ))}
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
                    "mb-2 block w-fit px-2 py-0.5 text-xs uppercase tracking-wider",
                    order.status === "new"
                      ? "bg-gold/20 text-night"
                      : "bg-night/10 text-muted-foreground",
                  )}
                >
                  {order.status}
                </span>
                <StatusButton order={order} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
