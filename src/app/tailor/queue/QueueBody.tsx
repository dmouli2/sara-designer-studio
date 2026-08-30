"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search, SearchX, Spool, CheckCheck } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import OrderCard from "@/components/orders/OrderCard";
import { matchesOrderSearch } from "@/lib/utils";
import type { Order } from "@/types";

const NAV_TABS = [
  { id: "queue", label: "Queue", icon: <Spool size={20} /> },
  { id: "done",  label: "Done",  icon: <CheckCheck size={20} /> },
];

interface Props {
  myOrders: Order[];
  readyOrders: Order[];
}

export default function QueueBody({ myOrders, readyOrders }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "done">("queue");
  const [search, setSearch] = useState("");

  const visibleMy = myOrders.filter((o) => matchesOrderSearch(o, search));
  const visibleReady = readyOrders.filter((o) => matchesOrderSearch(o, search));
  const searching = search.trim().length > 0;

  return (
    <div className="screen">
      <TopBar
        title="Stitching Queue"
        subtitle={`${myOrders.length} job${myOrders.length !== 1 ? "s" : ""} active`}
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
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-2" />
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
              <Spool size={34} className="mx-auto mb-3 text-fg-faint" aria-hidden="true" />
              <p className="text-sm font-medium text-fg">No jobs assigned yet</p>
              <p className="text-xs text-fg-2 mt-1">Admin will assign jobs after cutting is done</p>
            </div>
          ) : visibleMy.length === 0 && searching ? (
            <div className="text-center pt-16">
              <SearchX size={30} className="mx-auto mb-3 text-fg-faint" aria-hidden="true" />
              <p className="text-sm text-fg-2">No jobs match your search</p>
            </div>
          ) : (
            <>
              <p className="section-label">In progress</p>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3.5">
                {visibleMy.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    className="md:mb-0"
                    onClick={() => router.push(`/tailor/orders/${o.id}`)}
                    showPrice={false}
                  />
                ))}
              </div>
            </>
          )
        ) : readyOrders.length === 0 ? (
          <div className="text-center pt-16">
            <CheckCheck size={34} className="mx-auto mb-3 text-fg-faint" aria-hidden="true" />
            <p className="text-sm font-medium text-fg">No completed jobs yet</p>
            <p className="text-xs text-fg-2 mt-1">Orders you finish stitching will appear here</p>
          </div>
        ) : visibleReady.length === 0 && searching ? (
          <div className="text-center pt-16">
            <SearchX size={30} className="mx-auto mb-3 text-fg-faint" aria-hidden="true" />
            <p className="text-sm text-fg-2">No jobs match your search</p>
          </div>
        ) : (
          <>
            <p className="section-label">Ready for pickup</p>
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3.5">
              {visibleReady.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => router.push(`/tailor/orders/${o.id}`)}
                  className="opacity-70 md:mb-0"
                  showPrice={false}
                />
              ))}
            </div>
          </>
        )}
      </PullToRefresh>

      <BottomNav tabs={NAV_TABS} active={tab} onChange={(id) => setTab(id as "queue" | "done")} />
    </div>
  );
}
