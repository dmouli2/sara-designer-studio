import { formatCurrency } from "@/lib/utils";
import type { ReportSummary } from "@/lib/reports";

export default function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  const cards = [
    { label: "Total Orders", value: summary.totalOrders.toLocaleString("en-IN") },
    { label: "Active", value: summary.active.toLocaleString("en-IN") },
    { label: "Ready Pickup", value: summary.ready.toLocaleString("en-IN") },
    { label: "Delivered", value: summary.delivered.toLocaleString("en-IN") },
    { label: "Total Revenue", value: formatCurrency(summary.totalRevenue) },
    { label: "Pending Balance", value: formatCurrency(summary.pendingBalance) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white rounded-xl border border-[#E5E0D5] p-3.5 text-center shadow-[0_1px_2px_rgba(15,15,15,0.04)]"
        >
          <p className="text-lg font-bold text-[#0F0F0F] leading-tight">{c.value}</p>
          <p className="text-[11px] text-[#56524A] mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
