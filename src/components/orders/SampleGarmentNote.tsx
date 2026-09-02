import { Shirt } from "lucide-react";
import { sampleGarmentLabel } from "@/lib/utils";

// Three readers, three different things they need to know about the same
// fact — so the copy is written per audience rather than left as one neutral
// sentence that serves nobody:
//
//   shop      the admin, on the order detail page. Also the reminder that
//             the garment is the customer's and has to go back.
//   workshop  the master and the tailor, where the measurement grid would
//             otherwise be. They need "don't look for measurements, cut to
//             the garment in the bag" and nothing else.
//   customer  the tracking page, which never shows measurements at all. The
//             customer needs to know their blouse is safe with us and is
//             coming back.
export type SampleGarmentAudience = "shop" | "workshop" | "customer";

function bodyFor(audience: SampleGarmentAudience, label: string): string {
  const lower = label.toLowerCase();
  if (audience === "workshop") {
    return `No measurements were taken for this order — the customer's own ${lower} is with the order. Cut to it.`;
  }
  if (audience === "customer") {
    return `You gave us your own ${lower} to stitch to. It is safe with us and comes back to you with your order.`;
  }
  return `The customer left their own ${lower} instead of being measured, so no measurements were taken. It is the customer's garment — hand it back with the order.`;
}

export default function SampleGarmentNote({
  dress,
  audience = "shop",
}: {
  dress: string;
  audience?: SampleGarmentAudience;
}) {
  const label = sampleGarmentLabel(dress);
  return (
    <div className="rounded-2xl border border-gold-edge bg-gold-25 p-4 flex gap-3">
      <span className="w-9 h-9 rounded-xl bg-gold-50 flex items-center justify-center shrink-0">
        <Shirt size={18} className="text-accent-ink" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-gold-800">{label} with us</p>
        <p className="text-[13px] text-accent-ink mt-0.5">{bodyFor(audience, label)}</p>
      </div>
    </div>
  );
}
