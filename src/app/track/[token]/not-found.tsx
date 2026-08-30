export default function TrackOrderNotFound() {
  return (
    <div className="screen items-center justify-center text-center px-6">
      <p className="text-3xl mb-2">🔍</p>
      <p className="text-[16px] font-semibold text-[#0F0F0F]">Order not found</p>
      <p className="text-[13px] text-[#56524A] mt-1">
        This tracking link is invalid or the order no longer exists.
      </p>
    </div>
  );
}
