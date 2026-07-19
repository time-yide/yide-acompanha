"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/blog/Markdown";
import { salvarCaseAction, polirCaseAction } from "@/lib/seo/case-actions";
import type { Resultado } from "@/lib/seo/case-queries";

export interface CaseEditavel {
  id: string;
  cliente: string;
  segmento: string;
  localidade: string;
  desafio: string;
  solucao: string;
  resultados: Resultado[];
  depoimento_texto: string;
  depoimento_autor: string;
  cover_image_url: string | null;
  conteudo_md: string;
  meta_title: string | null;
  meta_description: string | null;
}

type Campos = {
  cliente: string; segmento: string; localidade: string; desafio: string; solucao: string;
  depoimento_texto: string; depoimento_autor: string; cover_image_url: string;
  conteudo_md: string; meta_title: string; meta_description: string;
};

export function CaseEditor({ inicial }: { inicial: CaseEditavel }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [polindo, startPolir] = useTransition();
  const [preview, setPreview] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>(
    inicial.resultados.length ? inicial.resultados : [{ rotulo: "", valor: "" }],
  );
  const [f, setF] = useState<Campos>({
    cliente: inicial.cliente,
    segmento: inicial.segmento,
    localidade: inicial.localidade,
    desafio: inicial.desafio,
    solucao: inicial.solucao,
    depoimento_texto: inicial.depoimento_texto,
    depoimento_autor: inicial.depoimento_autor,
    cover_image_url: inicial.cover_image_url ?? "",
    conteudo_md: inicial.conteudo_md,
    meta_title: inicial.meta_title ?? "",
    meta_description: inicial.meta_description ?? "",
  });
  const set = (k: keyof Campos, v: string) => setF((s) => ({ ...s, [k]: v }));

  function setResultado(i: number, k: keyof Resultado, v: string) {
    setResultados((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  }
  function addResultado() {
    setResultados((rs) => [...rs, { rotulo: "", valor: "" }]);
  }
  function removeResultado(i: number) {
    setResultados((rs) => (rs.length <= 1 ? rs : rs.filter((_, j) => j !== i)));
  }

  function montarFd() {
    const d = new FormData();
    d.set("id", inicial.id);
    (Object.keys(f) as (keyof Campos)[]).forEach((k) => d.set(k, f[k]));
    const limpos = resultados.filter((r) => r.rotulo.trim() || r.valor.trim());
    d.set("resultados", JSON.stringify(limpos));
    return d;
  }

  function salvar() {
    start(async () => {
      const r = await salvarCaseAction(montarFd());
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Salvo"); router.refresh();
    });
  }

  function polir() {
    startPolir(async () => {
      const r = await polirCaseAction(montarFd());
      if ("error" in r) { toast.error(r.error); return; }
      setF((s) => ({ ...s, conteudo_md: r.conteudo_md, meta_title: r.meta_title, meta_description: r.meta_description }));
      toast.success("Texto polido pela IA. Revise antes de salvar.");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <Input id="cliente" value={f.cliente} onChange={(e) => set("cliente", e.target.value)} className="font-semibold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segmento">Segmento</Label>
            <Input id="segmento" value={f.segmento} onChange={(e) => set("segmento", e.target.value)} placeholder="Educação, Varejo…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="localidade">Localidade</Label>
            <Input id="localidade" value={f.localidade} onChange={(e) => set("localidade", e.target.value)} placeholder="Cuiabá, MT" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desafio">Desafio</Label>
          <textarea id="desafio" value={f.desafio} onChange={(e) => set("desafio", e.target.value)} rows={3}
            placeholder="Qual era o problema do cliente?"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="solucao">O que a Yide fez</Label>
          <textarea id="solucao" value={f.solucao} onChange={(e) => set("solucao", e.target.value)} rows={3}
            placeholder="As ações que a Yide tomou."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>

        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label>Resultados (números reais)</Label>
            <button type="button" onClick={addResultado}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">A IA só usa estes números. Ex.: valor <em>+240%</em>, rótulo <em>de leads em 3 meses</em>.</p>
          <div className="space-y-2">
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={r.valor} onChange={(e) => setResultado(i, "valor", e.target.value)} placeholder="Valor (+240%)" className="w-32 text-sm" />
                <Input value={r.rotulo} onChange={(e) => setResultado(i, "rotulo", e.target.value)} placeholder="Rótulo (de leads em 3 meses)" className="flex-1 text-sm" />
                <button type="button" onClick={() => removeResultado(i)} disabled={resultados.length <= 1}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-destructive disabled:opacity-40" aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Narrativa (markdown)</Label>
            <button type="button" onClick={() => setPreview((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {preview ? <><Pencil className="h-3.5 w-3.5" /> Editar</> : <><Eye className="h-3.5 w-3.5" /> Prévia</>}
            </button>
          </div>
          {preview ? (
            <div className="min-h-[280px] rounded-md border bg-card p-4">
              {f.conteudo_md.trim() ? <Markdown>{f.conteudo_md}</Markdown> : <p className="text-sm text-muted-foreground">Nada pra pré-visualizar.</p>}
            </div>
          ) : (
            <textarea value={f.conteudo_md} onChange={(e) => set("conteudo_md", e.target.value)} rows={16}
              placeholder={"Preencha os campos e clique \"Polir com IA\", ou escreva em markdown."}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</p>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={polir} disabled={polindo || pending}>
              <Sparkles className="h-4 w-4" /> {polindo ? "Polindo…" : "Polir com IA"}
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={pending || polindo}>
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Publicar/despublicar é feito na lista de cases.</p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Depoimento</p>
          <div className="space-y-1.5">
            <Label htmlFor="depoimento_texto" className="text-xs">Texto</Label>
            <textarea id="depoimento_texto" value={f.depoimento_texto} onChange={(e) => set("depoimento_texto", e.target.value)} rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="depoimento_autor" className="text-xs">Autor</Label>
            <Input id="depoimento_autor" value={f.depoimento_autor} onChange={(e) => set("depoimento_autor", e.target.value)} className="text-sm" placeholder="Nome, cargo" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capa & SEO</p>
          <div className="space-y-1.5">
            <Label htmlFor="cover" className="text-xs">URL da imagem de capa</Label>
            <Input id="cover" value={f.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} className="text-sm" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta_title" className="text-xs">Meta title</Label>
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
