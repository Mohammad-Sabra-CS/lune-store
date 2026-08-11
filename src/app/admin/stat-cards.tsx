import type { Order } from "@/lib/orders";

export function StatCards({ orders }: { orders: Order[] }) {
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const newCount = orders.filter((o) => o.status === "new").length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: "Total orders", value: String(orders.length) },
    { label: "New", value: String(newCount), accent: true },
    { label: "Delivered", value: String(delivered) },
    { label: "Revenue", value: `${revenue} JD` },
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
            <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gold" />
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
