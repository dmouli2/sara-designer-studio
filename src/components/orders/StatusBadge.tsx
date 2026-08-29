import { cn, orderDisplayStatus, type OrderDisplayStatus } from "@/lib/utils";
import type { AlterationRecord, OrderStatus } from "@/types";

// Keyed by OrderDisplayStatus, not OrderStatus: the two alteration entries
// are not pipeline stages. An order in alteration is still `delivered` in the
// database — the badge is the one place that says otherwise, because "In
// Alteration" is what the admin needs to read off a list, while revenue and
// the delivered count must keep counting it as delivered.
const STATUS_CONFIG: Record<OrderDisplayStatus, { label: string; cls: string }> = {
  new:              { label: "New",             cls: "badge-new" },
  cutting:          { label: "Cutting",         cls: "badge-cutting" },
  cutting_done:     { label: "Cutting Done",    cls: "badge-cutting_done" },
  stitching:        { label: "Stitching",       cls: "badge-stitching" },
  hemming_hook:     { label: "Hemming & Hook",  cls: "badge-hemming_hook" },
  ready:            { label: "Ready",           cls: "badge-ready" },
  partly_delivered: { label: "Part Delivered",  cls: "badge-partly_delivered" },
  delivered:        { label: "Delivered",       cls: "badge-delivered" },
  cancelled:        { label: "Cancelled",       cls: "badge-cancelled" },
  in_alteration:    { label: "In Alteration",   cls: "badge-in_alteration" },
  alteration_done:  { label: "Alteration Done", cls: "badge-alteration_done" },
};

export const STATUS_LABELS: Record<OrderDisplayStatus, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, cfg]) => [status, cfg.label])
) as Record<OrderDisplayStatus, string>;

// `alterations` is optional so every existing call site — the queues, the
// public tracking page — keeps working unchanged and simply never shows an
// alteration state.
export default function StatusBadge({
  status,
  alterations,
}: {
  status: OrderStatus;
  alterations?: AlterationRecord[];
}) {
  const display = alterations ? orderDisplayStatus({ status, alterations }) : status;
  const cfg = STATUS_CONFIG[display] ?? STATUS_CONFIG.new;
  return <span className={cn(cfg.cls)}>{cfg.label}</span>;
}
