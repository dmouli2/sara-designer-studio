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
  const balance = order.amount - order.advance;

  return (
    <div
      onClick={onClick}
      className={cn(
        "card mb-3.5 cursor-pointer active:scale-[0.98] transition-all active:shadow-none",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <span className="text-[15px] font-semibold text-[#0F0F0F]">{order.id}</span>
          <span className="text-[15px] text-[#6B6B6B] ml-1.5">· {order.customer}</span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <p className="text-[13px] text-[#6B6B6B] mb-3">
        {order.dress} · {order.material}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-[#9A9A9A]">
          <span>Due {formatDate(order.due)}</span>
          {order.master && (
            <>
              <span>·</span>
              <span>{order.master.name}</span>
            </>
          )}
        </div>
        {showPrice && (
          <div className="text-right">
            <p className="text-[15px] font-semibold text-[#0F0F0F]">{formatCurrency(order.amount)}</p>
            {balance > 0 && (
              <p className="text-[11px] text-[#C9A84C] font-medium">
                Bal {formatCurrency(balance)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
