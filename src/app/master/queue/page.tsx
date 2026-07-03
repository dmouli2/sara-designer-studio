import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import QueueBody from "./QueueBody";

export default async function MasterQueuePage() {
  const user = await requireRole(["master"]);
  // Narrowed in the database — only this master's active-stage orders come
  // over the wire, not the whole orders table.
  const orders = await getOrders({
    masterId: user.staffId,
    statuses: ["new", "cutting", "cutting_done"],
  });

  const myOrders = orders.filter((o) => o.status === "new" || o.status === "cutting");
  const doneOrders = orders.filter((o) => o.status === "cutting_done");

  return <QueueBody myOrders={myOrders} doneOrders={doneOrders} />;
}
