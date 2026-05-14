"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { criarApresentacaoMockAction } from "@/lib/apresenta-yide/actions";
import { useRouter } from "next/navigation";

export function PromptForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await criarApresentacaoMockAction(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push(r.redirect);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título da apresentação *</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          maxLength={200}
          placeholder="Ex.: Apresentação Yide pra cliente X"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">O que você quer apresentar? *</Label>
        <Textarea
          id="prompt"
          name="prompt"
          required
          minLength={20}
          maxLength={5000}
          rows={8}
          placeholder="Descreve o conteúdo que vai entrar na apresentação. Quanto mais contexto, melhor a IA estrutura: público-alvo, mensagens principais, métricas que você quer destacar..."
          disabled={pending}
          className="resize-none"
        />
        <p className="text-[11px] text-muted-foreground">
          Mínimo 20 caracteres. A IA vai usar isso pra estruturar os slides.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="objetivo">Objetivo (opcional)</Label>
        <Input
          id="objetivo"
          name="objetivo"
          maxLength={500}
          placeholder="Ex.: fechar venda com cliente novo / apresentar resultados do mês"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="num_slides_alvo">Quantos slides? (5 a 15)</Label>
        <Input
          id="num_slides_alvo"
          name="num_slides_alvo"
          type="number"
          min={5}
          max={15}
          defaultValue={8}
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        <Sparkles className="mr-2 h-4 w-4" />
        {pending ? "Criando..." : "Gerar apresentação"}
      </Button>

      <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
        <strong className="text-foreground">PR 1:</strong> v1 cria a apresentação com slides
        de exemplo pra você ver o design. A geração via IA real entra na próxima fase.
      </p>
    </form>
  );
}
