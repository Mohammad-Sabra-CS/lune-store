import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listOrders, isArchived } from "@/lib/orders";
import { getStoreProductsFresh } from "@/lib/products";
import { LoginForm } from "./login-form";
import { AdminShell } from "./_components/admin-shell";
import { StatCards } from "./_components/stat-cards";
import { OrdersTable } from "./_components/orders-table";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const [orders, products] = await Promise.all([
    listOrders(),
    getStoreProductsFresh(),
  ]);
  const latest = orders.filter((o) => !isArchived(o)).slice(0, 5);

  return (
    <AdminShell title="Dashboard" subtitle="Store overview">
      <StatCards orders={orders} products={products} />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.25em] text-gold-deep">
          Latest orders
        </h2>
        <Link
          href="/admin/orders"
          className="text-xs uppercase tracking-wider text-night underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
      <OrdersTable orders={latest} />
    </AdminShell>
  );
}
