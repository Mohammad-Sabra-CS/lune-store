import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listFeedback } from "@/lib/feedback";
import { LoginForm } from "../login-form";
import { AdminShell } from "../_components/admin-shell";
import { FeedbackTable } from "../_components/feedback-table";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  if (!(await isAdminAuthenticated())) {
    return <LoginForm />;
  }

  const items = await listFeedback();

  return (
    <AdminShell title="Feedback" subtitle={`${items.length} total`}>
      <FeedbackTable items={items} />
    </AdminShell>
  );
}
