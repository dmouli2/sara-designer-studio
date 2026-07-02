import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { listStaff } from "@/app/actions/staff";
import TopBar from "@/components/layout/TopBar";

const ROLE_LABEL = { admin: "Admin", master: "Master", tailor: "Tailor" } as const;

export default async function StaffListPage() {
  await requireRole(["admin"]);
  const staff = await listStaff();

  return (
    <div className="screen">
      <TopBar
        title="Staff"
        subtitle={`${staff.length} accounts`}
        backHref="/admin/orders"
        right={
          <Link
            href="/admin/staff/new"
            className="w-9 h-9 bg-[#C9A84C] rounded-xl flex items-center justify-center active:opacity-80"
          >
            <Plus size={18} color="#0F0F0F" strokeWidth={2.5} />
          </Link>
        }
      />

      <div className="scroll-area px-4 pt-4 space-y-2">
        {staff.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-3xl mb-3">🧑‍🤝‍🧑</p>
            <p className="text-sm text-[#9A9A9A]">No staff accounts yet</p>
          </div>
        ) : (
          staff.map((s) => (
            <Link
              key={s.id}
              href={`/admin/staff/${s.id}`}
              className="flex items-center justify-between bg-white rounded-xl border border-[#E5E0D5] p-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#0F0F0F]">{s.name}</p>
                <p className="text-xs text-[#9A9A9A] mt-0.5">
                  @{s.username} · {ROLE_LABEL[s.role]}
                </p>
              </div>
              {s.active ? (
                <span className="text-[10px] font-semibold text-[#1B6B3A] bg-[#D5F0E1] rounded-full px-2 py-1">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-[#B04A4A] bg-[#F7E6E6] rounded-full px-2 py-1">
                  Deactivated
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
