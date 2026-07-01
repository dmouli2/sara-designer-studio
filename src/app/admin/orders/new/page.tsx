import { requireRole } from "@/lib/dal";
import NewOrderWizard from "./NewOrderWizard";

export default async function NewOrderPage() {
  await requireRole(["admin"]);
  return <NewOrderWizard />;
}
