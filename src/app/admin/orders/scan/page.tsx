import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { FEATURE_SCAN_ORDERS } from "@/lib/features";
import ScanCapture from "./ScanCapture";

// Retries against Gemini free-tier 503s need more than Vercel's default function window.
export const maxDuration = 60;

export default async function ScanOrderPage() {
  await requireRole(["admin"]);
  if (!FEATURE_SCAN_ORDERS) redirect("/admin/orders");
  return <ScanCapture />;
}
