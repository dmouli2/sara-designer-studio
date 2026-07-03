import type { GarmentMeasurements } from "@/types";

function Cell({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="bg-[#F9F8F6] border border-[#E5E0D5] rounded-xl p-3 text-center">
      <p className="text-[10px] text-[#9A9A9A] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0F0F0F]">{value} in</p>
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
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Length"    value={m.length} />
          <Cell label="Shoulder"  value={m.shoulder} />
          <Cell label="HS"        value={m.hs} />
          <Cell label="S.L"       value={m.sl} />
          <Cell label="MLOS"      value={m.mlos} />
          <Cell label="TLOS"      value={m.tlos} />
          <Cell label="AHS"       value={m.ahs} />
          <Cell label="Bust"      value={m.bust} />
          <Cell label="UB"        value={m.ub} />
          <Cell label="Waist"     value={m.waist} />
          <Cell label="FN / NR"   value={m.fnNr} />
          <Cell label="BN"        value={m.bn} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Cell label="Dart"       value={m.dart} />
          <Cell label="DBD"        value={m.dbd} />
          <Cell label="P"          value={m.p} />
          <Cell label="Saree Fall" value={m.sareeFall} />
          <Cell label="Piko"       value={m.piko} />
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
          <Cell label="O.Shalwar" value={m.top.oShalwar} />
          <Cell label="L.Shalwar" value={m.top.lShalwar} />
          <Cell label="Length"    value={m.top.length} />
          <Cell label="Shoulder"  value={m.top.shoulder} />
          <Cell label="HS"        value={m.top.hs} />
          <Cell label="S.L"       value={m.top.sl} />
          <Cell label="TLCS"      value={m.top.tlcs} />
          <Cell label="AH"        value={m.top.ah} />
          <Cell label="Bust"      value={m.top.bust} />
          <Cell label="UB"        value={m.top.ub} />
          <Cell label="Waist"     value={m.top.waist} />
          <Cell label="Hip"       value={m.top.hip} />
          <Cell label="FN / NR"   value={m.top.fnNr} />
          <Cell label="BN"        value={m.top.bn} />
        </div>

        <SectionLabel>M. Pant</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Height"      value={m.pant.height} />
          <Cell label="Hip"         value={m.pant.hip} />
          <Cell label="Waist"       value={m.pant.waist} />
          <Cell label="KL"          value={m.pant.kl} />
          <Cell label="TL"          value={m.pant.tl} />
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
