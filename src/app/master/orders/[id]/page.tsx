import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import OrderDetailBody from "./OrderDetailBody";

export default async function MasterOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["master"]);
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="screen items-center justify-center">
        <p className="text-[#9A9A9A]">Order not found</p>
      </div>
    );
  }

  return <OrderDetailBody order={order} />;
}
