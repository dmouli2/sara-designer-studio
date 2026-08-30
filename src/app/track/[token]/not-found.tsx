import { SearchX } from "lucide-react";

export default function TrackOrderNotFound() {
  return (
    <div className="screen items-center justify-center text-center px-6">
      <SearchX size={30} className="mb-2 text-fg-faint" aria-hidden="true" />
      <p className="text-[16px] font-semibold text-fg">Order not found</p>
      <p className="text-[13px] text-fg-2 mt-1">
        This tracking link is invalid or the order no longer exists.
      </p>
    </div>
  );
}
