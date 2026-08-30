import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import EditOrderForm from "./EditOrderForm";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="screen items-center justify-center">
        <p className="text-[#56524A]">Order not found</p>
      </div>
    );
  }

  // Delivered/cancelled orders are final records — bounce back to the
  // read-only detail page (the server action enforces the same rule).
  if (order.status === "delivered" || order.status === "cancelled") {
    redirect(`/admin/orders/${id}`);
  }

  return <EditOrderForm order={order} />;
}
