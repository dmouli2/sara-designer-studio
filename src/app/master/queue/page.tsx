import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import QueueBody from "./QueueBody";

export default async function MasterQueuePage() {
  const user = await requireRole(["master"]);
  const orders = await getOrders();

  const myOrders = orders.filter(
    (o) => o.master?.id === user.staffId && (o.status === "new" || o.status === "cutting")
  );
  const doneOrders = orders.filter((o) => o.master?.id === user.staffId && o.status === "cutting_done");

  return <QueueBody myOrders={myOrders} doneOrders={doneOrders} />;
}
