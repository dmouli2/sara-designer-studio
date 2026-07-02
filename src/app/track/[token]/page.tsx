import { notFound } from "next/navigation";
import { getPublicOrder } from "@/app/actions/publicOrders";
import PublicOrderBody from "./PublicOrderBody";

export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getPublicOrder(token);

  if (!order) {
    notFound();
  }

  return <PublicOrderBody order={order} />;
}
