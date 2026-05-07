import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 md:flex-row">
      <aside className="hidden w-56 shrink-0 space-y-2 rounded-lg border bg-card p-3 md:block">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </aside>
      <section className="flex flex-1 flex-col gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex-1 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={i % 2 === 0 ? "flex gap-2" : "flex flex-row-reverse gap-2"}>
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className={`h-14 ${i % 3 === 0 ? "w-2/3" : "w-1/2"}`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
      </section>
    </div>
  );
}
