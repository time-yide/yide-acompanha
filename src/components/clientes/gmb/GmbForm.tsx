"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { updateClienteGmbAction } from "@/lib/clientes/gmb-actions";

interface Props {
  clientId: string;
  initialValues: {
    gmb_link: string | null;
    gmb_rating: number | null;
    gmb_review_count: number | null;
    gmb_last_update_at: string | null;
  };
}

export function GmbForm({ clientId, initialValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    startTransition(async () => {
      const fd = new FormData(formEl);
      const r = await updateClienteGmbAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Dados do GMB atualizados");
      router.refresh();
    });
  }

  const lastUpdate = initialValues.gmb_last_update_at
    ? new Date(initialValues.gmb_last_update_at).toLocaleString("pt-BR", {
        timeZone: "America/Cuiaba",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="p-6">
      <header className="mb-5 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Google Meu Negócio</h2>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            Manual
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Cadastre os dados do perfil GMB do cliente. Aparece no portal. Quando
          tivermos integração com a API do Google, esses dados vão atualizar sozinhos.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="client_id" value={clientId} />

        <div className="space-y-1.5">
          <Label htmlFor="gmb_link">Link do perfil (Google Maps)</Label>
          <Input
            id="gmb_link"
            name="gmb_link"
            type="url"
            defaultValue={initialValues.gmb_link ?? ""}
            placeholder="https://maps.google.com/?cid=..."
            disabled={pending}
          />
          {initialValues.gmb_link && (
            <a
              href={initialValues.gmb_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir perfil
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gmb_rating">Nota média (0-5)</Label>
            <div className="relative">
              <Star className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
              <Input
                id="gmb_rating"
                name="gmb_rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                defaultValue={initialValues.gmb_rating ?? ""}
                placeholder="4.7"
                disabled={pending}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gmb_review_count">Nº de avaliações</Label>
            <Input
              id="gmb_review_count"
              name="gmb_review_count"
              type="number"
              min={0}
              defaultValue={initialValues.gmb_review_count ?? ""}
              placeholder="320"
              disabled={pending}
            />
          </div>
        </div>

        {lastUpdate && (
          <p className="text-[11px] text-muted-foreground">
            Última atualização: {lastUpdate}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar dados do GMB"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
