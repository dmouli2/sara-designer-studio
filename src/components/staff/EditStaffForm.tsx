"use client";

import { useActionState } from "react";
import { updateStaff, type StaffFormState, type StaffListItem } from "@/app/actions/staff";
import type { Role } from "@/types";

const initialState: StaffFormState = {};

const ROLES: { value: Role; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "tailor", label: "Tailor" },
  { value: "admin", label: "Admin" },
];

export default function EditStaffForm({ staff }: { staff: StaffListItem }) {
  const [state, formAction, pending] = useActionState(updateStaff, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={staff.id} />

      <div>
        <label className="text-xs text-[#9A9A9A] mb-1 block">Username</label>
        <p className="text-sm text-[#0F0F0F] py-2">{staff.username}</p>
      </div>

      <div>
        <label htmlFor="name" className="text-xs text-[#9A9A9A] mb-1 block">
          Full name
        </label>
        <input id="name" name="name" className="input" defaultValue={staff.name} />
      </div>

      <div>
        <label htmlFor="role" className="text-xs text-[#9A9A9A] mb-1 block">
          Role
        </label>
        <select id="role" name="role" className="input" defaultValue={staff.role}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="active" className="text-xs text-[#9A9A9A] mb-1 block">
          Status
        </label>
        <select id="active" name="active" className="input" defaultValue={staff.active ? "true" : "false"}>
          <option value="true">Active</option>
          <option value="false">Deactivated</option>
        </select>
      </div>

      <div>
        <label htmlFor="password" className="text-xs text-[#9A9A9A] mb-1 block">
          New password (leave blank to keep current)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
        />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-[#1B6B3A]">✓ Saved</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-40">
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
