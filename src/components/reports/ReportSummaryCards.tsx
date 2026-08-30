import { formatCurrency } from "@/lib/utils";
import type { ReportSummary } from "@/lib/reports";

// Six identical boxes in a 3-across grid said every figure here matters
// equally. They don't: the two the owner opens this screen for are the money
// ones, and those were also the two that broke — "₹8,42,300" does not fit a
// third of a 430px phone, so the number the screen exists to show was the one
// getting clipped.
//
// The money figures take a full-width row each and the four counts sit in a
// 2x2 below them. Value stays above label in every card, so a caller (and the
// test) can still read one off the other.
export default function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  const owed = summary.pendingBalance > 0;

  const counts = [
    { label: "Active", value: summary.active.toLocaleString("en-IN") },
    { label: "Ready Pickup", value: summary.ready.toLocaleString("en-IN") },
    { label: "Delivered", value: summary.delivered.toLocaleString("en-IN") },
    { label: "Total Orders", value: summary.totalOrders.toLocaleString("en-IN") },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3.5">
        <p className="text-[26px] font-bold leading-none tracking-tight text-fg tabular-nums">
          {formatCurrency(summary.totalRevenue)}
        </p>
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent-ink">
          Total Revenue
        </p>
      </div>

      <div className="col-span-2 rounded-2xl border border-border bg-surface px-4 py-3.5">
        <p
          className={`text-[26px] font-bold leading-none tracking-tight tabular-nums ${
            owed ? "text-danger-ink" : "text-fg"
          }`}
        >
          {formatCurrency(summary.pendingBalance)}
        </p>
        <p
          className={`mt-1.5 text-[11px] font-semibold uppercase tracking-widest ${
            owed ? "text-danger-ink" : "text-fg-2"
          }`}
        >
          Pending Balance
        </p>
      </div>

      {counts.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-border bg-surface px-3.5 py-3 text-center shadow-[0_1px_2px_rgba(15,15,15,0.04)]"
        >
          <p className="text-[19px] font-bold leading-tight text-fg tabular-nums">{c.value}</p>
          <p className="mt-0.5 text-[11px] text-fg-2">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
