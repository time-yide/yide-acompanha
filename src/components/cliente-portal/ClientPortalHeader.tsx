"use client";

import { useTransition } from "react";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientPortalSignoutAction } from "@/lib/auth/client-portal-actions";

interface Props {
  nomeContato: string | null;
  clientNome: string;
}

export function ClientPortalHeader({ nomeContato, clientNome }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSignout() {
    startTransition(() => clientPortalSignoutAction());
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
        </div>
      </div>
    </header>
  );
}
