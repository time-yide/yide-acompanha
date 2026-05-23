"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, ExternalLink, RefreshCw, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { updateClienteGmbAction, refreshClienteGmbAction } from "@/lib/clientes/gmb-actions";

interface Props {
  clientId: string;
  initialValues: {
    gmb_link: string | null;
    gmb_place_id: string | null;
    gmb_rating: number | null;
    gmb_review_count: number | null;
    gmb_last_update_at: string | null;
  };
  /** Quando true, integração automática está configurada (env var existe). */
  placesApiEnabled: boolean;
}

export function GmbForm({ clientId, initialValues, placesApiEnabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshPending, startRefresh] = useTransition();
  const [showManual, setShowManual] = useState(!placesApiEnabled);

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
      toast.success(
        r.autoFetched
          ? "Dados puxados do Google Places - nota e reviews atualizados ✨"
          : "Dados do GMB salvos (modo manual)",
      );
      router.refresh();
    });
  }

  function handleRefresh() {
    startRefresh(async () => {
      const r = await refreshClienteGmbAction(clientId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Dados atualizados do Google Places ✨");
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

  const hasPlaceId = !!initialValues.gmb_place_id;

  return (
    <Card className="space-y-5 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Google Meu Negócio</h2>
          {placesApiEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Auto via Google Places
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Manual
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {placesApiEnabled
            ? "Cole o link do Google Maps do GMB do cliente - sistema busca nota e reviews automático via Google Places API. Cron diário atualiza sozinho."
            : "Cadastre dados do GMB. Pra ativar busca automática, peça pra Yasmin configurar GOOGLE_PLACES_API_KEY no Vercel."}
        </p>
      </header>

      {/* Stats atuais - só mostra se tem dado salvo */}
      {(initialValues.gmb_rating !== null || initialValues.gmb_review_count !== null) && (
        <div className="grid grid-cols-2 gap-3">
          {initialValues.gmb_rating !== null && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nota</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">
                  {initialValues.gmb_rating.toFixed(1)}
                </span>
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              </div>
            </div>
          )}
          {initialValues.gmb_review_count !== null && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reviews</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {initialValues.gmb_review_count.toLocaleString("pt-BR")}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="client_id" value={clientId} />

        <div className="space-y-1.5">
          <Label htmlFor="gmb_link">Link do Google Maps</Label>
          <Input
            id="gmb_link"
            name="gmb_link"
            type="url"
            defaultValue={initialValues.gmb_link ?? ""}
            placeholder="https://maps.app.goo.gl/... (ou link completo do Google Maps)"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Como pegar: Google Maps → procure o cliente → Compartilhar → Copiar link.
            {placesApiEnabled && " Sistema resolve a URL automaticamente e busca os dados."}
          </p>
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

        {/* Manual fallback - sempre disponível, recolhível quando auto ligado */}
        {(showManual || !placesApiEnabled) && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gmb_rating">
                Nota média (0-5)
                {placesApiEnabled && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    (auto via Places se URL válida)
                  </span>
                )}
              </Label>
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
        )}

        {placesApiEnabled && !showManual && (
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3 w-3" />
            Editar nota/reviews manualmente (fallback)
          </button>
        )}

        {lastUpdate && (
          <p className="text-[11px] text-muted-foreground">Última atualização: {lastUpdate}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {placesApiEnabled && hasPlaceId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshPending || pending}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshPending ? "animate-spin" : ""}`} />
              {refreshPending ? "Atualizando…" : "Atualizar agora"}
            </Button>
          )}
          <Button type="submit" disabled={pending} className="ml-auto">
            {pending ? "Salvando…" : "Salvar dados"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
