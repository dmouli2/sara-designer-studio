"use client";

// Recharts colours each legend label with its own series colour. Half of this
// palette is pale by design — Stitching is #F5E9BB, Cutting Done #EDD98A,
// Pending #C9A84C — so those labels rendered near-white on a white card and
// could not be read at all. The swatch beside the label already carries the
// colour, so the text only has to be legible.
//
// Shared by every Reports chart that draws a legend, so the fix cannot drift
// apart between them.
export function legendLabel(value: string) {
  return <span style={{ color: "#3A3A3C" }}>{value}</span>;
}
