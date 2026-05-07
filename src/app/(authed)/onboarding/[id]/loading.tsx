import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-32" />
      </header>
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
        </div>
      </Card>
      <Card className="p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
