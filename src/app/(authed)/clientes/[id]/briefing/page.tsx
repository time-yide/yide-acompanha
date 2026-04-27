import { requireAuth } from "@/lib/auth/session";
import { getBriefing } from "@/lib/client-folder/briefing-actions";
import { BriefingEditor } from "@/components/client-folder/BriefingEditor";
import { Card } from "@/components/ui/card";

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const initial = await getBriefing(id);

  return (
    <Card className="p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Briefing</h2>
        <p className="text-xs text-muted-foreground">Use formato Markdown. Aceita títulos com #, listas com -, etc.</p>
      </div>
      <BriefingEditor clientId={id} initial={initial} />
    </Card>
  );
}
