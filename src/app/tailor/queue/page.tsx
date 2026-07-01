import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import QueueBody from "./QueueBody";

export default async function TailorQueuePage() {
  const user = await requireRole(["tailor"]);
  const orders = await getOrders();

  const myOrders = orders.filter((o) => o.tailor?.id === user.staffId && o.status === "stitching");
  const readyOrders = orders.filter((o) => o.tailor?.id === user.staffId && o.status === "ready");

  return <QueueBody myOrders={myOrders} readyOrders={readyOrders} />;
}
