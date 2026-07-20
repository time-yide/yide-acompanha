"use client";
import Link from "next/link";
import { CheckCircle2, XCircle, ExternalLink, BarChart3, Hand } from "lucide-react";
import type { ContaCanal } from "@/lib/presenca/contas";

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

/** Card "Conta & Análise" no topo da aba do canal. */
export function ContaAnaliseCard({
  conta,
  label,
  semCliente,
}: {
  conta: ContaCanal | null;
  label: string;
  semCliente: boolean;
}) {
  // Sem cliente Yide cadastrado — aviso amigável, sem quebrar a página.
  if (semCliente || !conta) {
    return (
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-1 text-sm font-semibold">Conta &amp; Análise</h2>
        <p className="text-sm text-muted-foreground">
          Conecte as contas da Yide na Estratégia pra ver aqui a conta conectada e as métricas.{" "}
          <Link href="/social-media" className="font-medium text-primary hover:underline">
            Ir pra Estratégia
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Conta &amp; Análise</h2>
        {conta.manual ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Hand className="h-3.5 w-3.5" /> Conexão manual
          </span>
        ) : conta.conectado ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> Não conectado
          </span>
        )}
      </div>

      {/* Conta conectada */}
      {conta.manual ? (
        <p className="text-sm text-muted-foreground">
          {label} não é conectável por aqui — gerencie o perfil direto na plataforma.
        </p>
      ) : conta.conectado ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{conta.conta}</span>
          {conta.link && (
            <Link
              href={conta.link}
              target={conta.link.startsWith("http") ? "_blank" : undefined}
              rel={conta.link.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {conta.link.startsWith("http") ? "Ver perfil" : "Gerenciar"}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta da Yide conectada neste canal.{" "}
          {conta.link && (
            <Link href={conta.link} className="font-medium text-primary hover:underline">
              Conectar na Estratégia
            </Link>
          )}
        </p>
      )}

      {/* Métricas */}
      <div className="border-t pt-3">
        {conta.metricas ? (
          <div className="grid grid-cols-3 gap-2">
            <Metrica label="Posts publicados" valor={formatarNumero(conta.metricas.posts)} />
            <Metrica label="Alcance" valor={formatarNumero(conta.metricas.alcance)} />
            <Metrica label="Interações" valor={formatarNumero(conta.metricas.interacoes)} />
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 shrink-0" /> Métricas em breve
          </p>
        )}
      </div>
    </section>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2 text-center">
      <div className="text-lg font-bold tabular-nums text-foreground">{valor}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
