"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { legendLabel } from "./legendLabel";
import { formatChartCurrency, type PaymentsSummary } from "@/lib/reports";

export default function PaymentsSummaryChart({ payments }: { payments: PaymentsSummary }) {
  const hasData = payments.advanceCollected > 0 || payments.balanceDue > 0;
  const data = [{ name: "Payments", Collected: payments.advanceCollected, Pending: payments.balanceDue }];

  return (
    <div className="card">
      <p className="section-label">Advance Collected vs Balance Due</p>
      {!hasData ? (
        <p className="text-sm text-fg-2 py-8 text-center">No orders in this period</p>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#F0EDE6" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#56524A" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip formatter={formatChartCurrency} contentStyle={{ borderRadius: 12, borderColor: "#E5E0D5" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendLabel} />
              <Bar dataKey="Collected" stackId="a" fill="#1B6B3A" radius={[6, 0, 0, 6]} isAnimationActive={false} />
              <Bar dataKey="Pending" stackId="a" fill="#C9A84C" radius={[0, 6, 6, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
