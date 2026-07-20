"use client";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MapPin, Briefcase, Camera, Music2, Video, AtSign, Users, Image, PenTool, Info } from "lucide-react";
import type { Canal } from "@/lib/presenca/config";
import { CANAIS, checklistDoCanal } from "@/lib/presenca/config";
import { progressoChecklist } from "@/lib/presenca/core";
import type { PostRow } from "@/lib/presenca/queries";
import type { ContaCanal } from "@/lib/presenca/contas";
import { ChecklistItem } from "./ChecklistItem";
import { GerarPostButton } from "./GerarPostButton";
import { CopyButton } from "./CopyButton";
import { ArquivarPostButton } from "./ArquivarPostButton";
import { ContaAnaliseCard } from "./ContaAnaliseCard";

interface CanalData { posts: PostRow[]; feitos: string[] }
interface Props {
  dados: Record<Canal, CanalData>;
  contasPorCanal: Record<Canal, ContaCanal>;
  semClienteYide: boolean;
}

const ICONE_CANAL: Record<Canal, LucideIcon> = {
  gmn: MapPin,
  linkedin: Briefcase,
  instagram: Camera,
  tiktok: Music2,
  youtube: Video,
  threads: AtSign,
  facebook: Users,
  pinterest: Image,
  medium: PenTool,
};

function avisoDoCanal(canal: Canal, label: string): string {
  return canal === "gmn"
    ? "Cole no seu Google Meu Negócio."
    : `Copie e publique no ${label} (publicação automática em breve).`;
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function textoParaCopiar(post: PostRow): string {
  return post.hashtags.length ? `${post.conteudo}\n\n${post.hashtags.join(" ")}` : post.conteudo;
}

function Painel({
  canal,
  label,
  dados,
  aviso,
  conta,
  semClienteYide,
}: {
  canal: Canal;
  label: string;
  dados: CanalData;
  aviso: string;
  conta: ContaCanal | null;
  semClienteYide: boolean;
}) {
  const itens = checklistDoCanal(canal);
  const prog = progressoChecklist(itens, dados.feitos);
  const feitosSet = new Set(dados.feitos);
  return (
    <div className="space-y-5">
      <ContaAnaliseCard conta={conta} label={label} semCliente={semClienteYide} />
      <div className="grid gap-5 lg:grid-cols-2">
      {/* Checklist */}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Checklist de otimização</h2>
            <span className="text-xs font-medium text-muted-foreground">
              {prog.feitos}/{prog.total} ({prog.pct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        <div className="space-y-2">
          {itens.map((item) => (
            <ChecklistItem key={item.key} canal={canal} item={item} feito={feitosSet.has(item.key)} />
          ))}
        </div>
      </section>

      {/* Posts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Posts</h2>
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {aviso}
        </p>
        <GerarPostButton canal={canal} />
        {dados.posts.length === 0 ? (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Nenhum rascunho ainda. Gere o primeiro post acima.
          </p>
        ) : (
          <div className="space-y-3">
            {dados.posts.map((post) => (
              <article key={post.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{formatarData(post.created_at)}</span>
                  <div className="flex items-center gap-1.5">
                    <CopyButton texto={textoParaCopiar(post)} />
                    <ArquivarPostButton id={post.id} />
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{post.conteudo}</p>
                {post.hashtags.length > 0 && (
                  <p className="text-xs font-medium text-teal-600 dark:text-teal-400">{post.hashtags.join(" ")}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

/** Workspace com abas dinâmicas por canal: checklist + gerador/lista de posts em cada. */
export function PresencaWorkspace({ dados, contasPorCanal, semClienteYide }: Props) {
  const [aba, setAba] = useState<Canal>(CANAIS[0].value);
  const abaAtual = CANAIS.find((c) => c.value === aba) ?? CANAIS[0];
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1">
          {CANAIS.map(({ value, label }) => {
            const Icone = ICONE_CANAL[value];
            const ativo = aba === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setAba(value)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  ativo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icone className="h-4 w-4" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <Painel
        canal={abaAtual.value}
        label={abaAtual.label}
        dados={dados[abaAtual.value]}
        aviso={avisoDoCanal(abaAtual.value, abaAtual.label)}
        conta={contasPorCanal[abaAtual.value] ?? null}
        semClienteYide={semClienteYide}
      />
    </div>
  );
}
