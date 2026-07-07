import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getFabrics } from "@/app/actions/fabrics";
import { getDraft, getDrafts } from "@/app/actions/drafts";
import { FEATURE_SCAN_ORDERS } from "@/lib/features";
import NewOrderWizard, { type ScanSource } from "./NewOrderWizard";

// /admin/orders/new?draft={id} opens the wizard prefilled from a scanned
// draft (see ScanSource in NewOrderWizard); without the param it's the
// plain manual wizard, plus the scan entry card when the feature is on.
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  await requireRole(["admin"]);
  const { draft: draftId } = await searchParams;
  const fabrics = await getFabrics();

  let scan: ScanSource | undefined;
  let pendingDraftCount = 0;
  if (FEATURE_SCAN_ORDERS) {
    if (draftId) {
      const draft = await getDraft(draftId);
      if (draft && draft.status === "draft") {
        scan = {
          draftId: draft.id,
          scanImageUrl: draft.scanImageUrl,
          extraction: draft.extraction,
          warnings: draft.warnings,
        };
      } else if (draft?.confirmedOrderId) {
        // Stale link to an already-placed draft — show the real order
        // instead of silently dropping into the manual wizard.
        redirect(`/admin/orders/${draft.confirmedOrderId}`);
      }
    }
    if (!scan) {
      pendingDraftCount = (await getDrafts()).length;
    }
  }

  return <NewOrderWizard fabrics={fabrics} scan={scan} pendingDraftCount={pendingDraftCount} />;
}
