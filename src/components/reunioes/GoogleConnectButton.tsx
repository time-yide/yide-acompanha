"use client";

import { useState, useTransition } from "react";
import { LogIn, Loader2 } from "lucide-react";
import {
  iniciarGoogleOAuthAction,
  revogarGoogleOAuthAction,
} from "@/lib/reunioes/actions";

export function GoogleConnectButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const r = await iniciarGoogleOAuthAction();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // Navegação full-page pro Google
      window.location.href = r.url;
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        {pending ? "Abrindo Google…" : "Conectar com Google"}
      </button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function GoogleDisconnectButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await revogarGoogleOAuthAction();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // Reload pra refletir estado novo
      window.location.href = "/reunioes/conectar?status=disconnected";
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      >
        Desconectar
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {pending ? "Revogando…" : "Confirmar desconexão"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
      />
    </svg>
  );
}

void LogIn; // pra evitar tree-shake quando export futuro precisar
