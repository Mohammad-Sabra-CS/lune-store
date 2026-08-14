import type { Feedback } from "@/lib/feedback";

export function FeedbackTable({ items }: { items: Feedback[] }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-night/15 py-12 text-center animate-in fade-in duration-500">
        <p className="font-display text-lg text-night/60">No feedback yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Visitor feedback from the site widget will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-night/10 bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-night text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 text-start">Date</th>
            <th className="px-4 py-3 text-start">Name</th>
            <th className="px-4 py-3 text-start">Email</th>
            <th className="px-4 py-3 text-start">Locale</th>
            <th className="px-4 py-3 text-start">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-night/10">
          {items.map((item) => (
            <tr
              key={item.id}
              className="align-top transition-colors duration-200 hover:bg-night/[0.03]"
            >
              <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
              <td className="px-4 py-4 text-night">{item.name ?? "—"}</td>
              <td className="px-4 py-4 text-night/80">{item.email ?? "—"}</td>
              <td className="px-4 py-4 uppercase text-night/70">{item.locale}</td>
              <td className="max-w-md px-4 py-4 text-night/80" dir="auto">
                {item.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
