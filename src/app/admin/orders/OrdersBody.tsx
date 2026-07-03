"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Users, SlidersHorizontal, Search } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import Toast from "@/components/layout/Toast";
import OrderCard from "@/components/orders/OrderCard";
import { getOrders } from "@/app/actions/orders";
import OrderFiltersSheet, {
  EMPTY_ORDER_FILTERS,
  hasActiveFilters,
  type OrderFilterValues,
} from "@/components/orders/OrderFiltersSheet";
import { cn, isOrderOverdue, matchesOrderSearch } from "@/lib/utils";
import type { AssignedStaff, Order, OrderStatus } from "@/types";

type OrderFilter = OrderStatus | "all" | "overdue";

// One page of order history. The server page loads the first page; older
// pages are appended on demand so the list doesn't grow unbounded with years
// of history. Must match what src/app/admin/orders/page.tsx requests.
export const ORDERS_PAGE_SIZE = 200;

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "overdue",      label: "Overdue" },
  { id: "new",          label: "New" },
  { id: "cutting",      label: "Cutting" },
  { id: "cutting_done", label: "Cutting Done" },
  { id: "stitching",    label: "Stitching" },
  { id: "hemming_hook", label: "Hemming & Hook" },
  { id: "ready",        label: "Ready" },
  { id: "delivered",    label: "Delivered" },
  { id: "cancelled",    label: "Cancelled" },
];

const NAV_TABS = [
  { id: "orders",  label: "Orders",  icon: "📋" },
  { id: "reports", label: "Reports", icon: "📊" },
];

function uniqueStaff(list: (AssignedStaff | null)[]): AssignedStaff[] {
  const map = new Map<string, AssignedStaff>();
  for (const s of list) if (s) map.set(s.id, s);
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function OrdersBody({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [advanced, setAdvanced] = useState<OrderFilterValues>(EMPTY_ORDER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [olderOrders, setOlderOrders] = useState<Order[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialOrders.length === ORDERS_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);

  // A pull-to-refresh re-renders the server page and replaces initialOrders;
  // previously loaded older pages are kept and deduped against it.
  const orders = useMemo(() => {
    const seen = new Set(initialOrders.map((o) => o.id));
    return [...initialOrders, ...olderOrders.filter((o) => !seen.has(o.id))];
  }, [initialOrders, olderOrders]);

  async function loadOlder() {
    setLoadingMore(true);
    try {
      const older = await getOrders({ limit: ORDERS_PAGE_SIZE, offset: orders.length });
      setOlderOrders((prev) => [...prev, ...older]);
      setHasMore(older.length === ORDERS_PAGE_SIZE);
    } catch {
      setError("Couldn't load older orders. Check your connection and try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const masters = useMemo(() => uniqueStaff(orders.map((o) => o.master)), [orders]);
  const tailors = useMemo(() => uniqueStaff(orders.map((o) => o.tailor)), [orders]);

  const filtered = orders
    .filter((o) =>
      filter === "all" ? true : filter === "overdue" ? isOrderOverdue(o.due, o.status) : o.status === filter
    )
    .filter((o) => !advanced.masterId || o.master?.id === advanced.masterId)
    .filter((o) => !advanced.tailorId || o.tailor?.id === advanced.tailorId)
    .filter((o) => !advanced.due || o.due.slice(0, 10) === advanced.due)
    .filter((o) => matchesOrderSearch(o, search));

  const filtersActive = hasActiveFilters(advanced);

  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const overdueCount = orders.filter((o) => isOrderOverdue(o.due, o.status)).length;

  return (
    <div className="screen">
      <TopBar
        title="Sara Designer Studio"
        subtitle={overdueCount > 0 ? `${activeCount} active · ${overdueCount} overdue` : `${activeCount} active orders`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/staff")}
              aria-label="Staff"
              className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all"
            >
              <Users size={18} color="white" />
            </button>
            <button
              onClick={() => router.push("/logout")}
              aria-label="Log out"
              className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center active:bg-white/20 active:scale-95 transition-all"
            >
              <LogOut size={18} color="white" />
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or mobile number"
            aria-label="Search orders"
            className="input pl-10 py-2.5 text-[14px]"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#F0EDE6]">
        <button
          type="button"
          aria-label="More filters"
          onClick={() => setFiltersOpen(true)}
          className={cn(
            "relative flex-none w-9 h-9 rounded-full flex items-center justify-center border active:scale-95 transition-all",
            filtersActive ? "bg-[#0F0F0F] border-[#0F0F0F] text-white" : "bg-white border-[#E5E0D5] text-[#6B6B6B]"
          )}
        >
          <SlidersHorizontal size={16} />
          {filtersActive && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#C9A84C]" />}
        </button>

        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-none px-4 py-2 rounded-full text-[13px] font-medium active:scale-95 transition-all ${
                filter === f.id
                  ? "bg-[#0F0F0F] text-white shadow-[0_2px_8px_-1px_rgba(15,15,15,0.3)]"
                  : "bg-white border border-[#E5E0D5] text-[#6B6B6B]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
        {hasMore && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingMore}
            className="w-full py-3 mb-3 text-[13px] font-medium text-[#6B6B6B] border border-[#E5E0D5] rounded-xl bg-white active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : "Load older orders"}
          </button>
        )}
      </PullToRefresh>

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[430px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[820px] z-40 pointer-events-none">
        <div className="flex justify-end pr-5">
          <button
            type="button"
            aria-label="New order"
            onClick={() => router.push("/admin/orders/new")}
            className="fab-glow pointer-events-auto w-14 h-14 rounded-full bg-[#C9A84C] flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={26} color="#0F0F0F" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <BottomNav
        tabs={NAV_TABS}
        active="orders"
        onChange={(id) => {
          if (id === "reports") router.push("/admin/reports");
        }}
      />

      <OrderFiltersSheet
        open={filtersOpen}
        values={advanced}
        masters={masters}
        tailors={tailors}
        onChange={setAdvanced}
        onClear={() => setAdvanced(EMPTY_ORDER_FILTERS)}
        onClose={() => setFiltersOpen(false)}
      />

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
