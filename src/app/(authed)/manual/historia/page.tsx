import { requireAuth } from "@/lib/auth/session";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";
import { HistoriaStory } from "@/components/manual/HistoriaStory";

export default async function HistoriaPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <ManualBreadcrumb current="História da Yide" />
      <HistoriaStory />
    </div>
  );
}
