import { requireRole } from "@/lib/dal";
import { getFabrics } from "@/app/actions/fabrics";
import NewOrderWizard from "./NewOrderWizard";

export default async function NewOrderPage() {
  await requireRole(["admin"]);
  const fabrics = await getFabrics();
  return <NewOrderWizard fabrics={fabrics} />;
}
