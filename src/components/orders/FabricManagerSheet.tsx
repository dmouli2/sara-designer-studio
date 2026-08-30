"use client";

import { useState } from "react";
import { X, Plus, Pencil, Trash2, Check } from "lucide-react";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import { createFabric, updateFabric, deleteFabric } from "@/app/actions/fabrics";
import { formatCurrency } from "@/lib/utils";
import type { Fabric } from "@/lib/db/types";

interface Props {
  open: boolean;
  fabrics: Fabric[];
  onChange: (next: Fabric[]) => void;
  onClose: () => void;
}

function sortByName(list: Fabric[]): Fabric[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

// Admin-managed shop fabric price list, edited right inside the new-order
// wizard. Orders snapshot the fabric name + computed cost into plain fields,
// so edits and deletes here never change existing orders.
export default function FabricManagerSheet({ open, fabrics, onChange, onClose }: Props) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fabric | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleAdd() {
    setError(null);
    setAdding(true);
    const result = await createFabric({ name: newName, price: parseFloat(newPrice) });
    setAdding(false);
    if (result.error || !result.fabric) {
      setError(result.error ?? "Couldn't add the fabric.");
      return;
    }
    onChange(sortByName([...fabrics, result.fabric]));
    setNewName("");
    setNewPrice("");
  }

  function startEdit(fabric: Fabric) {
    setError(null);
    setEditingId(fabric.id);
    setEditName(fabric.name);
    setEditPrice(String(fabric.price));
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setError(null);
    setSavingEdit(true);
    const result = await updateFabric(editingId, { name: editName, price: parseFloat(editPrice) });
    setSavingEdit(false);
    if (result.error || !result.fabric) {
      setError(result.error ?? "Couldn't save the fabric.");
      return;
    }
    const saved = result.fabric;
    onChange(sortByName(fabrics.map((f) => (f.id === saved.id ? saved : f))));
    setEditingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    const result = await deleteFabric(deleteTarget.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      setDeleteTarget(null);
      return;
    }
    onChange(fabrics.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0F0F0F]">Manage fabrics</p>
          <button
            type="button"
            aria-label="Close fabric manager"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F0EDE6]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Add */}
        <div className="rounded-xl border border-[#E5E0D5] bg-[#F9F8F6] p-3 space-y-2">
          <p className="section-label">Add fabric</p>
          <input
            className="input"
            placeholder="Fabric name"
            aria-label="Fabric name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Price per metre (₹)"
              aria-label="Price per metre"
              type="number"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newName.trim() || !newPrice}
              className="px-4 rounded-xl bg-[#C9A84C] text-[#0F0F0F] text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
            >
              <Plus size={16} />
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}

        {/* List */}
        <div className="space-y-2">
          {fabrics.length === 0 && (
            <p className="text-[13px] text-[#56524A] text-center py-4">
              No fabrics yet — add the first one above.
            </p>
          )}
          {fabrics.map((fabric) =>
            editingId === fabric.id ? (
              <div key={fabric.id} className="rounded-xl border border-[#C9A84C] bg-[#FBF6E8] p-3 space-y-2">
                <input
                  className="input"
                  aria-label={`Edit name for ${fabric.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    aria-label={`Edit price for ${fabric.name}`}
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Save ${fabric.name}`}
                    onClick={handleSaveEdit}
                    disabled={savingEdit || !editName.trim() || !editPrice}
                    className="px-4 rounded-xl bg-[#0F0F0F] text-white text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Check size={16} />
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Cancel editing ${fabric.name}`}
                    onClick={() => setEditingId(null)}
                    className="px-3 rounded-xl border border-[#E5E0D5] bg-white text-sm text-[#6B6B6B] active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={fabric.id}
                className="flex items-center justify-between rounded-xl border border-[#E5E0D5] bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F0F0F] truncate">{fabric.name}</p>
                  <p className="text-xs text-[#56524A]">{formatCurrency(fabric.price)}/m</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Edit ${fabric.name}`}
                    onClick={() => startEdit(fabric)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-[#6B6B6B] active:bg-[#F0EDE6]"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${fabric.name}`}
                    onClick={() => setDeleteTarget(fabric)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-[#B04A4A] active:bg-[#FBECEC]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <button type="button" onClick={onClose} className="btn-gold w-full">
          Done
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.name ?? "this fabric"}?`}
        message="It will no longer appear when creating orders. Existing orders keep the price they were billed at."
        confirmLabel="Delete fabric"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
