export default function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-border border-t-gold animate-spin"
    />
  );
}
