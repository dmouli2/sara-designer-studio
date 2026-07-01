import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import OrdersBody from "./OrdersBody";

export default async function AdminOrdersPage() {
  await requireRole(["admin"]);
  const orders = await getOrders();

  return <OrdersBody orders={orders} />;
}
