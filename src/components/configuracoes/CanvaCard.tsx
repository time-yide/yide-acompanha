"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { FolderPlus, Link2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCanvaFoldersAction } from "@/lib/canva/actions";

interface Props {
  connected: boolean;
  clientsSemPasta: number;
}

export function CanvaCard({ connected, clientsSemPasta }: Props) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const canva = searchParams.get("canva");
    if (canva === "success") toast.success("Canva conectado com sucesso!");
    if (canva === "error") {
      const msg = searchParams.get("msg") ?? "Erro desconhecido";
      toast.error(`Erro ao conectar Canva: ${msg}`);
    }
  }, [searchParams]);

  function handleCreateFolders() {
    startTransition(async () => {
      const r = await createCanvaFoldersAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const msg = r.message ?? `${r.created} pastas criadas`;
      setResult(msg);
      toast.success(msg);
    });
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Canva</h2>
        <p className="text-sm text-muted-foreground">
          Integração com o Canva para criação automática de artes.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Conectado
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Não conectado
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {!connected && (
          <a href="/api/canva/authorize">
            <Button size="sm" variant="outline">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Conectar ao Canva
            </Button>
          </a>
        )}

        {connected && (
          <Button
            type="button"
            onClick={handleCreateFolders}
            disabled={pending || clientsSemPasta === 0}
            size="sm"
            variant="outline"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Criando pastas...
              </>
            ) : (
              <>
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                Criar pastas no Canva ({clientsSemPasta} clientes)
              </>
            )}
          </Button>
        )}
      </div>

      {result && (
        <p className="text-xs text-muted-foreground">{result}</p>
      )}
    </Card>
  );
}
