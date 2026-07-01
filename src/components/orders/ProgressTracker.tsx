import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const STEPS: { id: OrderStatus; label: string }[] = [
  { id: "new",          label: "Ordered"  },
  { id: "cutting",      label: "Cutting"  },
  { id: "stitching",    label: "Stitching"},
  { id: "ready",        label: "Ready"    },
  { id: "delivered",    label: "Done"     },
];

const ORDER: OrderStatus[] = ["new", "cutting", "cutting_done", "stitching", "ready", "delivered"];

export default function ProgressTracker({ status }: { status: OrderStatus }) {
  const currentIdx = ORDER.indexOf(status);

  const stepIdx = (stepId: OrderStatus) => {
    const map: Record<OrderStatus, number> = {
      new: 0, cutting: 1, cutting_done: 1, stitching: 2, ready: 3, delivered: 4,
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
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  done    && "bg-[#C9A84C] text-[#0F0F0F]",
                  active  && "bg-[#0F0F0F] text-white ring-4 ring-[#C9A84C]/30",
                  !done && !active && "bg-[#E5E0D5] text-[#9A9A9A]"
                )}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[9px] mt-1.5 whitespace-nowrap font-medium",
                  active ? "text-[#0F0F0F]" : done ? "text-[#C9A84C]" : "text-[#9A9A9A]"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mb-4 mx-1 rounded-full transition-all",
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
