"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Users } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import OrderCard from "@/components/orders/OrderCard";
import type { Order, OrderStatus } from "@/types";

const FILTERS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "new",          label: "New" },
  { id: "cutting",      label: "Cutting" },
  { id: "cutting_done", label: "Cut Done" },
  { id: "stitching",    label: "Stitching" },
  { id: "ready",        label: "Ready" },
  { id: "delivered",    label: "Delivered" },
];

const NAV_TABS = [
  { id: "orders",  label: "Orders",  icon: "📋" },
  { id: "reports", label: "Reports", icon: "📊" },
];

export default function OrdersBody({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const stats = {
    total:   orders.length,
    active:  orders.filter((o) => !["delivered"].includes(o.status)).length,
    ready:   orders.filter((o) => o.status === "ready").length,
  };

  return (
    <div className="screen">
      <TopBar
        title="Sara Designer Studio"
        subtitle={`${stats.active} active orders`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/orders/new")}
              className="w-9 h-9 bg-[#C9A84C] rounded-xl flex items-center justify-center active:opacity-80"
            >
              <Plus size={18} color="#0F0F0F" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => router.push("/logout")}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20"
            >
              <LogOut size={16} color="white" />
            </button>
            <button
              onClick={() => router.push("/admin/staff")}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20"
            >
              <Users size={16} color="white" />
            </button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="px-4 pt-4 pb-2 grid grid-cols-3 gap-2">
        {[
          { label: "Total Orders", value: stats.total },
          { label: "Ready Pickup", value: stats.ready },
          { label: "Active",       value: stats.active },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E5E0D5] p-3 text-center">
            <p className="text-xl font-bold text-[#0F0F0F]">{s.value}</p>
            <p className="text-[10px] text-[#9A9A9A] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-[#F0EDE6]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-none px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f.id
                ? "bg-[#0F0F0F] text-white"
                : "bg-white border border-[#E5E0D5] text-[#6B6B6B]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Order list */}
      <PullToRefresh>
        {filtered.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm text-[#9A9A9A]">No orders found</p>
          </div>
        ) : (
          filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onClick={() => router.push(`/admin/orders/${o.id}`)}
            />
          ))
        )}
      </PullToRefresh>

      <BottomNav tabs={NAV_TABS} active="orders" onChange={() => {}} />
    </div>
  );
}
