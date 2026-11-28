"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Lock, ScanLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface Props {
  blocked: boolean;
  total: number;
}

/**
 * Trava da conferência semanal da Vistoria. Montada no layout logado, igual aos
 * outros cadeados. Na própria /vistoria fica liberada, senão a pessoa não
 * consegue fazer a conferência.
 */
export function VistoriaLockGate({ blocked, total }: Props) {
  const pathname = usePathname();
  const naVistoria = pathname?.startsWith("/vistoria") ?? false;
  if (!blocked || naVistoria) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md sm:p-8">
      <div className="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl ring-1 ring-primary/20 sm:p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Conferência da semana pendente</h2>
            <p className="text-sm text-muted-foreground">
              {total === 1 ? "Você tem 1 equipamento" : `Você tem ${total} equipamentos`} com você. Escaneie o QR de cada um
              e conclua a conferência pra liberar o sistema.
            </p>
          </div>
        </div>
        <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          Se algum equipamento não estiver com você, marque como faltando ao concluir. O gestor vai ver.
        </p>
        <div className="flex justify-center">
          <Link href="/vistoria" className={buttonVariants({ variant: "default" })}>
            <ScanLine className="mr-1.5 h-4 w-4" />
            Fazer a conferência
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
