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
  let staleDraftOrderId: string | null = null;
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
        // Link to an already-placed draft — the wizard decides what to do
        // with it. This must NOT be a server-side redirect(): placing the
        // order is itself what confirms the draft, and the placing action's
        // revalidation re-renders this page while the wizard is still open
        // on its success modal — a redirect here would eject the admin
        // mid-modal. See the staleDraftOrderId effect in NewOrderWizard.
        staleDraftOrderId = draft.confirmedOrderId;
      }
    }
    if (!scan) {
      pendingDraftCount = (await getDrafts()).length;
    }
  }

  return (
    <NewOrderWizard
      fabrics={fabrics}
      scan={scan}
      staleDraftOrderId={staleDraftOrderId}
      pendingDraftCount={pendingDraftCount}
    />
  );
}
