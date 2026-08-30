import type { GarmentMeasurements } from "@/types";

function Cell({ label, value, note }: { label: string; value?: string; note?: string }) {
  if (!value && !note) return null;
  return (
    <div className="bg-bg border border-border rounded-xl p-3 text-center">
      <p className="text-[10px] text-fg-2 mb-1">{label}</p>
      <p className="text-sm font-semibold text-fg">{value ? `${value} in` : "—"}</p>
      {note && <p className="text-[11px] text-accent-ink italic mt-0.5">({note})</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold text-fg-2 uppercase tracking-wide mt-3 mb-1.5">{children}</p>
  );
}

export default function MeasurementGrid({ measurements }: { measurements: GarmentMeasurements }) {
  if (measurements.type === "blouse") {
    const m = measurements;
    const n = m.fieldNotes;
    return (
      <div>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Length"    value={m.length}   note={n?.length} />
          <Cell label="Shoulder"  value={m.shoulder} note={n?.shoulder} />
          <Cell label="HS"        value={m.hs}       note={n?.hs} />
          <Cell label="S.L"       value={m.sl}       note={n?.sl} />
          <Cell label="MLOS"      value={m.mlos}     note={n?.mlos} />
          <Cell label="TLOS"      value={m.tlos}     note={n?.tlos} />
          <Cell label="AHS"       value={m.ahs}      note={n?.ahs} />
          <Cell label="UB"        value={m.ub}       note={n?.ub} />
          <Cell label="Bust"      value={m.bust}     note={n?.bust} />
          <Cell label="Waist"     value={m.waist}    note={n?.waist} />
          <Cell label="FN / NR"   value={m.fnNr}     note={n?.fnNr} />
          <Cell label="BN"        value={m.bn}       note={n?.bn} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Cell label="Dart"       value={m.dart}      note={n?.dart} />
          <Cell label="DBD"        value={m.dbd}       note={n?.dbd} />
          <Cell label="P"          value={m.p}         note={n?.p} />
          <Cell label="Saree Fall" value={m.sareeFall} note={n?.sareeFall} />
          <Cell label="Piko"       value={m.piko}      note={n?.piko} />
        </div>
      </div>
    );
  }

  if (measurements.type === "salwar") {
    const m = measurements;
    const tn = m.topNotes;
    const pn = m.pantNotes;
    return (
      <div>
        <SectionLabel>M. Top</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {/* O.Shalwar / L.Shalwar no longer exist on the form — rendered
              only for old orders that still carry a value. */}
          <Cell label="O.Shalwar" value={m.top.oShalwar} note={tn?.oShalwar} />
          <Cell label="L.Shalwar" value={m.top.lShalwar} note={tn?.lShalwar} />
          <Cell label="Length"    value={m.top.length}   note={tn?.length} />
          <Cell label="Shoulder"  value={m.top.shoulder} note={tn?.shoulder} />
          <Cell label="HS"        value={m.top.hs}       note={tn?.hs} />
          <Cell label="S.L"       value={m.top.sl}       note={tn?.sl} />
          <Cell label="TLCS"      value={m.top.tlcs}     note={tn?.tlcs} />
          <Cell label="AH"        value={m.top.ah}       note={tn?.ah} />
          <Cell label="UB"        value={m.top.ub}       note={tn?.ub} />
          <Cell label="Bust"      value={m.top.bust}     note={tn?.bust} />
          <Cell label="Waist"     value={m.top.waist}    note={tn?.waist} />
          <Cell label="Hip"       value={m.top.hip}      note={tn?.hip} />
          <Cell label="FN / NR"   value={m.top.fnNr}     note={tn?.fnNr} />
          <Cell label="BN"        value={m.top.bn}       note={tn?.bn} />
        </div>

        <SectionLabel>M. Pant</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Cell label="Height"      value={m.pant.height}     note={pn?.height} />
          <Cell label="Hip"         value={m.pant.hip}        note={pn?.hip} />
          <Cell label="Waist"       value={m.pant.waist}      note={pn?.waist} />
          <Cell label="KL"          value={m.pant.kl}         note={pn?.kl} />
          <Cell label="TL"          value={m.pant.tl}         note={pn?.tl} />
          <Cell label="Full Length" value={m.pant.fullLength} note={pn?.fullLength} />
          <Cell label="Yoke"        value={m.pant.yoke}       note={pn?.yoke} />
        </div>

        {m.shawl && (
          <>
            <SectionLabel>Shawl</SectionLabel>
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-sm text-fg">{m.shawl}</p>
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
