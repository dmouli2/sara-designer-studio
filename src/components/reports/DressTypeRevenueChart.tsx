"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartCurrency, type DressRevenue } from "@/lib/reports";

export default function DressTypeRevenueChart({ dresses }: { dresses: DressRevenue[] }) {
  return (
    <div className="card">
      <p className="section-label">Revenue by Dress Type</p>
      {dresses.length === 0 ? (
        <p className="text-sm text-[#9A9A9A] py-8 text-center">No orders in this period</p>
      ) : (
        <div style={{ height: Math.max(dresses.length * 44, 120) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dresses} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#F0EDE6" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9A9A9A" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <YAxis type="category" dataKey="dress" width={80} tick={{ fontSize: 12, fill: "#0F0F0F" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={formatChartCurrency} contentStyle={{ borderRadius: 12, borderColor: "#E5E0D5" }} />
              <Bar dataKey="revenue" fill="#C9A84C" radius={[0, 6, 6, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
