"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartCurrency, type RevenuePoint } from "@/lib/reports";

export default function RevenueTrendChart({ points }: { points: RevenuePoint[] }) {
  return (
    <div className="card">
      <p className="section-label">Revenue Trend</p>
      {points.length === 0 ? (
        <p className="text-sm text-[#9A9A9A] py-8 text-center">No orders in this period</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={{ stroke: "#E5E0D5" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#9A9A9A" }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <Tooltip formatter={formatChartCurrency} contentStyle={{ borderRadius: 12, borderColor: "#E5E0D5" }} />
              {/* Every series on this page draws immediately.
                  Recharts' mount animation grows each series from nothing over
                  ~1.5s, which on a phone reads as a card that failed to load —
                  convincingly enough that this page has twice been reported as
                  broken when the data was fine all along. On six small charts
                  the animation buys nothing worth that. */}
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#C9A84C"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#C9A84C" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
