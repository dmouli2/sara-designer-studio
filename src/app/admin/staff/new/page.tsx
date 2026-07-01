import { requireRole } from "@/lib/dal";
import TopBar from "@/components/layout/TopBar";
import NewStaffForm from "@/components/staff/NewStaffForm";

export default async function NewStaffPage() {
  await requireRole(["admin"]);

  return (
    <div className="screen">
      <TopBar title="Add staff" backHref="/admin/staff" />
      <div className="scroll-area px-4 pt-4">
        <NewStaffForm />
      </div>
    </div>
  );
}
