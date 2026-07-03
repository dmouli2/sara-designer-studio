import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  new:          { label: "New",          cls: "badge-new" },
  cutting:      { label: "Cutting",      cls: "badge-cutting" },
  cutting_done: { label: "Cutting Done", cls: "badge-cutting_done" },
  stitching:    { label: "Stitching",    cls: "badge-stitching" },
  hemming_hook: { label: "Hemming & Hook", cls: "badge-hemming_hook" },
  ready:        { label: "Ready",        cls: "badge-ready" },
  delivered:    { label: "Delivered",    cls: "badge-delivered" },
  cancelled:    { label: "Cancelled",    cls: "badge-cancelled" },
};

export const STATUS_LABELS: Record<OrderStatus, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, cfg]) => [status, cfg.label])
) as Record<OrderStatus, string>;

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return <span className={cn(cfg.cls)}>{cfg.label}</span>;
}
