"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Copy, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealCredentialAction, deleteCredentialAction } from "@/lib/credenciais/actions";
import type { CredentialRow } from "@/lib/credenciais/queries";

interface Props {
  credential: CredentialRow;
  onEdit: (credential: CredentialRow) => void;
}

export function CredentialItem({ credential, onEdit }: Props) {
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReveal() {
    setErro(null);
    startTransition(async () => {
      const result = await revealCredentialAction(credential.id);
      if ("error" in result) {
        setErro(result.error);
        return;
      }
      setRevealedPassword(result.data.password);
      // Auto-esconde após 30s
      setTimeout(() => setRevealedPassword(null), 30_000);
    });
  }

  function handleHide() {
    setRevealedPassword(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErro("Não foi possível copiar — copia manualmente");
    }
  }

  function handleDelete() {
    if (!confirm(`Excluir credencial "${credential.service_name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const result = await deleteCredentialAction(credential.id);
      if ("error" in result) {
        setErro(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-semibold">{credential.service_name}</h3>
            {credential.username && (
              <span className="text-xs text-muted-foreground">{credential.username}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-sm font-mono tabular-nums">
              {revealedPassword ?? "••••••••••••"}
            </code>

            {revealedPassword === null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReveal}
                disabled={pending}
                title="Revelar senha (registrado em log de acesso)"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                {pending ? "..." : "Revelar"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={pending}
                >
                  {copied ? (
                    <><Check className="mr-1.5 h-3.5 w-3.5" /> Copiado</>
                  ) : (
                    <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar</>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleHide}
                >
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Esconder
                </Button>
              </>
            )}
          </div>

          {credential.notes && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {credential.notes}
            </p>
          )}

          {erro && (
            <p className="text-xs text-destructive">{erro}</p>
          )}

          <p className="text-[10px] text-muted-foreground">
            {credential.updated_by_nome
              ? `Atualizado por ${credential.updated_by_nome}`
              : "Atualizado"}
            {" · "}
            {new Date(credential.updated_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(credential)}
            disabled={pending}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={pending}
            title="Excluir"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
