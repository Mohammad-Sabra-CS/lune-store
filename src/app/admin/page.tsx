import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listOrders } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";
import { OrdersTable } from "./orders-table";
import { adminLogout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const orders = await listOrders();
  const newCount = orders.filter((o) => o.status === "new").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.2em] text-night">
            Lune — Orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} total · {newCount} new
          </p>
        </div>
        <form action={adminLogout}>
          <Button
            type="submit"
            variant="ghost"
            className="rounded-none text-xs uppercase tracking-wider text-muted-foreground"
          >
            Sign out
          </Button>
        </form>
      </div>
      <OrdersTable orders={orders} />
    </div>
  );
}
