import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { FEATURE_SCAN_ORDERS } from "@/lib/features";
import { getDrafts } from "@/app/actions/drafts";
import DraftsBody from "./DraftsBody";

export default async function DraftsPage() {
  await requireRole(["admin"]);
  if (!FEATURE_SCAN_ORDERS) redirect("/admin/orders");
  const drafts = await getDrafts();
  return <DraftsBody drafts={drafts} />;
}
