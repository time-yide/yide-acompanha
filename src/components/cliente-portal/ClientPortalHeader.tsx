"use client";

import { useTransition } from "react";
import Image from "next/image";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientPortalSignoutAction } from "@/lib/auth/client-portal-actions";

interface Props {
  nomeContato: string | null;
  clientNome: string;
  /**
   * Quando true: substitui "Sair" por "Fechar preview" — chama signout
   * iria tentar deslogar o colab interno do auth do cliente (que nem
   * existe pra essa sessão) e quebraria a sessão real dele.
   */
  previewMode?: boolean;
}

export function ClientPortalHeader({ nomeContato, clientNome, previewMode = false }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSignout() {
    startTransition(() => clientPortalSignoutAction());
  }

  function handleClosePreview() {
    if (typeof window === "undefined") return;
    window.close();
    // Se window.close() não funciona (aba não foi aberta via window.open),
    // navega de volta pro painel admin como fallback.
    setTimeout(() => {
      window.location.href = "/painel-cliente";
    }, 100);
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-yide.png"
            alt="Yide Digital"
            width={811}
            height={450}
            sizes="80px"
            priority
            className="h-auto w-16"
          />
          <div className="hidden text-xs text-muted-foreground sm:block">
            Portal do cliente · {clientNome}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {nomeContato && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {nomeContato}
            </span>
          )}
          {previewMode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClosePreview}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Fechar preview
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignout}
              disabled={pending}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              {pending ? "Saindo..." : "Sair"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
