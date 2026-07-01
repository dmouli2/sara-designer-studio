"use client";

import { useActionState } from "react";
import { createStaff, type StaffFormState } from "@/app/actions/staff";
import type { Role } from "@/types";

const initialState: StaffFormState = {};

const ROLES: { value: Role; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "tailor", label: "Tailor" },
  { value: "admin", label: "Admin" },
];

export default function NewStaffForm() {
  const [state, formAction, pending] = useActionState(createStaff, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="name" className="text-xs text-[#9A9A9A] mb-1 block">
          Full name
        </label>
        <input id="name" name="name" className="input" />
      </div>

      <div>
        <label htmlFor="username" className="text-xs text-[#9A9A9A] mb-1 block">
          Username
        </label>
        <input id="username" name="username" className="input" autoComplete="username" />
      </div>

      <div>
        <label htmlFor="password" className="text-xs text-[#9A9A9A] mb-1 block">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label htmlFor="role" className="text-xs text-[#9A9A9A] mb-1 block">
          Role
        </label>
        <select id="role" name="role" className="input" defaultValue="tailor">
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-40">
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
