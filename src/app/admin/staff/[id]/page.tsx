import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getStaffMember } from "@/app/actions/staff";
import TopBar from "@/components/layout/TopBar";
import EditStaffForm from "@/components/staff/EditStaffForm";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const staff = await getStaffMember(id);

  if (!staff) {
    notFound();
  }

  return (
    <div className="screen">
      <TopBar title={staff.name} subtitle={`@${staff.username}`} backHref="/admin/staff" />
      <div className="scroll-area px-4 pt-4">
        <EditStaffForm staff={staff} />
      </div>
    </div>
  );
}
