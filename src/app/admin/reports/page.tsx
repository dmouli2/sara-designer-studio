import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import ReportsBody from "./ReportsBody";

export default async function AdminReportsPage() {
  await requireRole(["admin"]);
  const orders = await getOrders();

  return <ReportsBody orders={orders} />;
}
