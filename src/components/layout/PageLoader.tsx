import Skeleton from "./Skeleton";

export default function PageLoader() {
  return (
    <div role="status" aria-label="Loading" className="screen">
      <div className="bg-header px-4 pt-12 pb-5 space-y-2">
        <Skeleton className="h-4 w-40 bg-white/15" />
        <Skeleton className="h-3 w-24 bg-white/10" />
      </div>

      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
