import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import { listStaff } from "@/app/actions/staff";
import AdminOrderDetailBody from "./AdminOrderDetailBody";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;

  const [order, masters, tailors] = await Promise.all([
    getOrder(id),
    listStaff({ role: "master", activeOnly: true }),
    listStaff({ role: "tailor", activeOnly: true }),
  ]);

  if (!order) {
    return (
      <div className="screen items-center justify-center">
        <p className="text-[#9A9A9A]">Order not found</p>
      </div>
    );
  }

  return <AdminOrderDetailBody order={order} masters={masters} tailors={tailors} />;
}
