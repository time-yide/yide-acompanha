import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listarReviews } from "@/lib/review/queries";
import { STATUS_LABEL } from "@/lib/review/schema";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default async function ReviewListPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  const reviews = await listarReviews();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Reviews de vídeo</h1><p className="text-sm text-muted-foreground">Aprovação interna e do cliente.</p></div>
        <Link href="/audiovisual/review/novo" className={buttonVariants()}><Plus className="mr-2 h-4 w-4" />Novo review</Link>
      </header>
      <div className="space-y-2">
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum review ainda.</p> :
          reviews.map((r) => (
            <Link key={r.id} href={`/audiovisual/review/${r.id}`} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40">
              <div><p className="font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.clienteNome ?? "Sem cliente"}</p></div>
              <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
            </Link>
          ))}
      </div>
    </div>
  );
}
