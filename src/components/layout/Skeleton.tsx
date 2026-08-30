export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#E5E0D5] ${className}`} />;
}
