export const DRESS_TYPES = ["Blouse", "Salwar"];

export const FABRICS = [
  { name: "Cotton",          price: 120 },
  { name: "Silk",            price: 350 },
  { name: "Georgette",       price: 280 },
  { name: "Crepe",           price: 220 },
  { name: "Net / Lace",      price: 180 },
  { name: "Chiffon",         price: 200 },
  { name: "Kanjivaram Silk", price: 650 },
  { name: "Velvet",          price: 400 },
];

// Line item presets keyed by dress category
export const LINE_ITEM_PRESETS: Record<"blouse" | "salwar", string[]> = {
  blouse: ["Blouse", "Lining Blouse", "Designs", "Embroidery", "Skirt Top", "Sareesfalls Piko"],
  salwar: ["Salwar", "Lining Salwar", "Designs", "Shawl / Piko", "Maxi", "Skirt Top"],
};

export function lineItemCategoryForDress(dress: string): "blouse" | "salwar" {
  if (dress === "Salwar") return "salwar";
  return "blouse";
}
