import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listOrders } from "@/lib/orders";
import { listFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";
import { OrdersTable } from "./orders-table";
import { FeedbackTable } from "./feedback-table";
import { StatCards } from "./stat-cards";
import { adminLogout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const [orders, feedbackItems] = await Promise.all([
    listOrders(),
    listFeedback(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between border-b border-night/10 pb-6">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.2em] text-night">
            Lune
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-gold-deep">
            Orders dashboard
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
      <StatCards orders={orders} />
      <OrdersTable orders={orders} />
      <h2 className="mb-4 mt-10 text-xs uppercase tracking-[0.25em] text-gold-deep">
        Feedback
      </h2>
      <FeedbackTable items={feedbackItems} />
    </div>
  );
}
