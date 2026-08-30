import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STEPS: { id: OrderStatus; label: string }[] = [
  { id: "new",          label: "Ordered"  },
  { id: "cutting",      label: "Cutting"  },
  { id: "stitching",    label: "Stitching"},
  { id: "ready",        label: "Ready"    },
  { id: "delivered",    label: "Done"     },
];


export default function ProgressTracker({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold bg-[#FBECEC] text-[#B04A4A]">
          ✕
        </span>
        <span className="text-[13px] font-medium text-[#B04A4A]">Order cancelled</span>
      </div>
    );
  }

  const stepIdx = (stepId: OrderStatus) => {
    const map: Record<OrderStatus, number> = {
      new: 0, cutting: 1, cutting_done: 1, stitching: 2, hemming_hook: 2, ready: 3,
      // Some garments are with the customer and some aren't — the order has
      // reached the last step without completing it, so it sits on "Ready".
      partly_delivered: 3,
      delivered: 4, cancelled: -1,
    };
    return map[stepId];
  };

  const currentStep = stepIdx(status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all",
                  done    && "bg-[#C9A84C] text-[#0F0F0F] shadow-[0_2px_8px_-1px_rgba(201,168,76,0.5)]",
                  active  && "bg-[#0F0F0F] text-white ring-[5px] ring-[#C9A84C]/30",
                  !done && !active && "bg-[#E5E0D5] text-[#56524A]"
                )}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-2 whitespace-nowrap font-medium",
                  active ? "text-[#0F0F0F]" : done ? "text-[#6E5518]" : "text-[#56524A]"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[3px] flex-1 mb-4.5 mx-1 rounded-full transition-all",
                  i < currentStep ? "bg-[#C9A84C]" : "bg-[#E5E0D5]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
