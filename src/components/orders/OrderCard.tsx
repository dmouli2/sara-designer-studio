import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import type { Order } from "@/types";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  className?: string;
  showPrice?: boolean;
}

export default function OrderCard({ order, onClick, className, showPrice = true }: OrderCardProps) {
  const isCancelled = order.status === "cancelled";
  const balance = order.amount - order.advance;
  const isNew = order.status === "new";

  return (
    <div
      onClick={onClick}
      className={cn(
        "card mb-3.5 cursor-pointer active:scale-[0.98] transition-all active:shadow-none",
        isNew && "border-l-4 border-l-[#C9A84C]",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {isNew && (
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A84C] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9A84C]" />
            </span>
          )}
          <span className="text-[15px] font-semibold text-[#0F0F0F]">{order.id}</span>
          <span className="text-[15px] text-[#6B6B6B]">· {order.customer}</span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <p className="text-[13px] text-[#6B6B6B] mb-2.5">
        {order.dress} · {order.material}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-1 rounded-md",
            order.master ? "bg-[#F0EDE6] text-[#6B6B6B]" : "bg-[#FBECEC] text-[#B04A4A]"
          )}
        >
          ✂️ {order.master ? order.master.name : "Not assigned"}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-1 rounded-md",
            order.tailor ? "bg-[#F0EDE6] text-[#6B6B6B]" : "bg-[#FBECEC] text-[#B04A4A]"
          )}
        >
          🧵 {order.tailor ? order.tailor.name : "Not assigned"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#9A9A9A]">Due {formatDate(order.due)}</span>
        {showPrice && (
          <div className="text-right">
            {isCancelled ? (
              <>
                <p className="text-[13px] text-[#9A9A9A] line-through">{formatCurrency(order.amount)}</p>
                <p className="text-[13px] font-semibold text-[#B04A4A]">
                  {formatCurrency(order.cancellationCharge ?? 0)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#0F0F0F]">{formatCurrency(order.amount)}</p>
                {balance > 0 && (
                  <p className="text-[11px] text-[#C9A84C] font-medium">
                    Bal {formatCurrency(balance)}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
