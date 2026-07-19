"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { salvarHomeAction } from "@/lib/seo/home-actions";
import type { HomeConfig, Stat } from "@/lib/seo/home-config";

export function HomeConfigForm({ inicial }: { inicial: HomeConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [stats, setStats] = useState<Stat[]>(inicial.stats.length ? inicial.stats : [{ valor: "", rotulo: "" }]);

  function updateStat(i: number, campo: keyof Stat, valor: string) {
    setStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)));
  }
  function addStat() {
    setStats((prev) => [...prev, { valor: "", rotulo: "" }]);
  }
  function removeStat(i: number) {
    setStats((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(fd: FormData) {
    const limpos = stats.map((s) => ({ valor: s.valor.trim(), rotulo: s.rotulo.trim() })).filter((s) => s.valor || s.rotulo);
    fd.set("stats", JSON.stringify(limpos));
    start(async () => {
      const r = await salvarHomeAction(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Home atualizada.");
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-8">
      {/* Hero */}
      <fieldset className="space-y-4 rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Hero</legend>
        <div className="space-y-1.5">
          <Label htmlFor="hero_titulo">Título</Label>
          <Input id="hero_titulo" name="hero_titulo" defaultValue={inicial.hero_titulo} placeholder="Título principal" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero_sub">Subtítulo</Label>
          <Textarea id="hero_sub" name="hero_sub" rows={2} defaultValue={inicial.hero_sub} placeholder="Subtítulo" />
        </div>
      </fieldset>

      {/* Números */}
      <fieldset className="space-y-3 rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Números</legend>
        <p className="text-xs text-muted-foreground">
          Valor pode ter prefixo/sufixo (ex.: <code>+100</code>, <code>5+</code>, <code>24/7</code>). Se tiver dígitos, anima com contagem.
        </p>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Valor ${i + 1}`}
                value={s.valor}
                onChange={(e) => updateStat(i, "valor", e.target.value)}
                placeholder="+100"
                className="w-28"
              />
              <Input
                aria-label={`Rótulo ${i + 1}`}
                value={s.rotulo}
                onChange={(e) => updateStat(i, "rotulo", e.target.value)}
                placeholder="clientes atendidos"
                className="flex-1"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => removeStat(i)} aria-label="Remover número">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addStat}>
          <Plus className="h-4 w-4" /> Adicionar número
        </Button>
        <input type="hidden" name="stats" />
      </fieldset>

      {/* Sobre */}
      <fieldset className="space-y-4 rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Sobre</legend>
        <div className="space-y-1.5">
          <Label htmlFor="sobre_titulo">Título</Label>
          <Input id="sobre_titulo" name="sobre_titulo" defaultValue={inicial.sobre_titulo} placeholder="A Yide Digital" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sobre_texto">Texto</Label>
          <Textarea id="sobre_texto" name="sobre_texto" rows={4} defaultValue={inicial.sobre_texto} placeholder="Posicionamento da empresa" />
        </div>
      </fieldset>

      {/* CTA */}
      <fieldset className="space-y-4 rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Chamada final</legend>
        <div className="space-y-1.5">
          <Label htmlFor="cta_titulo">Título do CTA</Label>
          <Input id="cta_titulo" name="cta_titulo" defaultValue={inicial.cta_titulo} placeholder="Vamos crescer sua empresa?" />
        </div>
      </fieldset>

      {/* Clientes */}
      <fieldset className="space-y-4 rounded-xl border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Clientes</legend>
        <div className="space-y-1.5">
          <Label htmlFor="clientes">Nomes (um por linha)</Label>
          <Textarea id="clientes" name="clientes" rows={5} defaultValue={inicial.clientes.join("\n")} placeholder={"Cliente A\nCliente B"} />
          <p className="text-xs text-muted-foreground">Deixe vazio para esconder a seção.</p>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </Button>
      </div>
    </form>
  );
}
