"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StaffOrderCount } from "@/lib/reports";

export default function StaffOrderCountsChart({ title, staff }: { title: string; staff: StaffOrderCount[] }) {
  return (
    <div className="card">
      <p className="section-label">{title}</p>
      {staff.length === 0 ? (
        <p className="text-sm text-[#56524A] py-8 text-center">No orders in this period</p>
      ) : (
        <div style={{ height: Math.max(staff.length * 40, 120) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={staff} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#F0EDE6" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#56524A" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: "#0F0F0F" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#E5E0D5" }} />
              <Bar dataKey="count" fill="#0F0F0F" radius={[0, 6, 6, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
