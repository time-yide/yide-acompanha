"use client";
import { useState } from "react";
import { MapPin, Briefcase, Info } from "lucide-react";
import type { Canal } from "@/lib/presenca/config";
import { checklistDoCanal } from "@/lib/presenca/config";
import { progressoChecklist } from "@/lib/presenca/core";
import type { PostRow } from "@/lib/presenca/queries";
import { ChecklistItem } from "./ChecklistItem";
import { GerarPostButton } from "./GerarPostButton";
import { CopyButton } from "./CopyButton";
import { ArquivarPostButton } from "./ArquivarPostButton";

interface CanalData { posts: PostRow[]; feitos: string[] }
interface Props { gmn: CanalData; linkedin: CanalData }

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function textoParaCopiar(post: PostRow): string {
  return post.hashtags.length ? `${post.conteudo}\n\n${post.hashtags.join(" ")}` : post.conteudo;
}

function Painel({ canal, dados, aviso }: { canal: Canal; dados: CanalData; aviso: string }) {
  const itens = checklistDoCanal(canal);
  const prog = progressoChecklist(itens, dados.feitos);
  const feitosSet = new Set(dados.feitos);
  return (
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
  );
}

/** Workspace com abas GMN / LinkedIn: checklist + gerador/lista de posts em cada. */
export function PresencaWorkspace({ gmn, linkedin }: Props) {
  const [aba, setAba] = useState<Canal>("gmn");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setAba("gmn")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            aba === "gmn" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-4 w-4" /> Google Meu Negócio
        </button>
        <button
          type="button"
          onClick={() => setAba("linkedin")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            aba === "linkedin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="h-4 w-4" /> LinkedIn
        </button>
      </div>

      {aba === "gmn" ? (
        <Painel canal="gmn" dados={gmn} aviso="Cole no seu Google Meu Negócio." />
      ) : (
        <Painel canal="linkedin" dados={linkedin} aviso="Copie e publique no LinkedIn (publicação automática em breve)." />
      )}
    </div>
  );
}
