"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import MeasurementForm, { emptyMeasurementsForDress } from "@/components/orders/MeasurementForm";
import SketchCanvas from "@/components/orders/SketchCanvas";
import ReferenceImageUpload from "@/components/orders/ReferenceImageUpload";
import { DRESS_TYPES, FABRICS, LINE_ITEM_PRESETS, lineItemCategoryForDress } from "@/lib/mock";
import { formatCurrency, isValidIndianMobile, buildOrderWhatsAppMessage, buildWhatsAppShareUrl } from "@/lib/utils";
import { createOrder } from "@/app/actions/orders";
import type { GarmentMeasurements, OrderLineItem } from "@/types";

function defaultLineItems(dress: string): OrderLineItem[] {
  const cat = lineItemCategoryForDress(dress);
  const [first, ...rest] = LINE_ITEM_PRESETS[cat];
  return [
    { particulars: first, qty: 1, amount: 0 },
    ...rest.map((p) => ({ particulars: p, qty: 0, amount: 0 })),
  ];
}

export default function NewOrderWizard() {
  const router = useRouter();

  const [step, setStep]             = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; publicToken: string } | null>(null);

  // Order type — gates the rest of the wizard; customer details etc. can't
  // be entered until one of Blouse/Salwar is chosen (also picks which
  // per-category id series — S2131.. or B2401.. — the order will get).
  const [dress, setDress]           = useState<string | null>(null);

  // Step 1 — customer + material
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [matSource, setMatSource]   = useState<"shop" | "customer">("shop");
  const [fabric, setFabric]         = useState(FABRICS[0]);
  const [metres, setMetres]         = useState("2");
  const [custFabric, setCustFabric] = useState("");

  // Step 2 — measurements + notes + sketch + images
  const [meas, setMeas]             = useState<GarmentMeasurements>(() => emptyMeasurementsForDress(DRESS_TYPES[0]));
  const [notes, setNotes]           = useState("");
  const [sketch, setSketch]         = useState<string | null>(null);
  const [refImages, setRefImages]   = useState<string[]>([]);

  // Step 3 — pricing
  const [lineItems, setLineItems]   = useState<OrderLineItem[]>(() => defaultLineItems(DRESS_TYPES[0]));
  const [delivery, setDelivery]     = useState("");
  const [advance, setAdvance]       = useState("");

  const fabricCost = matSource === "shop" ? fabric.price * parseFloat(metres || "0") : 0;
  const stitchTotal = lineItems.reduce((s, li) => s + (li.qty > 0 ? li.amount : 0), 0);
  const total   = fabricCost + stitchTotal;
  const balance = total - parseFloat(advance || "0");

  function handleDressChange(d: string) {
    setDress(d);
    setMeas(emptyMeasurementsForDress(d));
    setLineItems(defaultLineItems(d));
  }

  function setLineItem(i: number, patch: Partial<OrderLineItem>) {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, ...patch } : li));
  }

  async function handleSubmit() {
    if (submitting || !dress) return;
    setSubmitting(true);
    const activeItems = lineItems.filter((li) => li.qty > 0 && li.amount > 0);
    const created = await createOrder({
      customer: name,
      phone,
      dress,
      material: matSource === "shop"
        ? `${fabric.name} (shop)`
        : `${custFabric || "Customer fabric"} (customer)`,
      status: "new",
      amount: total,
      advance: parseFloat(advance || "0"),
      due: delivery,
      masterId: null,
      tailorId: null,
      measurements: meas,
      lineItems: activeItems,
      notes,
      sketchDataUrl: sketch,
      referenceImageUrls: refImages,
    });
    setPlacedOrder({ id: created.id, publicToken: created.publicToken });
  }

  function handleShareOnWhatsApp() {
    if (!placedOrder || !dress) return;
    const trackingUrl = `${window.location.origin}/track/${placedOrder.publicToken}`;
    const message = buildOrderWhatsAppMessage({
      orderId: placedOrder.id,
      customer: name,
      dress,
      total,
      advance: parseFloat(advance || "0"),
      due: delivery,
      trackingUrl,
    });
    window.open(buildWhatsAppShareUrl(phone, message), "_blank");
  }

  // Order type gates everything else — customer details, measurements and
  // pricing only appear once Blouse or Salwar is chosen, since that choice
  // also picks the order's id series (S2131.. / B2401..).
  if (!dress) {
    return (
      <div className="screen">
        <TopBar title="New Order" subtitle="Choose order type" onBack={() => router.back()} />
        <div className="scroll-area px-4 pt-6 space-y-4">
          <p className="section-label">What are we stitching?</p>
          {DRESS_TYPES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDressChange(d)}
              className={`w-full text-left p-5 rounded-2xl border transition-all active:scale-[0.98] ${
                d === "Salwar" ? "border-[#E5E0D5] bg-white" : "border-[#EDD98A] bg-[#FBF6E8]"
              }`}
            >
              <p className={`text-lg font-semibold ${d === "Salwar" ? "text-[#0F0F0F]" : "text-[#7A6020]"}`}>{d}</p>
              <p className={`text-xs mt-1 ${d === "Salwar" ? "text-[#6B6B6B]" : "text-[#A8882E]"}`}>
                {d === "Salwar" ? "Salwar Kameez & Churidar" : "Blouse & Pattu Saree Blouse"}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const STEPS = ["Details", "Measurements", "Pricing"];

  return (
    <div className="screen">
      <TopBar
        title={`New Order · Step ${step}/${STEPS.length}`}
        subtitle={STEPS[step - 1]}
        onBack={() => (step > 1 ? setStep(step - 1) : setDress(null))}
      />

      {/* Step indicator */}
      <div className="flex gap-1.5 px-4 pt-3">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= step ? "bg-[#C9A84C]" : "bg-[#E5E0D5]"}`}
          />
        ))}
      </div>

      <div className="scroll-area px-4 pt-5 space-y-5">

        {/* ── STEP 1: Details ─────────────────────────────── */}
        {step === 1 && (
          <>
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
              <p className="section-label">Order type</p>
              <div className="flex items-center justify-between rounded-xl border border-[#E5E0D5] bg-white px-4 py-3.5">
                <span className="text-[15px] font-semibold text-[#0F0F0F]">{dress}</span>
                <button type="button" onClick={() => setDress(null)} className="text-xs font-medium text-[#C9A84C]">
                  Change
                </button>
              </div>
            </div>

            <div>
              <p className="section-label">Material source</p>
              <div className="flex rounded-xl border border-[#E5E0D5] overflow-hidden bg-white">
                {(["shop", "customer"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setMatSource(s)}
                    className={`flex-1 py-3 text-sm font-medium transition-all ${matSource === s ? "bg-[#0F0F0F] text-white" : "text-[#6B6B6B]"}`}>
                    {s === "shop" ? "From shop" : "Customer brings"}
                  </button>
                ))}
              </div>
            </div>

            {matSource === "shop" ? (
              <div>
                <p className="section-label">Select fabric</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {FABRICS.map((f) => (
                    <button key={f.name} type="button" onClick={() => setFabric(f)}
                      className={`p-3 rounded-xl border text-left transition-all ${fabric.name === f.name ? "border-[#C9A84C] bg-[#FBF6E8]" : "border-[#E5E0D5] bg-white"}`}>
                      <p className={`text-sm font-semibold ${fabric.name === f.name ? "text-[#7A6020]" : "text-[#0F0F0F]"}`}>{f.name}</p>
                      <p className={`text-xs mt-0.5 ${fabric.name === f.name ? "text-[#C9A84C]" : "text-[#9A9A9A]"}`}>₹{f.price}/m</p>
                    </button>
                  ))}
                </div>
                <input className="input" placeholder="Metres required" type="number" value={metres} onChange={(e) => setMetres(e.target.value)} />
                <p className="text-xs text-[#9A9A9A] mt-1.5">
                  Fabric cost: <span className="text-[#C9A84C] font-medium">{formatCurrency(fabricCost)}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="section-label">Customer fabric details</p>
                <input className="input" placeholder="e.g. Blue silk, floral print" value={custFabric} onChange={(e) => setCustFabric(e.target.value)} />
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!name.trim() || !isValidIndianMobile(phone)} className="btn-primary disabled:opacity-40">
              Next: Measurements →
            </button>
            <div className="h-4" />
          </>
        )}

        {/* ── STEP 2: Measurements + Notes + Sketch + Photos ── */}
        {step === 2 && (
          <>
            <div>
              <p className="section-label">Measurements (in) — {dress}</p>
              <MeasurementForm dress={dress} value={meas} onChange={setMeas} />
            </div>

            <div>
              <p className="section-label">Style notes</p>
              <textarea className="input resize-none" rows={3}
                placeholder="Embroidery, piping, closures, special requests…"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div>
              <p className="section-label">Garment sketch</p>
              <SketchCanvas value={sketch} onChange={setSketch} />
            </div>

            <div>
              <p className="section-label">Reference photos</p>
              <ReferenceImageUpload value={refImages} onChange={setRefImages} />
            </div>

            <button onClick={() => setStep(3)} className="btn-primary">
              Next: Pricing →
            </button>
            <div className="h-4" />
          </>
        )}

        {/* ── STEP 3: Line items + pricing ─────────────────── */}
        {step === 3 && (
          <>
            <div>
              <p className="section-label">Order items</p>
              <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
                {/* Header */}
                <div className="grid grid-cols-[1fr_52px_80px] bg-[#F9F8F6] border-b border-[#E5E0D5] px-3 py-2">
                  <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Item</span>
                  <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">Qty</span>
                  <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">Amount ₹</span>
                </div>
                {lineItems.map((li, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_52px_80px] items-center px-3 py-2 gap-2 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"} ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}>
                    <span className="text-xs text-[#0F0F0F]">{li.particulars}</span>
                    <input
                      className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                      type="number" min="0" value={li.qty || ""}
                      placeholder="0"
                      onChange={(e) => setLineItem(i, { qty: parseInt(e.target.value) || 0 })}
                    />
                    <input
                      className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                      type="number" min="0" value={li.amount || ""}
                      placeholder="0"
                      onChange={(e) => setLineItem(i, { amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Payment</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#9A9A9A] mb-1 block">Advance collected (₹)</label>
                  <input className="input" type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#9A9A9A] mb-1 block">Delivery date *</label>
                  <input className="input" type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="card-gold">
              <p className="text-xs font-semibold text-[#7A6020] mb-3">Order summary</p>
              {matSource === "shop" && (
                <div className="flex justify-between text-xs text-[#A8882E] mb-1.5">
                  <span>Fabric ({fabric.name} × {metres}m)</span>
                  <span>{formatCurrency(fabricCost)}</span>
                </div>
              )}
              {lineItems.filter((li) => li.qty > 0 && li.amount > 0).map((li, i) => (
                <div key={i} className="flex justify-between text-xs text-[#A8882E] mb-1.5">
                  <span>{li.particulars} ×{li.qty}</span>
                  <span>{formatCurrency(li.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-[#0F0F0F] border-t border-[#EDD98A] pt-2 mt-1">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B6B6B] mt-1">
                <span>Advance</span>
                <span>{formatCurrency(parseFloat(advance || "0"))}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-[#C9A84C] mt-0.5">
                <span>Balance due</span>
                <span>{formatCurrency(balance > 0 ? balance : 0)}</span>
              </div>
            </div>

            {!delivery && (
              <p className="text-xs text-red-600 -mt-2">Delivery date is required.</p>
            )}

            <button onClick={handleSubmit} disabled={submitting || !delivery} className="btn-gold disabled:opacity-40">
              {submitting ? "Placing order…" : "✓ Confirm & Place Order"}
            </button>
            <div className="h-4" />
          </>
        )}
      </div>

      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 text-center shadow-xl">
            <CheckCircle2 size={48} className="mx-auto text-[#1B6B3A]" />
            <p className="text-base font-semibold text-[#0F0F0F] mt-3">Order placed successfully!</p>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Order <span className="font-semibold text-[#0F0F0F]">{placedOrder.id}</span> for {name} has been created.
            </p>

            <button
              onClick={handleShareOnWhatsApp}
              className="w-full mt-5 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-[#25D366] active:opacity-80"
            >
              <MessageCircle size={18} />
              Share on WhatsApp
            </button>

            <button
              onClick={() => router.push("/admin/orders")}
              className="btn-outline w-full mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
