import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { podeVerReview } from "@/lib/review/permissions";
import { listarReviews } from "@/lib/review/queries";
import { reviewHref } from "@/lib/review/nav";
import { STATUS_LABEL } from "@/lib/review/schema";
import { Badge } from "@/components/ui/badge";

export default async function ReviewListPage() {
  const user = await requireAuth();
  if (!podeVerReview(user)) redirect("/audiovisual");
  const reviews = await listarReviews();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reviews de vídeo</h1>
        <p className="text-sm text-muted-foreground">Atalho pros vídeos em revisão — clique pra abrir na tarefa.</p>
      </header>
      <div className="space-y-2">
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum review ainda.</p> :
          reviews.map((r) => (
            <Link key={r.id} href={reviewHref(r.taskId, r.id)} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40">
              <div><p className="font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.clienteNome ?? "Sem cliente"}</p></div>
              <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
            </Link>
          ))}
      </div>
    </div>
  );
}
