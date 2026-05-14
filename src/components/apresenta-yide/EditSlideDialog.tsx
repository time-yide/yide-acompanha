"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrayInput } from "./ArrayInput";
import {
  atualizarSlideAction,
  excluirSlideAction,
} from "@/lib/apresenta-yide/actions";
import type {
  Slide,
  SlideCapa,
  SlideConteudo,
  SlideDuasColunas,
  SlideMetrica,
  SlideTopicosNumerados,
  SlideEncerramento,
} from "@/lib/apresenta-yide/tipos";

interface Props {
  apresentacaoId: string;
  slideIndex: number;
  slide: Slide;
  totalSlides: number;
  onClose: () => void;
}

export function EditSlideDialog({
  apresentacaoId,
  slideIndex,
  slide,
  totalSlides,
  onClose,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState(slide.content);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSave() {
    const fd = new FormData();
    fd.set("apresentacao_id", apresentacaoId);
    fd.set("slide_index", String(slideIndex));
    fd.set("content", JSON.stringify(content));
    startTransition(async () => {
      const r = await atualizarSlideAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Slide atualizado");
      onClose();
      router.refresh();
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("apresentacao_id", apresentacaoId);
    fd.set("slide_index", String(slideIndex));
    startTransition(async () => {
      const r = await excluirSlideAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Slide excluído");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar slide {slideIndex + 1} de {totalSlides}</DialogTitle>
          <DialogDescription>
            Template: <strong>{TEMPLATE_LABEL[slide.template]}</strong>. Pra mudar o tipo de slide, exclui e regenera com prompt novo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <SlideForm content={content} onChange={setContent} />
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Excluir slide?</span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={pending}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
              >
                Não
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending || totalSlides <= 1}
              title={totalSlides <= 1 ? "Não dá pra excluir o único slide" : ""}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir slide
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TEMPLATE_LABEL: Record<string, string> = {
  capa: "Capa",
  conteudo: "Conteúdo",
  duas_colunas: "Duas colunas",
  metrica: "Métrica em destaque",
  topicos_numerados: "Tópicos numerados",
  encerramento: "Encerramento",
};

// ─── SlideForm: dispatcher por template ─────────────────────────────────

interface SlideFormProps<T> {
  content: T;
  onChange: (next: T) => void;
}

function SlideForm({ content, onChange }: { content: Slide["content"]; onChange: (c: Slide["content"]) => void }) {
  switch (content.template) {
    case "capa":
      return <CapaForm content={content} onChange={onChange} />;
    case "conteudo":
      return <ConteudoForm content={content} onChange={onChange} />;
    case "duas_colunas":
      return <DuasColunasForm content={content} onChange={onChange} />;
    case "metrica":
      return <MetricaForm content={content} onChange={onChange} />;
    case "topicos_numerados":
      return <TopicosNumeradosForm content={content} onChange={onChange} />;
    case "encerramento":
      return <EncerramentoForm content={content} onChange={onChange} />;
  }
}

function CapaForm({ content, onChange }: SlideFormProps<SlideCapa>) {
  return (
    <>
      <Field label="Título">
        <Input
          value={content.titulo}
          onChange={(e) => onChange({ ...content, titulo: e.target.value })}
          maxLength={120}
        />
      </Field>
      <Field label="Subtítulo (opcional)">
        <Input
          value={content.subtitulo ?? ""}
          onChange={(e) => onChange({ ...content, subtitulo: e.target.value || undefined })}
          maxLength={200}
        />
      </Field>
    </>
  );
}

function ConteudoForm({ content, onChange }: SlideFormProps<SlideConteudo>) {
  return (
    <>
      <Field label="Título">
        <Input
          value={content.titulo}
          onChange={(e) => onChange({ ...content, titulo: e.target.value })}
          maxLength={120}
        />
      </Field>
      <Field label="Texto (opcional)">
        <Textarea
          value={content.texto ?? ""}
          onChange={(e) => onChange({ ...content, texto: e.target.value || undefined })}
          rows={3}
          maxLength={500}
        />
      </Field>
      <ArrayInput
        label="Bullets (opcional)"
        values={content.bullets ?? []}
        onChange={(bullets) => onChange({ ...content, bullets: bullets.length > 0 ? bullets : undefined })}
        placeholder="Ex.: Crescimento de 30%"
        maxItems={6}
      />
    </>
  );
}

function DuasColunasForm({ content, onChange }: SlideFormProps<SlideDuasColunas>) {
  return (
    <>
      <Field label="Título">
        <Input
          value={content.titulo}
          onChange={(e) => onChange({ ...content, titulo: e.target.value })}
          maxLength={120}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-card/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coluna esquerda
          </div>
          <Field label="Título">
            <Input
              value={content.coluna_esquerda.titulo}
              onChange={(e) => onChange({ ...content, coluna_esquerda: { ...content.coluna_esquerda, titulo: e.target.value } })}
              maxLength={60}
            />
          </Field>
          <Field label="Texto">
            <Textarea
              value={content.coluna_esquerda.texto}
              onChange={(e) => onChange({ ...content, coluna_esquerda: { ...content.coluna_esquerda, texto: e.target.value } })}
              rows={3}
              maxLength={300}
            />
          </Field>
        </div>
        <div className="space-y-3 rounded-lg border bg-card/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coluna direita
          </div>
          <Field label="Título">
            <Input
              value={content.coluna_direita.titulo}
              onChange={(e) => onChange({ ...content, coluna_direita: { ...content.coluna_direita, titulo: e.target.value } })}
              maxLength={60}
            />
          </Field>
          <Field label="Texto">
            <Textarea
              value={content.coluna_direita.texto}
              onChange={(e) => onChange({ ...content, coluna_direita: { ...content.coluna_direita, texto: e.target.value } })}
              rows={3}
              maxLength={300}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function MetricaForm({ content, onChange }: SlideFormProps<SlideMetrica>) {
  return (
    <>
      <Field label="Número (ex.: +34% / R$ 50k / 4x)">
        <Input
          value={content.numero}
          onChange={(e) => onChange({ ...content, numero: e.target.value })}
          maxLength={20}
        />
      </Field>
      <Field label="Label (o que esse número representa)">
        <Input
          value={content.label}
          onChange={(e) => onChange({ ...content, label: e.target.value })}
          maxLength={100}
        />
      </Field>
      <Field label="Descrição (opcional)">
        <Textarea
          value={content.descricao ?? ""}
          onChange={(e) => onChange({ ...content, descricao: e.target.value || undefined })}
          rows={2}
          maxLength={250}
        />
      </Field>
    </>
  );
}

function TopicosNumeradosForm({ content, onChange }: SlideFormProps<SlideTopicosNumerados>) {
  function updateTopico(i: number, patch: Partial<SlideTopicosNumerados["topicos"][number]>) {
    const next = content.topicos.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...content, topicos: next });
  }
  function removeTopico(i: number) {
    const next = content.topicos.slice();
    next.splice(i, 1);
    onChange({ ...content, topicos: next });
  }
  function addTopico() {
    onChange({ ...content, topicos: [...content.topicos, { titulo: "" }] });
  }

  return (
    <>
      <Field label="Título">
        <Input
          value={content.titulo}
          onChange={(e) => onChange({ ...content, titulo: e.target.value })}
          maxLength={120}
        />
      </Field>
      <div className="space-y-3">
        <Label>Tópicos (3 a 6)</Label>
        {content.topicos.map((t, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Tópico {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeTopico(i)}
                disabled={content.topicos.length <= 1}
                aria-label="Remover tópico"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              placeholder="Título do tópico"
              value={t.titulo}
              onChange={(e) => updateTopico(i, { titulo: e.target.value })}
              maxLength={60}
            />
            <Input
              placeholder="Descrição curta (opcional)"
              value={t.texto ?? ""}
              onChange={(e) => updateTopico(i, { texto: e.target.value || undefined })}
              maxLength={100}
            />
          </div>
        ))}
        {content.topicos.length < 6 && (
          <Button type="button" variant="outline" size="sm" onClick={addTopico}>
            Adicionar tópico
          </Button>
        )}
      </div>
    </>
  );
}

function EncerramentoForm({ content, onChange }: SlideFormProps<SlideEncerramento>) {
  return (
    <>
      <Field label="Mensagem">
        <Input
          value={content.mensagem}
          onChange={(e) => onChange({ ...content, mensagem: e.target.value })}
          maxLength={120}
        />
      </Field>
      <Field label="CTA (opcional)">
        <Input
          value={content.cta ?? ""}
          onChange={(e) => onChange({ ...content, cta: e.target.value || undefined })}
          maxLength={80}
        />
      </Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
