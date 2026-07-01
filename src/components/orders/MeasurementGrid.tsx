import type { GarmentMeasurements, DualMeas } from "@/types";

function Cell({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="bg-[#F9F8F6] border border-[#E5E0D5] rounded-xl p-3 text-center">
      <p className="text-[10px] text-[#9A9A9A] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0F0F0F]">{value} in</p>
    </div>
  );
}

function DualCell({ label, dual }: { label: string; dual: DualMeas }) {
  if (!dual.lb && !dual.ob) return null;
  return (
    <div className="bg-[#F9F8F6] border border-[#E5E0D5] rounded-xl p-3">
      <p className="text-[10px] text-[#9A9A9A] mb-1.5 text-center">{label}</p>
      <div className="flex gap-2">
        {dual.lb && (
          <div className="flex-1 text-center">
            <p className="text-[9px] text-[#C9A84C] mb-0.5">L.B</p>
            <p className="text-sm font-semibold text-[#0F0F0F]">{dual.lb}</p>
          </div>
        )}
        {dual.ob && (
          <div className="flex-1 text-center border-l border-[#E5E0D5]">
            <p className="text-[9px] text-[#C9A84C] mb-0.5">O.B</p>
            <p className="text-sm font-semibold text-[#0F0F0F]">{dual.ob}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide mt-3 mb-1.5">{children}</p>
  );
}

export default function MeasurementGrid({ measurements }: { measurements: GarmentMeasurements }) {
  if (measurements.type === "blouse") {
    const m = measurements;
    return (
      <div>
        <div className="grid grid-cols-2 gap-2">
          <DualCell label="Length"          dual={m.length} />
          <DualCell label="Shoulder"        dual={m.shoulder} />
          <DualCell label="Half Shoulder"   dual={m.hs} />
          <DualCell label="Sleeve Length"   dual={m.sl} />
          <DualCell label="Mid Sleeve"      dual={m.mlos} />
          <DualCell label="Total Sleeve"    dual={m.tlos} />
          <DualCell label="Arm Hole Size"   dual={m.ahs} />
          <DualCell label="Bust"            dual={m.bust} />
          <DualCell label="Under Bust"      dual={m.ub} />
          <DualCell label="Waist"           dual={m.waist} />
          <DualCell label="Front Neck / NR" dual={m.fnNr} />
          <DualCell label="Back Neck"       dual={m.bn} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Cell label="Dart"              value={m.dart} />
          <Cell label="Dist. Btwn Darts"  value={m.dbd} />
          <Cell label="Dart Point"        value={m.p} />
          <Cell label="Saree Fall"        value={m.sareeFall} />
          <Cell label="Piko"              value={m.piko} />
        </div>
      </div>
    );
  }

  if (measurements.type === "salwar") {
    const m = measurements;
    return (
      <div>
        <SectionLabel>M. Top</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Outer Shalwar"   value={m.top.oShalwar} />
          <Cell label="Lining Shalwar"  value={m.top.lShalwar} />
          <Cell label="Length"          value={m.top.length} />
          <Cell label="Shoulder"        value={m.top.shoulder} />
          <Cell label="Half Shoulder"   value={m.top.hs} />
          <Cell label="Sleeve"          value={m.top.sl} />
          <Cell label="TLCS"            value={m.top.tlcs} />
          <Cell label="Arm Hole"        value={m.top.ah} />
          <Cell label="Bust"            value={m.top.bust} />
          <Cell label="Under Bust"      value={m.top.ub} />
          <Cell label="Waist"           value={m.top.waist} />
          <Cell label="Hip"             value={m.top.hip} />
          <Cell label="Front Neck / NR" value={m.top.fnNr} />
          <Cell label="Back Neck"       value={m.top.bn} />
          <Cell label="Height"          value={m.top.height} />
        </div>

        <SectionLabel>M. Pant</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Hip"         value={m.pant.hip} />
          <Cell label="Waist"       value={m.pant.waist} />
          <Cell label="Knee Length" value={m.pant.kl} />
          <Cell label="Thigh"       value={m.pant.tl} />
          <Cell label="Full Length" value={m.pant.fullLength} />
          <Cell label="Yoke"        value={m.pant.yoke} />
        </div>

        {m.shawl && (
          <>
            <SectionLabel>Shawl</SectionLabel>
            <div className="bg-[#F9F8F6] border border-[#E5E0D5] rounded-xl p-3">
              <p className="text-sm text-[#0F0F0F]">{m.shawl}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  // generic
  const m = measurements;
  const entries = (Object.entries(m) as [string, string][]).filter(([k, v]) => k !== "type" && v);
  return (
    <div className="grid grid-cols-3 gap-2">
      {entries.map(([key, value]) => (
        <Cell key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} />
      ))}
    </div>
  );
}
