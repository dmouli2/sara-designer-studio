"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import PullToRefresh from "@/components/layout/PullToRefresh";
import Toast from "@/components/layout/Toast";
import { discardDraft } from "@/app/actions/drafts";
import type { DraftOrder } from "@/lib/db/types";

function formatScanTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    ", " +
    date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function DraftsBody({ drafts: initialDrafts }: { drafts: DraftOrder[] }) {
  const router = useRouter();
  // Local list so a discarded card disappears without a server round-trip.
  const [drafts, setDrafts] = useState(initialDrafts);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDiscard(id: string) {
    if (discardingId) return;
    setDiscardingId(id);
    try {
      await discardDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setConfirmingId(null);
    } catch {
      setError("Couldn't discard the draft. Check your connection and try again.");
    } finally {
      setDiscardingId(null);
    }
  }

  return (
    <div className="screen">
      <TopBar
        title="Scanned Drafts"
        subtitle={`${drafts.length} waiting for verification`}
        onBack={() => router.push("/admin/orders")}
      />

      <PullToRefresh>
        {drafts.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-3xl mb-3">📷</p>
            <p className="text-sm text-[#56524A]">No scanned drafts waiting</p>
            <p className="text-xs text-[#56524A] mt-1">Scan an order slip to create one.</p>
          </div>
        ) : (
          drafts.map((d) => (
            // A div, not a button: the discard control nests inside the card,
            // and interactive elements may not contain other interactive
            // elements in valid HTML.
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/admin/orders/new?draft=${d.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/orders/new?draft=${d.id}`);
                }
              }}
              className="w-full text-left bg-white rounded-2xl border border-[#E5E0D5] p-4 mb-3 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[#0F0F0F]">
                  {d.extraction.customerName || "Name not read"}
                </p>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FBF6E8] text-[#7A6020]">
                  {d.dress || "Type unknown"}
                </span>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                {d.extraction.phone || "No phone"}
                {d.extraction.billNo ? ` · Bill No ${d.extraction.billNo}` : ""}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-[#56524A]">Scanned {formatScanTime(d.createdAt)}</p>
                <div className="flex items-center gap-3">
                  {d.warnings.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#B45309]">
                      <AlertTriangle size={12} />
                      {d.warnings.length} to verify
                    </span>
                  )}
                  {confirmingId === d.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDiscard(d.id);
                        }}
                        disabled={discardingId === d.id}
                        className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-[11px] font-semibold active:scale-95 transition-transform disabled:opacity-40"
                      >
                        {discardingId === d.id ? "Discarding…" : "Discard"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingId(null);
                        }}
                        disabled={discardingId === d.id}
                        className="px-3 py-1.5 rounded-xl border border-[#E5E0D5] bg-white text-[11px] font-medium text-[#6B6B6B] active:scale-95 transition-transform"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Discard draft for ${d.extraction.customerName || "unknown"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(d.id);
                      }}
                      className="p-1.5 rounded-xl text-red-600 active:scale-90 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </PullToRefresh>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-[430px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[820px] z-40 pointer-events-none">
        <div className="flex justify-end pr-5">
          <button
            type="button"
            aria-label="Scan order slip"
            onClick={() => router.push("/admin/orders/scan")}
            className="fab-glow pointer-events-auto w-14 h-14 rounded-full bg-[#C9A84C] flex items-center justify-center active:scale-90 transition-transform"
          >
            <Camera size={24} color="#0F0F0F" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
