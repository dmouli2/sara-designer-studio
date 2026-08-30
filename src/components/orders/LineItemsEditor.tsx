"use client";

import { Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { OrderLineItem } from "@/types";

// The order-items table, shared by the new-order wizard and the admin edit
// screen (they were the same markup twice).
//
// Rows split in two by position, not by a flag on the item: the first
// `presetCount` rows are the dress category's printed rows (fixed label,
// always present, qty 0 = simply not ordered), and everything after them is
// a row someone added — its name is editable and it can be removed. The scan
// normalizer already appends unmatched handwritten rows past the presets, so
// those become editable here for free.
interface Props {
  items: OrderLineItem[];
  presetCount: number;
  onChange: (items: OrderLineItem[]) => void;
}

// Grid shared by the header and every row so the columns line up. The last
// 24px column holds the remove button on custom rows and stays empty on
// preset rows rather than collapsing, which would shift their inputs.
const GRID = "grid grid-cols-[1fr_40px_60px_1fr_24px] gap-2";

export default function LineItemsEditor({ items, presetCount, onChange }: Props) {
  function patch(i: number, next: Partial<OrderLineItem>) {
    onChange(items.map((li, idx) => (idx === i ? { ...li, ...next } : li)));
  }

  function addRow() {
    // qty 1 because someone adding a row means to order the thing; the price
    // is what they still have to type.
    onChange([...items, { particulars: "", qty: 1, amount: 0 }]);
  }

  function removeRow(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((sum, li) => sum + li.qty * li.amount, 0);

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-surface">
      <div className={`${GRID} bg-bg border-b border-border px-3 py-2`}>
        <span className="text-[10px] font-semibold text-fg-2 uppercase tracking-wide">Item</span>
        <span className="text-[10px] font-semibold text-fg-2 uppercase tracking-wide text-center">Qty</span>
        <span className="text-[10px] font-semibold text-fg-2 uppercase tracking-wide text-center">Price ₹</span>
        <span className="text-[10px] font-semibold text-fg-2 uppercase tracking-wide">Comments</span>
        <span />
      </div>

      {items.map((li, i) => {
        const custom = i >= presetCount;
        // Custom rows start nameless, so aria-labels need something stable to
        // hang on: fall back to the row's position.
        const name = li.particulars.trim() || `Item ${i + 1}`;
        return (
          <div
            key={i}
            className={`${GRID} items-center px-3 py-2 ${i % 2 === 1 ? "bg-surface-3" : "bg-surface"} ${
              i > 0 ? "border-t border-border-soft" : ""
            }`}
          >
            {custom ? (
              <input
                className="w-full min-w-0 text-xs border border-border rounded-xl py-1.5 px-2 focus:outline-none focus:border-gold placeholder:text-placeholder"
                placeholder="Item name"
                aria-label={`Item ${i + 1} name`}
                value={li.particulars}
                onChange={(e) => patch(i, { particulars: e.target.value })}
              />
            ) : (
              <span className="text-xs text-fg">{li.particulars}</span>
            )}
            <input
              className="w-full text-center text-sm border border-border rounded-xl py-1.5 focus:outline-none focus:border-gold"
              type="number"
              min="0"
              value={li.qty || ""}
              placeholder="0"
              aria-label={`${name} quantity`}
              onChange={(e) => patch(i, { qty: parseInt(e.target.value) || 0 })}
            />
            <input
              className="w-full text-center text-sm border border-border rounded-xl py-1.5 focus:outline-none focus:border-gold"
              type="number"
              min="0"
              value={li.amount || ""}
              placeholder="0"
              aria-label={`${name} price`}
              onChange={(e) => patch(i, { amount: parseFloat(e.target.value) || 0 })}
            />
            <input
              className="w-full min-w-0 text-[13px] md:text-[16px] border border-border rounded-xl py-1.5 px-2 focus:outline-none focus:border-gold placeholder:text-placeholder"
              placeholder="(…)"
              aria-label={`${name} comments`}
              value={li.note ?? ""}
              onChange={(e) => patch(i, { note: e.target.value })}
            />
            {custom ? (
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => removeRow(i)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-danger bg-danger-light active:scale-90 transition-transform"
              >
                <X size={13} />
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold text-gold-800 bg-gold-50 border-t border-gold-200 active:bg-gold-100 transition-colors"
      >
        <Plus size={15} />
        Add item
      </button>

      {/* Running total, so a long list doesn't need scrolling back to the
          summary card to see what the last edit did. */}
      <div className="flex justify-between px-3 py-2 border-t border-border bg-bg">
        <span className="text-[11px] font-semibold text-fg-2 uppercase tracking-wide">Items total</span>
        <span className="text-[13px] font-semibold text-fg tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
