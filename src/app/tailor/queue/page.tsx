import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import QueueBody from "./QueueBody";

export default async function TailorQueuePage() {
  const user = await requireRole(["tailor"]);
  // Narrowed in the database — only this tailor's active-stage orders come
  // over the wire, not the whole orders table.
  const orders = await getOrders({
    tailorId: user.staffId,
    statuses: ["stitching", "ready"],
  });

  const myOrders = orders.filter((o) => o.status === "stitching");
  const readyOrders = orders.filter((o) => o.status === "ready");

  return <QueueBody myOrders={myOrders} readyOrders={readyOrders} />;
}
