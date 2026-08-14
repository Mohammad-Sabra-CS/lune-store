import type { Order } from "@/lib/orders";
import type { StoreProduct } from "@/lib/products";
import { isSoldOut } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function StatCards({
  orders,
  products,
}: {
  orders: Order[];
  products: StoreProduct[];
}) {
  const newCount = orders.filter((o) => o.status === "new").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const soldOutCount = products.filter(isSoldOut).length;

  const stats: { label: string; value: string; accent?: "gold" | "wine" }[] = [
    { label: "New orders", value: String(newCount), accent: "gold" },
    { label: "Delivered", value: String(delivered) },
    { label: "Revenue", value: `${revenue} JD` },
    {
      label: "Sold out",
      value: `${soldOutCount} / ${products.length}`,
      accent: soldOutCount > 0 ? "wine" : undefined,
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="relative border border-night/10 bg-card p-5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {stat.accent && (
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 top-0 h-0.5",
                stat.accent === "gold" ? "bg-gold" : "bg-wine",
              )}
            />
          )}
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums text-night">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
