"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_ORDER_PIECES, type MaterialSource } from "@/types";

// How many garments this order is, cut to the one set of measurements — the
// shop's "three blouses from one saree" case, on either book.
//
// Deliberately just a number, plus one checkbox. Almost every customer
// collects everything at once and brings (or buys) the cloth for all of it in
// one go, so the form asks the two questions that are always true and hides
// the per-garment detail behind an opt-out. At 1 this stores nothing at all
// and the order is written exactly as orders always have been.
interface Props {
  count: number;
  onChange: (count: number) => void;
  // Names the garments ("Blouse 1", "Blouse 2", …).
  labelPrefix: string;
  // Floor for the stepper — on the edit screen, one above however many
  // garments are already with the customer.
  minCount?: number;
  minCountReason?: string;

  // Where the cloth came from. `uniform` true (the default) means every
  // garment shares the order's material source and `sources` is ignored.
  uniform: boolean;
  onUniformChange: (uniform: boolean) => void;
  // One entry per garment, only meaningful when `uniform` is false.
  sources: MaterialSource[];
  onSourceChange: (index: number, source: MaterialSource) => void;
  // The order-level source, shown as the label of the "all the same" option.
  orderSource: MaterialSource;
}

const SOURCE_LABEL: Record<MaterialSource, string> = {
  shop: "From shop",
  customer: "Customer brings",
};

export default function PiecesEditor({
  count,
  onChange,
  labelPrefix,
  minCount = 1,
  minCountReason,
  uniform,
  onUniformChange,
  sources,
  onSourceChange,
  orderSource,
}: Props) {
  const floor = Math.max(minCount, 1);
  const safeCount = Math.max(count, floor);
  const noun = labelPrefix.toLowerCase();

  return (
    <div className="rounded-2xl border border-[#E5E0D5] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#0F0F0F]">How many {noun}s?</p>
          <p className="text-[12px] text-[#56524A] mt-0.5">
            {safeCount === 1
              ? "One garment, delivered in one go."
              : "Same measurements. Each one tracked as it's collected."}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <button
            type="button"
            aria-label="One less piece"
            disabled={safeCount <= floor}
            onClick={() => onChange(safeCount - 1)}
            className="w-9 h-9 rounded-full border border-[#E5E0D5] flex items-center justify-center text-[#0F0F0F] active:scale-90 transition-transform disabled:opacity-30"
          >
            <Minus size={16} />
          </button>
          <span className="text-[17px] font-semibold tabular-nums w-5 text-center" aria-live="polite">
            {safeCount}
          </span>
          <button
            type="button"
            aria-label="One more piece"
            disabled={safeCount >= MAX_ORDER_PIECES}
            onClick={() => onChange(safeCount + 1)}
            className="w-9 h-9 rounded-full border border-[#E5E0D5] flex items-center justify-center text-[#0F0F0F] active:scale-90 transition-transform disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {minCountReason && safeCount <= floor && (
        <p className="px-4 pb-3 -mt-1 text-[12px] text-[#56524A]">{minCountReason}</p>
      )}

      {safeCount > 1 && (
        <>
          {/* Opt-out, not opt-in: a mixed order is the rare one, so the
              default keeps this section to a single line. */}
          <label className="flex items-start gap-2.5 px-4 py-3 border-t border-[#F0EDE6] cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 shrink-0 accent-[#C9A84C]"
              checked={uniform}
              onChange={(e) => onUniformChange(e.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-[13px] text-[#0F0F0F]">
                All {safeCount} use the same material ({SOURCE_LABEL[orderSource].toLowerCase()})
              </span>
              <span className="block text-[12px] text-[#56524A] mt-0.5">
                Untick if the customer brought cloth for some and is buying the rest.
              </span>
            </span>
          </label>

          {!uniform && (
            <div className="border-t border-[#F0EDE6]">
              {Array.from({ length: safeCount }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2",
                    i > 0 && "border-t border-[#F5F3EF]"
                  )}
                >
                  <span className="w-6 h-6 shrink-0 rounded-full bg-[#FBF6E8] text-[#7A6020] text-[11px] font-bold flex items-center justify-center tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-[#0F0F0F] min-w-0 flex-1 truncate">
                    {labelPrefix} {i + 1}
                  </span>
                  <div className="flex rounded-xl border border-[#E5E0D5] overflow-hidden shrink-0">
                    {(["customer", "shop"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-label={`${labelPrefix} ${i + 1} material ${s}`}
                        aria-pressed={(sources[i] ?? orderSource) === s}
                        onClick={() => onSourceChange(i, s)}
                        className={cn(
                          "px-2.5 py-1.5 text-[12px] font-medium transition-all",
                          (sources[i] ?? orderSource) === s
                            ? "bg-[#0F0F0F] text-white"
                            : "bg-white text-[#6B6B6B]"
                        )}
                      >
                        {s === "shop" ? "Shop" : "Customer"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="px-4 py-2.5 text-[12px] text-[#7A6020] bg-[#FBF6E8] border-t border-[#EDD98A]">
            {labelPrefix} 1–{safeCount} share this order&apos;s delivery date. Any one of them can
            be handed over on its own day, and the order page keeps the count.
          </p>
        </>
      )}
    </div>
  );
}
