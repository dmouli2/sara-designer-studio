"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Toast from "@/components/layout/Toast";
import MeasurementForm from "@/components/orders/MeasurementForm";
import SketchCanvas from "@/components/orders/SketchCanvas";
import ReferenceImageUpload from "@/components/orders/ReferenceImageUpload";
import MaterialImageUpload from "@/components/orders/MaterialImageUpload";
import { LINE_ITEM_PRESETS, lineItemCategoryForDress } from "@/lib/mock";
import { formatCurrency, isValidIndianMobile } from "@/lib/utils";
import { galleryEntryToFile, MAX_PHOTO_PAYLOAD_BYTES } from "@/lib/image";
import { updateOrder, type OrderEditInput } from "@/app/actions/orders";
import type { GarmentMeasurements, Order, OrderLineItem, PaymentMethod } from "@/types";

// The stored order only carries the items that were actually ordered —
// overlay them on the dress-category presets so the admin can also add an
// item that wasn't on the original order. Stored items that aren't presets
// (from older preset lists) are kept at the end.
function initialLineItems(order: Order): OrderLineItem[] {
  const presets = LINE_ITEM_PRESETS[lineItemCategoryForDress(order.dress)];
  const byName = new Map(order.lineItems.map((li) => [li.particulars, li]));
  return [
    ...presets.map((p) => byName.get(p) ?? { particulars: p, qty: 0, amount: 0 }),
    ...order.lineItems.filter((li) => !presets.includes(li.particulars)),
  ];
}

function stitchTotalOf(items: OrderLineItem[]): number {
  return items.reduce((s, li) => s + li.qty * li.amount, 0);
}

// Same normalization the wizard applies before createOrder: drop untouched
// preset rows, strip empty notes.
function activeItemsOf(items: OrderLineItem[]): OrderLineItem[] {
  return items
    .filter((li) => li.qty > 0 && li.amount > 0)
    .map(({ note, ...li }) => (note?.trim() ? { ...li, note: note.trim() } : li));
}

export default function EditOrderForm({ order }: { order: Order }) {
  const router = useRouter();

  const [name, setName]         = useState(order.customer);
  const [phone, setPhone]       = useState(order.phone);
  const [material, setMaterial] = useState(order.material);
  const [meas, setMeas]         = useState<GarmentMeasurements>(order.measurements);
  const [notes, setNotes]       = useState(order.notes);
  const [due, setDue]           = useState(order.due?.slice(0, 10) ?? "");
  const [advance, setAdvance]   = useState(String(order.advance));
  // Starts as whatever the order actually has — null for one taken before
  // methods were captured. Defaulting to "cash" here would silently rewrite
  // every legacy order's history the first time someone opened this form.
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod | null>(order.advanceMethod);
  const [lineItems, setLineItems] = useState<OrderLineItem[]>(() => initialLineItems(order));
  // Line-item edits move the total by their delta; the admin can still type
  // a total directly (the fabric portion isn't itemized on a stored order).
  const [totalOverride, setTotalOverride] = useState<string | null>(null);

  // Galleries start as the stored photos' signed http URLs; newly captured
  // photos are base64 data URLs. A gallery that still JSON-matches its
  // initial value is never re-sent.
  const [materialImages, setMaterialImages] = useState<string[]>(order.materialImageUrls);
  const [refImages, setRefImages]           = useState<string[]>(order.referenceImageUrls);
  const [sketch, setSketch]                 = useState<string | null>(order.sketchDataUrl);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const computedTotal = order.amount - stitchTotalOf(order.lineItems) + stitchTotalOf(lineItems);
  const total   = totalOverride !== null ? parseFloat(totalOverride || "0") : computedTotal;
  const balance = total - parseFloat(advance || "0");

  // The existing sketch is a Storage URL we can't draw over (the canvas
  // would taint) — show it read-only until the admin removes it, at which
  // point a blank canvas appears for redrawing.
  const keepingStoredSketch = !!sketch && !sketch.startsWith("data:");

  function setLineItem(i: number, patch: Partial<OrderLineItem>) {
    setLineItems((prev) => prev.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  }

  async function handleSave() {
    if (saving) return;

    const patch: OrderEditInput = {};
    if (name !== order.customer)     patch.customer = name;
    if (phone !== order.phone)       patch.phone = phone;
    if (material !== order.material) patch.material = material;
    if (notes !== order.notes)       patch.notes = notes;
    if (due !== (order.due?.slice(0, 10) ?? "")) patch.due = due;
    if (JSON.stringify(meas) !== JSON.stringify(order.measurements)) patch.measurements = meas;

    const advanceNum = parseFloat(advance || "0");
    if (advanceNum !== order.advance) patch.advance = advanceNum;
    // Method only travels when there is an advance to attribute it to; a
    // zeroed advance clears it rather than leaving a stale "Cash".
    const nextMethod = advanceNum > 0 ? advanceMethod : null;
    if (nextMethod !== (order.advanceMethod ?? null)) patch.advanceMethod = nextMethod;

    const items = activeItemsOf(lineItems);
    if (JSON.stringify(items) !== JSON.stringify(order.lineItems)) patch.lineItems = items;
    if (total !== order.amount) patch.amount = total;

    const sketchChanged = sketch !== order.sketchDataUrl;
    const refChanged    = JSON.stringify(refImages) !== JSON.stringify(order.referenceImageUrls);
    const matChanged    = JSON.stringify(materialImages) !== JSON.stringify(order.materialImageUrls);

    setSaving(true);
    try {
      let photos: FormData | undefined;
      if (sketchChanged || refChanged || matChanged) {
        photos = new FormData();
        if (sketchChanged) {
          photos.append("sketchChanged", "1");
          if (sketch) photos.append("sketch", await galleryEntryToFile(sketch, "sketch.png"));
        }
        if (refChanged) {
          photos.append("referenceChanged", "1");
          const files = await Promise.all(
            refImages.map((img, i) => galleryEntryToFile(img, `reference-${i + 1}.jpg`))
          );
          for (const file of files) photos.append("reference", file);
        }
        if (matChanged) {
          photos.append("materialChanged", "1");
          const files = await Promise.all(
            materialImages.map((img, i) => galleryEntryToFile(img, `material-${i + 1}.jpg`))
          );
          for (const file of files) photos.append("material", file);
        }

        const payloadBytes = ["sketch", "reference", "material"]
          .flatMap((field) => photos!.getAll(field))
          .reduce((sum, entry) => sum + (entry instanceof File ? entry.size : 0), 0);
        if (payloadBytes > MAX_PHOTO_PAYLOAD_BYTES) {
          setError(
            `Photos are too large to send together (${(payloadBytes / 1024 / 1024).toFixed(1)} MB, limit 3.5 MB). Remove a photo or two and try again.`
          );
          return;
        }
      }

      if (Object.keys(patch).length === 0 && !photos) {
        router.push(`/admin/orders/${order.id}`);
        return;
      }

      await updateOrder(order.id, patch, photos);
      router.push(`/admin/orders/${order.id}`);
    } catch {
      setError("Couldn't save the changes. Check your connection and try again — nothing was lost.");
    } finally {
      setSaving(false);
    }
  }

  const invalid =
    !name.trim() ||
    !isValidIndianMobile(phone) ||
    !due ||
    materialImages.length === 0 ||
    !Number.isFinite(total) || total < 0 ||
    !Number.isFinite(parseFloat(advance || "0")) || parseFloat(advance || "0") < 0;

  return (
    <div className="screen">
      <TopBar
        title={`Edit ${order.id}`}
        subtitle={`${order.customer} · ${order.dress}`}
        onBack={() => router.push(`/admin/orders/${order.id}`)}
      />

      <div className="scroll-area px-4 pt-5 space-y-5">
        <div>
          <p className="section-label">Customer details</p>
          <div className="space-y-3">
            <input className="input" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <input className="input" placeholder="Phone / WhatsApp *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phone.trim() && !isValidIndianMobile(phone) && (
                <p className="text-xs text-red-600 mt-1">Enter a valid 10-digit Indian mobile number.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <p className="section-label">Material</p>
          <input className="input" placeholder="Material description" value={material} onChange={(e) => setMaterial(e.target.value)} />
        </div>

        <div>
          <p className="section-label">Material photos</p>
          <MaterialImageUpload value={materialImages} onChange={setMaterialImages} />
          {materialImages.length === 0 && (
            <p className="text-xs text-red-600 mt-1.5">At least one material photo is required.</p>
          )}
        </div>

        <div>
          <p className="section-label">Measurements (in) — {order.dress}</p>
          <MeasurementForm dress={order.dress} value={meas} onChange={setMeas} />
        </div>

        <div>
          <p className="section-label">Style notes</p>
          <textarea className="input resize-none" rows={3}
            placeholder="Embroidery, piping, closures, special requests…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <p className="section-label">Garment sketch</p>
          {keepingStoredSketch ? (
            <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sketch!} alt="Current sketch" className="w-full" />
              <button
                type="button"
                onClick={() => setSketch(null)}
                className="w-full flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-[#B04A4A] border-t border-[#F0EDE6] active:bg-[#FBECEC] transition-colors"
              >
                <Trash2 size={16} />
                Remove sketch & redraw
              </button>
            </div>
          ) : (
            <SketchCanvas value={sketch} onChange={setSketch} />
          )}
        </div>

        <div>
          <p className="section-label">Reference photos</p>
          <ReferenceImageUpload value={refImages} onChange={setRefImages} />
        </div>

        <div>
          <p className="section-label">Order items</p>
          <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
            <div className="grid grid-cols-[1fr_44px_64px_1fr] gap-2 bg-[#F9F8F6] border-b border-[#E5E0D5] px-3 py-2">
              <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Item</span>
              <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">Qty</span>
              <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">Price ₹</span>
              <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Comments</span>
            </div>
            {lineItems.map((li, i) => (
              <div key={i} className={`grid grid-cols-[1fr_44px_64px_1fr] items-center px-3 py-2 gap-2 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"} ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}>
                <span className="text-xs text-[#0F0F0F]">{li.particulars}</span>
                <input
                  className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                  type="number" min="0" value={li.qty || ""}
                  placeholder="0"
                  aria-label={`${li.particulars} quantity`}
                  onChange={(e) => setLineItem(i, { qty: parseInt(e.target.value) || 0 })}
                />
                <input
                  className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                  type="number" min="0" value={li.amount || ""}
                  placeholder="0"
                  aria-label={`${li.particulars} price`}
                  onChange={(e) => setLineItem(i, { amount: parseFloat(e.target.value) || 0 })}
                />
                <input
                  className="w-full min-w-0 text-[13px] border border-[#E5E0D5] rounded-lg py-1.5 px-2 focus:outline-none focus:border-[#C9A84C] placeholder:text-[#C4C0B6]"
                  placeholder="(…)"
                  aria-label={`${li.particulars} comments`}
                  value={li.note ?? ""}
                  onChange={(e) => setLineItem(i, { note: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="section-label">Payment</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#9A9A9A] mb-1 block">Order total (₹)</label>
              <input
                className="input"
                type="number"
                value={totalOverride ?? String(computedTotal)}
                onChange={(e) => setTotalOverride(e.target.value)}
              />
              <p className="text-xs text-[#9A9A9A] mt-1">
                Follows item changes automatically — adjust here if the fabric cost changed too.
              </p>
            </div>
            <div>
              <label className="text-xs text-[#9A9A9A] mb-1 block">Advance collected (₹)</label>
              <input className="input" type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              {parseFloat(advance || "0") > 0 && (
                <div className="flex rounded-xl border border-[#E5E0D5] overflow-hidden bg-white mt-2">
                  {(["cash", "upi"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={advanceMethod === m}
                      onClick={() => setAdvanceMethod(m)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                        advanceMethod === m ? "bg-[#0F0F0F] text-white" : "text-[#6B6B6B]"
                      }`}
                    >
                      {m === "cash" ? "Cash" : "UPI"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-[#9A9A9A] mb-1 block">Delivery date *</label>
              <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card-gold">
          <div className="flex justify-between text-sm font-bold text-[#0F0F0F]">
            <span>Total</span>
            <span>{formatCurrency(Number.isFinite(total) ? total : 0)}</span>
          </div>
          <div className="flex justify-between text-xs text-[#6B6B6B] mt-1">
            <span>Advance</span>
            <span>{formatCurrency(parseFloat(advance || "0") || 0)}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold text-[#C9A84C] mt-0.5">
            <span>Balance due</span>
            <span>{formatCurrency(balance > 0 ? balance : 0)}</span>
          </div>
        </div>

        {!due && <p className="text-xs text-red-600 -mt-2">Delivery date is required.</p>}

        <button onClick={handleSave} disabled={saving || invalid} className="btn-gold disabled:opacity-40">
          {saving ? "Saving changes…" : "✓ Save Changes"}
        </button>
        <button onClick={() => router.push(`/admin/orders/${order.id}`)} disabled={saving} className="btn-outline w-full">
          Cancel
        </button>
        <div className="h-4" />
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
