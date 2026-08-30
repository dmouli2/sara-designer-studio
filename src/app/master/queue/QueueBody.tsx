"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import OrderCard from "@/components/orders/OrderCard";
import { matchesOrderSearch } from "@/lib/utils";
import type { Order } from "@/types";

const NAV_TABS = [
  { id: "queue", label: "Queue",     icon: "✂️" },
  { id: "done",  label: "Completed", icon: "✓" },
];

interface Props {
  myOrders: Order[];
  doneOrders: Order[];
}

export default function QueueBody({ myOrders, doneOrders }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [search, setSearch] = useState("");

  const visibleMy = myOrders.filter((o) => matchesOrderSearch(o, search));
  const visibleDone = doneOrders.filter((o) => matchesOrderSearch(o, search));
  const searching = search.trim().length > 0;

  return (
    <div className="screen">
      <TopBar
        title="Cutting Queue"
        subtitle={`${myOrders.length} order${myOrders.length !== 1 ? "s" : ""} to cut`}
        right={
          <button
            onClick={() => router.push("/logout")}
            className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all"
          >
            <LogOut size={18} color="white" />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-1">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56524A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, order id or mobile"
            aria-label="Search orders"
            className="input pl-10 py-2.5 text-[16px]"
          />
        </div>
      </div>

      <PullToRefresh className="scroll-area px-4 pt-3">
        {tab === "queue" ? (
          myOrders.length === 0 ? (
            <div className="text-center pt-16">
              <p className="text-4xl mb-3">✂️</p>
              <p className="text-sm font-medium text-[#0F0F0F]">No orders assigned yet</p>
              <p className="text-xs text-[#56524A] mt-1">Admin will assign orders to your queue</p>
            </div>
          ) : visibleMy.length === 0 && searching ? (
            <div className="text-center pt-16">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-sm text-[#56524A]">No orders match your search</p>
            </div>
          ) : (
            <>
              <p className="section-label">Active</p>
              {visibleMy.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => router.push(`/master/orders/${o.id}`)}
                  showPrice={false}
                />
              ))}
            </>
          )
        ) : doneOrders.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-sm font-medium text-[#0F0F0F]">No completed orders yet</p>
            <p className="text-xs text-[#56524A] mt-1">Orders you finish cutting will appear here</p>
          </div>
        ) : visibleDone.length === 0 && searching ? (
          <div className="text-center pt-16">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm text-[#56524A]">No orders match your search</p>
          </div>
        ) : (
          <>
            <p className="section-label">Cutting done — awaiting tailor</p>
            {visibleDone.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => router.push(`/master/orders/${o.id}`)}
                className="opacity-70"
                showPrice={false}
              />
            ))}
          </>
        )}
      </PullToRefresh>

      <BottomNav tabs={NAV_TABS} active={tab} onChange={(id) => setTab(id as "queue" | "done")} />
    </div>
  );
}
