import { requireAuth } from "@/lib/auth/session";
import { listDates } from "@/lib/client-folder/dates-actions";
import { AddDateForm } from "@/components/client-folder/AddDateForm";
import { DatesList } from "@/components/client-folder/DatesList";

export default async function DatasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const dates = await listDates(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Datas importantes</h2>
        <p className="text-xs text-muted-foreground">Aniversários, renovações de contrato, kickoffs e outras datas-chave.</p>
      </header>
      <AddDateForm clientId={id} />
      <DatesList dates={dates} />
    </div>
  );
}
