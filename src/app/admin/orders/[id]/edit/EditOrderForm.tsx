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
import LineItemsEditor from "@/components/orders/LineItemsEditor";
import PiecesEditor from "@/components/orders/PiecesEditor";
import PaymentSplitPicker from "@/components/orders/PaymentSplitPicker";
import { FEATURE_MULTI_PIECE } from "@/lib/features";
import { canDressHavePieces, LINE_ITEM_PRESETS, lineItemCategoryForDress } from "@/lib/mock";
import {
  advanceSplitOf,
  formatCurrency,
  isSplitPayment,
  isValidIndianMobile,
  splitTotal,
} from "@/lib/utils";
import { galleryEntryToFile, MAX_PHOTO_PAYLOAD_BYTES } from "@/lib/image";
import { updateOrder, type OrderEditInput } from "@/app/actions/orders";
import type { GarmentMeasurements, MaterialSource, Order, OrderLineItem, PaymentSplit } from "@/types";

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
// preset rows and half-filled custom ones, strip empty notes.
function activeItemsOf(items: OrderLineItem[]): OrderLineItem[] {
  return items
    .filter((li) => li.particulars.trim() && li.qty > 0 && li.amount > 0)
    .map(({ note, ...li }) => ({
      ...li,
      particulars: li.particulars.trim(),
      ...(note?.trim() ? { note: note.trim() } : {}),
    }));
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
  // Starts as whatever the order actually has — a zero split for one taken
  // before methods were captured. Defaulting to cash here would silently
  // rewrite every legacy order's history the first time someone opened this
  // form, so an unrecorded method stays unrecorded until the admin says.
  const [advanceSplit, setAdvanceSplit] = useState<PaymentSplit>(
    () => advanceSplitOf(order) ?? { cash: 0, upi: 0 }
  );
  const [lineItems, setLineItems] = useState<OrderLineItem[]>(() => initialLineItems(order));
  // Line-item edits move the total by their delta; the admin can still type
  // a total directly (the fabric portion isn't itemized on a stored order).
  const [totalOverride, setTotalOverride] = useState<string | null>(null);
  // How many garments the order is for. Sent to updateOrder as a count; the
  // server reconciles it against the stored pieces so a garment already with
  // the customer can never be edited away.
  const [pieceCount, setPieceCount] = useState(order.pieces?.length ?? 1);
  // Per-garment cloth source. Starts uniform unless the stored pieces already
  // disagree, so opening the form never invents a mix that wasn't there.
  const storedSources = (order.pieces ?? []).map((p) => p.materialSource).filter(Boolean);
  const [uniformMaterial, setUniformMaterial] = useState(
    storedSources.length === 0 || new Set(storedSources).size <= 1
  );
  const [pieceSources, setPieceSources] = useState<MaterialSource[]>(() =>
    (order.pieces ?? []).map((p) => p.materialSource ?? "customer")
  );

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
  // finalPayment is not always zero here: a partly delivered order is still
  // editable and may already have collected part of its balance at a piece
  // hand-over. Subtracting only the advance would overstate what's owed.
  const balance = total - parseFloat(advance || "0") - order.finalPayment;

  // The existing sketch is a Storage URL we can't draw over (the canvas
  // would taint) — show it read-only until the admin removes it, at which
  // point a blank canvas appears for redrawing.
  const keepingStoredSketch = !!sketch && !sketch.startsWith("data:");

  // Same rule as the new-order wizard.
  const canSplitPieces = FEATURE_MULTI_PIECE && canDressHavePieces(order.dress);
  const deliveredPieces = (order.pieces ?? []).filter((p) => p.status === "delivered").length;
  // Delivered garments can't be removed, and the last one in the shop has to
  // leave through a hand-over (which collects the balance) — so the floor is
  // one above what's already gone.
  const minPieceCount = deliveredPieces > 0 ? deliveredPieces + 1 : 1;

  function handlePieceSourceChange(index: number, source: MaterialSource) {
    setPieceSources((prev) =>
      Array.from({ length: Math.max(prev.length, index + 1, pieceCount) }, (_, i) =>
        i === index ? source : prev[i] ?? "customer"
      )
    );
  }

  // What the pieces should end up as, given the count and the uniform choice.
  // Undefined entries leave a stored source alone — see reconcilePieces.
  const nextPieceSources: (MaterialSource | undefined)[] = uniformMaterial
    ? Array.from({ length: pieceCount }, () => undefined)
    : Array.from({ length: pieceCount }, (_, i) => pieceSources[i] ?? "customer");

  // Only meaningful when the count itself hasn't moved — a changed count
  // already sends the patch, and comparing a 1-long array against a
  // pieces-less order's empty one would report a change on every open.
  const sourcesChanged =
    (order.pieces?.length ?? 0) === pieceCount &&
    JSON.stringify(nextPieceSources) !==
      JSON.stringify((order.pieces ?? []).map((p) => p.materialSource));

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

    // How it arrived only travels when there is an advance to attribute it
    // to; a zeroed advance clears both rather than leaving a stale "Cash".
    const stored = advanceSplitOf(order);
    // A zero split means "not recorded", which is the honest state of every
    // order taken before methods were captured. Treating it as a change would
    // silently rewrite that history to "Cash" the first time this form was
    // opened and saved.
    const entered = advanceNum > 0 && splitTotal(advanceSplit) > 0 ? advanceSplit : null;
    const splitChanged = JSON.stringify(entered) !== JSON.stringify(stored);
    if (splitChanged) {
      if (!entered) {
        patch.advanceMethod = null;
        patch.advanceSplit = null;
      } else if (isSplitPayment(advanceSplit)) {
        patch.advanceSplit = advanceSplit;
      } else {
        patch.advanceMethod = advanceSplit.upi > 0 ? "upi" : "cash";
        patch.advanceSplit = null;
      }
    }

    if (canSplitPieces && (pieceCount !== (order.pieces?.length ?? 1) || sourcesChanged)) {
      patch.pieceCount = pieceCount;
      if (!uniformMaterial) patch.pieceSources = nextPieceSources as MaterialSource[];
    }

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

  const advanceNum = parseFloat(advance || "0");
  // Only blocks a split the admin actually started and left short — leaving
  // it untouched keeps a legacy order's unrecorded method unrecorded, rather
  // than forcing a guess to be able to save anything else on the order.
  const advanceUnaccounted =
    advanceNum > 0 && splitTotal(advanceSplit) > 0 && splitTotal(advanceSplit) !== advanceNum;

  const invalid =
    !name.trim() ||
    !isValidIndianMobile(phone) ||
    !due ||
    materialImages.length === 0 ||
    !Number.isFinite(total) || total < 0 ||
    !Number.isFinite(advanceNum) || advanceNum < 0 ||
    advanceUnaccounted;

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
          <LineItemsEditor
            items={lineItems}
            presetCount={LINE_ITEM_PRESETS[lineItemCategoryForDress(order.dress)].length}
            onChange={setLineItems}
          />
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
                <div className="mt-2">
                  <PaymentSplitPicker
                    idPrefix="edit-advance"
                    total={parseFloat(advance || "0")}
                    value={advanceSplit}
                    onChange={setAdvanceSplit}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-[#9A9A9A] mb-1 block">Delivery date *</label>
              <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </div>

        {canSplitPieces && (
          <div>
            <p className="section-label">Pieces</p>
            <PiecesEditor
              count={pieceCount}
              labelPrefix={order.dress}
              onChange={setPieceCount}
              uniform={uniformMaterial}
              onUniformChange={setUniformMaterial}
              sources={pieceSources}
              onSourceChange={handlePieceSourceChange}
              orderSource={order.material.includes("(shop)") ? "shop" : "customer"}
              minCount={minPieceCount}
              minCountReason={
                deliveredPieces > 0
                  ? `${deliveredPieces} already handed over — hand the rest over from the order page rather than removing them here.`
                  : undefined
              }
            />
          </div>
        )}

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
