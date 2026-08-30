"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ChartColumn } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import ReportDateRangeFilter from "@/components/reports/ReportDateRangeFilter";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards";
import RevenueTrendChart from "@/components/reports/RevenueTrendChart";
import StatusBreakdownChart from "@/components/reports/StatusBreakdownChart";
import PaymentsSummaryChart from "@/components/reports/PaymentsSummaryChart";
import DressTypeRevenueChart from "@/components/reports/DressTypeRevenueChart";
import StaffOrderCountsChart from "@/components/reports/StaffOrderCountsChart";
import {
  DEFAULT_REPORT_DATE_RANGE,
  resolveDateRange,
  filterOrdersByDateRange,
  computeSummary,
  computeRevenueTrend,
  computeStatusBreakdown,
  computePaymentsSummary,
  computeRevenueByDressType,
  computeStaffOrderCounts,
  type ReportDateRange,
} from "@/lib/reports";
import type { Order } from "@/types";

const NAV_TABS = [
  { id: "orders", label: "Orders", icon: <ClipboardList size={20} /> },
  { id: "reports", label: "Reports", icon: <ChartColumn size={20} /> },
];

export default function ReportsBody({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [range, setRange] = useState<ReportDateRange>(DEFAULT_REPORT_DATE_RANGE);

  const bounds = useMemo(() => resolveDateRange(range), [range]);
  const filtered = useMemo(() => filterOrdersByDateRange(orders, range), [orders, range]);

  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const revenueTrend = useMemo(() => computeRevenueTrend(filtered, bounds), [filtered, bounds]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(filtered), [filtered]);
  const payments = useMemo(() => computePaymentsSummary(filtered), [filtered]);
  const dressRevenue = useMemo(() => computeRevenueByDressType(filtered), [filtered]);
  const masterCounts = useMemo(() => computeStaffOrderCounts(filtered, "master"), [filtered]);
  const tailorCounts = useMemo(() => computeStaffOrderCounts(filtered, "tailor"), [filtered]);

  return (
    <div className="screen">
      <TopBar title="Reports" subtitle="Sara Designer Studio" backHref="/admin/orders" />

      <div className="scroll-area px-4 pt-4 space-y-4">
        <ReportDateRangeFilter value={range} onChange={setRange} />
        <ReportSummaryCards summary={summary} />

        {/* Six charts stacked in one column meant scrolling past most of the
            picture on a tablet. Two across from `md` up; the revenue trend
            keeps the full width because it is the one chart read as a shape
            over time rather than a comparison, and it is the reason this
            screen gets opened. Phones are unchanged: one column throughout. */}
        <RevenueTrendChart points={revenueTrend} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusBreakdownChart statuses={statusBreakdown} />
          <PaymentsSummaryChart payments={payments} />
          <DressTypeRevenueChart dresses={dressRevenue} />
          <StaffOrderCountsChart title="Orders per Master" staff={masterCounts} />
          <StaffOrderCountsChart title="Orders per Tailor" staff={tailorCounts} />
        </div>
        <div className="h-6" />
      </div>

      <BottomNav
        tabs={NAV_TABS}
        active="reports"
        onChange={(id) => {
          if (id === "orders") router.push("/admin/orders");
        }}
      />
    </div>
  );
}
