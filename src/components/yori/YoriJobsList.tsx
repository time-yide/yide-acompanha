import type { YoriJob } from "@/lib/yori/tipos";
import { YoriJobCard } from "./YoriJobCard";

interface Props {
  jobs: YoriJob[];
}

export function YoriJobsList({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum vídeo gerado ainda. Clica em &quot;Novo&quot; pra começar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <YoriJobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
