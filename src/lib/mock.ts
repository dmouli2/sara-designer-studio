export const DRESS_TYPES = ["Blouse", "Salwar"];

// The fabric price list used to live here as a constant — it's now the
// `fabrics` table (admin-managed via the new-order wizard), seeded by
// supabase/migrations/0006_fabrics.sql.

// Line item presets keyed by dress category
export const LINE_ITEM_PRESETS: Record<"blouse" | "salwar", string[]> = {
  blouse: ["Blouse", "Lining Blouse", "Designs", "Embroidery", "Skirt Top", "Sareesfalls Piko"],
  salwar: ["Salwar", "Lining Salwar", "Designs", "Shawl / Piko", "Maxi", "Skirt Top"],
};

export function lineItemCategoryForDress(dress: string): "blouse" | "salwar" {
  if (dress === "Salwar") return "salwar";
  return "blouse";
}

// Both books take orders for several garments cut to one set of measurements
// — three blouses from one saree, two salwar sets to the same measurements.
// A helper rather than an inline check so the wizard and the edit screen can
// never disagree about which orders may be split.
export function canDressHavePieces(dress: string | null): boolean {
  return dress === "Blouse" || dress === "Salwar";
}
