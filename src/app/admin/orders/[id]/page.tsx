import { requireRole } from "@/lib/dal";
import { getOrder, getOrderShareToken } from "@/app/actions/orders";
import { listStaff } from "@/app/actions/staff";
import AdminOrderDetailBody from "./AdminOrderDetailBody";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;

  // The tracking token rides along so "Share status" is instant and can't
  // fail mid-tap; it is never part of Order (see findPublicToken's comment
  // in src/lib/db/types.ts).
  const [order, masters, tailors, shareToken] = await Promise.all([
    getOrder(id),
    listStaff({ role: "master", activeOnly: true }),
    listStaff({ role: "tailor", activeOnly: true }),
    getOrderShareToken(id),
  ]);

  if (!order) {
    return (
      <div className="screen items-center justify-center">
        <p className="text-[#56524A]">Order not found</p>
      </div>
    );
  }

  return (
    <AdminOrderDetailBody order={order} masters={masters} tailors={tailors} shareToken={shareToken} />
  );
}
