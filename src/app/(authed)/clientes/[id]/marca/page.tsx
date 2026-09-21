import { requireAuth } from "@/lib/auth/session";
import { getStyleGuide } from "@/lib/clientes/marca-actions";
import { MarcaForm } from "@/components/clientes/MarcaForm";
import { Card } from "@/components/ui/card";

export default async function MarcaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const initial = await getStyleGuide(id);

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Identidade visual</h2>
        <p className="text-xs text-muted-foreground">
          Cores, fontes e estilo do cliente. A IA usa esses dados pra gerar artes mais fiéis à marca.
        </p>
      </div>
      <MarcaForm clientId={id} initial={initial} />
    </Card>
  );
}
