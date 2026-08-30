"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { legendLabel } from "./legendLabel";
import type { OrderStatus } from "@/types";
import type { StatusCount } from "@/lib/reports";

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "#C9A84C",
  cutting: "#0F0F0F",
  cutting_done: "#EDD98A",
  stitching: "#F5E9BB",
  hemming_hook: "#2E5C99",
  ready: "#1B6B3A",
  partly_delivered: "#7FB69A",
  delivered: "#6B6B6B",
  cancelled: "#B04A4A",
};

export default function StatusBreakdownChart({ statuses }: { statuses: StatusCount[] }) {
  return (
    <div className="card">
      <p className="section-label">Orders by Status</p>
      {statuses.length === 0 ? (
        <p className="text-sm text-[#9A9A9A] py-8 text-center">No orders in this period</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statuses}
                dataKey="count"
                nameKey="label"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {statuses.map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendLabel} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
