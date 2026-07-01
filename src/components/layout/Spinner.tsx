export default function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-[#E5E0D5] border-t-[#C9A84C] animate-spin"
    />
  );
}
