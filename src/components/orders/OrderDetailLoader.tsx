import Skeleton from "@/components/layout/Skeleton";

export default function OrderDetailLoader() {
  return (
    <div role="status" aria-label="Loading" className="screen">
      <div className="bg-header px-4 pt-12 pb-5 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full bg-white/15" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 bg-white/15" />
          <Skeleton className="h-3 w-20 bg-white/10" />
        </div>
      </div>

      <div className="scroll-area px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="card space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>

        <div>
          <Skeleton className="h-3 w-28 mb-2" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>

        <div>
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>

        <Skeleton className="h-12 w-full rounded-xl" />

        <div className="h-4" />
      </div>
    </div>
  );
}
