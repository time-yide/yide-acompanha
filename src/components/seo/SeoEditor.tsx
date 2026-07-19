"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/blog/Markdown";
import { salvarPaginaAction } from "@/lib/seo/actions";

export interface SeoPaginaEditavel {
  id: string;
  titulo: string;
  meta_title: string | null;
  meta_description: string | null;
  conteudo_md: string;
}

type Campos = { titulo: string; meta_title: string; meta_description: string; conteudo_md: string };

export function SeoEditor({ pagina }: { pagina: SeoPaginaEditavel }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const [f, setF] = useState<Campos>({
    titulo: pagina.titulo,
    meta_title: pagina.meta_title ?? "",
    meta_description: pagina.meta_description ?? "",
    conteudo_md: pagina.conteudo_md,
  });
  const set = (k: keyof Campos, v: string) => setF((s) => ({ ...s, [k]: v }));

  function salvar() {
    const d = new FormData();
    d.set("id", pagina.id);
    (Object.keys(f) as (keyof Campos)[]).forEach((k) => d.set(k, f[k]));
    start(async () => {
      const r = await salvarPaginaAction(d);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Salvo"); router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Título (H1)</Label>
          <Input id="titulo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} className="text-lg font-semibold" />
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
            <textarea value={f.conteudo_md} onChange={(e) => set("conteudo_md", e.target.value)} rows={20}
              placeholder={"## Subtítulo\n\nEscreva em markdown..."}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salvar</p>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="button" size="sm" onClick={salvar} disabled={pending}><Save className="h-4 w-4" /> Salvar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Publicar/despublicar é feito na matriz.</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO & meta</p>
          <div className="space-y-1.5">
            <Label htmlFor="meta_title" className="text-xs">Meta title (fallback: título)</Label>
            <Input id="meta_title" value={f.meta_title} onChange={(e) => set("meta_title", e.target.value)} className="text-sm" maxLength={70} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta_description" className="text-xs">Meta description</Label>
            <textarea id="meta_description" value={f.meta_description} onChange={(e) => set("meta_description", e.target.value)} rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={160} />
          </div>
        </div>
      </aside>
    </div>
  );
}
