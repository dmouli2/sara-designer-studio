"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import OrderCard from "@/components/orders/OrderCard";
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

  return (
    <div className="screen">
      <TopBar
        title="Cutting Queue"
        subtitle={`${myOrders.length} order${myOrders.length !== 1 ? "s" : ""} to cut`}
        right={
          <button
            onClick={() => router.push("/logout")}
            className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20"
          >
            <LogOut size={16} color="white" />
          </button>
        }
      />

      <PullToRefresh className="scroll-area px-4 pt-4">
        {tab === "queue" ? (
          myOrders.length === 0 ? (
            <div className="text-center pt-16">
              <p className="text-4xl mb-3">✂️</p>
              <p className="text-sm font-medium text-[#0F0F0F]">No orders assigned yet</p>
              <p className="text-xs text-[#9A9A9A] mt-1">Admin will assign orders to your queue</p>
            </div>
          ) : (
            <>
              <p className="section-label">Active</p>
              {myOrders.map((o) => (
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
            <p className="text-xs text-[#9A9A9A] mt-1">Orders you finish cutting will appear here</p>
          </div>
        ) : (
          <>
            <p className="section-label">Cutting done — awaiting tailor</p>
            {doneOrders.map((o) => (
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
