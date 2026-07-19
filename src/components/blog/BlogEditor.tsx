"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Eye, Pencil, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/blog/Markdown";
import { atualizarPostAction, publicarPostAction, arquivarPostAction } from "@/lib/blog/actions";
import type { BlogPostRow } from "@/lib/blog/queries";

type Campos = {
  titulo: string; slug: string; resumo: string; conteudo_md: string; cover_image_url: string;
  meta_title: string; meta_description: string; keywords: string; fonte_url: string; fonte_nome: string;
};

export function BlogEditor({ post }: { post: BlogPostRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const [f, setF] = useState<Campos>({
    titulo: post.titulo, slug: post.slug, resumo: post.resumo ?? "", conteudo_md: post.conteudo_md,
    cover_image_url: post.cover_image_url ?? "", meta_title: post.meta_title ?? "",
    meta_description: post.meta_description ?? "", keywords: post.keywords.join(", "),
    fonte_url: post.fonte_url ?? "", fonte_nome: post.fonte_nome ?? "",
  });
  const set = (k: keyof Campos, v: string) => setF((s) => ({ ...s, [k]: v }));
  const publicado = post.status === "publicado";

  function fd() {
    const d = new FormData();
    d.set("id", post.id);
    (Object.keys(f) as (keyof Campos)[]).forEach((k) => d.set(k, f[k]));
    return d;
  }
  function salvar() {
    start(async () => {
      const r = await atualizarPostAction(fd());
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Salvo"); router.refresh();
    });
  }
  function togglePublicar() {
    const d = new FormData(); d.set("id", post.id); d.set("publicar", String(!publicado));
    start(async () => {
      // salva antes de publicar, pra não publicar versão antiga
      const s = await atualizarPostAction(fd());
      if ("error" in s) { toast.error(s.error); return; }
      const r = await publicarPostAction(d);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(publicado ? "Despublicado" : "Publicado!"); router.refresh();
    });
  }
  function arquivar() {
    if (!window.confirm("Arquivar este post? Sai do blog e da lista.")) return;
    start(async () => {
      const r = await arquivarPostAction(post.id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Arquivado"); router.push("/programacao/blog");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} className="text-lg font-semibold" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resumo">Resumo (aparece na lista e vira meta description)</Label>
          <textarea id="resumo" value={f.resumo} onChange={(e) => set("resumo", e.target.value)} rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={300} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Conteúdo (markdown)</Label>
            <button type="button" onClick={() => setPreview((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {preview ? <><Pencil className="h-3.5 w-3.5" /> Editar</> : <><Eye className="h-3.5 w-3.5" /> Prévia</>}
            </button>
          </div>
          {preview ? (
            <div className="min-h-[320px] rounded-md border bg-card p-4">
              {f.conteudo_md.trim() ? <Markdown>{f.conteudo_md}</Markdown> : <p className="text-sm text-muted-foreground">Nada pra pré-visualizar.</p>}
            </div>
          ) : (
            <textarea value={f.conteudo_md} onChange={(e) => set("conteudo_md", e.target.value)} rows={18}
              placeholder={"# Título\n\nEscreva em markdown..."}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publicação</p>
          <p className="text-sm">
            Status: <span className={`font-semibold ${publicado ? "text-emerald-500" : "text-amber-500"}`}>{publicado ? "Publicado" : "Rascunho"}</span>
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="button" size="sm" onClick={salvar} disabled={pending} variant="outline"><Save className="h-4 w-4" /> Salvar</Button>
            <Button type="button" size="sm" onClick={togglePublicar} disabled={pending}>
              <Send className="h-4 w-4" /> {publicado ? "Despublicar" : "Salvar e publicar"}
            </Button>
            <Button type="button" size="sm" onClick={arquivar} disabled={pending} variant="ghost" className="text-destructive hover:text-destructive">
              <Archive className="h-4 w-4" /> Arquivar
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO & meta</p>
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs">Slug (URL)</Label>
            <Input id="slug" value={f.slug} onChange={(e) => set("slug", e.target.value)} className="text-sm" />
            <p className="text-[10px] text-muted-foreground">/blog/{f.slug || "…"}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta_title" className="text-xs">Meta title (fallback: título)</Label>
            <Input id="meta_title" value={f.meta_title} onChange={(e) => set("meta_title", e.target.value)} className="text-sm" maxLength={70} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta_description" className="text-xs">Meta description (fallback: resumo)</Label>
            <textarea id="meta_description" value={f.meta_description} onChange={(e) => set("meta_description", e.target.value)} rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="keywords" className="text-xs">Palavras-chave (vírgula)</Label>
            <Input id="keywords" value={f.keywords} onChange={(e) => set("keywords", e.target.value)} className="text-sm" placeholder="ia, marketing, seo" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capa & fonte</p>
          <div className="space-y-1.5">
            <Label htmlFor="cover" className="text-xs">URL da imagem de capa</Label>
            <Input id="cover" value={f.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} className="text-sm" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fonte_nome" className="text-xs">Fonte (nome)</Label>
            <Input id="fonte_nome" value={f.fonte_nome} onChange={(e) => set("fonte_nome", e.target.value)} className="text-sm" placeholder="TechCrunch" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fonte_url" className="text-xs">Fonte (link)</Label>
            <Input id="fonte_url" value={f.fonte_url} onChange={(e) => set("fonte_url", e.target.value)} className="text-sm" placeholder="https://..." />
          </div>
        </div>
      </aside>
    </div>
  );
}
