import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import OrdersBody, { ORDERS_PAGE_SIZE } from "./OrdersBody";

export default async function AdminOrdersPage() {
  await requireRole(["admin"]);
  const orders = await getOrders({ limit: ORDERS_PAGE_SIZE });

  return <OrdersBody initialOrders={orders} />;
}
