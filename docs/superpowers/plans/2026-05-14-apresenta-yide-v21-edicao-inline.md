# Apresenta Yide v2.1 — Edição inline — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Editar texto de slides + excluir slides individualmente, sem precisar regenerar tudo.

**Architecture:** Server actions `atualizarSlideAction` / `excluirSlideAction` operam no array JSONB de slides. Validação reusa `isValidSlide` do PR 1. UI: modal com form discriminado por template, ArrayInput pra bullets/topicos, integrado ao editor existente.

**Tech Stack:** Next.js 16, Supabase, React 19, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-14-apresenta-yide-v21-edicao-inline-design.md`](../specs/2026-05-14-apresenta-yide-v21-edicao-inline-design.md)

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `tests/unit/apresenta-yide-edit-actions.test.ts` | Criar |
| `src/lib/apresenta-yide/actions.ts` | Modificar (+atualizarSlideAction, +excluirSlideAction) |
| `src/components/apresenta-yide/ArrayInput.tsx` | Criar |
| `src/components/apresenta-yide/EditSlideDialog.tsx` | Criar |
| `src/components/apresenta-yide/ApresentacaoEditor.tsx` | Modificar (+botão editar, +estado editingIdx) |
| `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx` | Modificar (+prop editable) |

---

## Task 1: Server actions (TDD)

**Files:**
- Create: `tests/unit/apresenta-yide-edit-actions.test.ts`
- Modify: `src/lib/apresenta-yide/actions.ts`

- [ ] **Step 1: Escrever testes**

Crie `tests/unit/apresenta-yide-edit-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { atualizarSlideAction, excluirSlideAction } from "@/lib/apresenta-yide/actions";

const APRES_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";

const SLIDE_CAPA = {
  template: "capa" as const,
  content: { template: "capa" as const, titulo: "Yide" },
};
const SLIDE_CONTEUDO = {
  template: "conteudo" as const,
  content: { template: "conteudo" as const, titulo: "Sobre", texto: "txt" },
};

function setupApresentacaoMock(opts: {
  ownerId?: string;
  slides?: unknown[];
  notFound?: boolean;
}) {
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  fromMock.mockImplementation((table: string) => {
    if (table !== "apresentacoes_yide") throw new Error(`unexpected ${table}`);
    return {
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: opts.notFound
              ? null
              : {
                  id: APRES_ID,
                  criado_por: opts.ownerId ?? ACTOR_ID,
                  slides: opts.slides ?? [SLIDE_CAPA, SLIDE_CONTEUDO],
                },
          }),
        }),
      }),
      update: updateMock,
    };
  });

  return { updateMock };
}

beforeEach(() => {
  requireAuthMock.mockReset();
  fromMock.mockReset();
  logAuditMock.mockReset();
  requireAuthMock.mockResolvedValue({
    id: ACTOR_ID,
    role: "comercial",
    nome: "Yasmin",
    email: "y@yide.com",
    ativo: true,
  });
  logAuditMock.mockResolvedValue(undefined);
});

function makeFormData(input: Record<string, unknown>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(input)) {
    fd.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  return fd;
}

describe("atualizarSlideAction", () => {
  it("atualiza slide e persiste no DB", async () => {
    const { updateMock } = setupApresentacaoMock({});
    const novoContent = { template: "capa", titulo: "Novo título" };
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: novoContent,
    }));
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slides: [
          { template: "capa", content: { template: "capa", titulo: "Novo título" } },
          SLIDE_CONTEUDO,
        ],
      }),
    );
  });

  it("rejeita slide_index fora do range", async () => {
    setupApresentacaoMock({});
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "5",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("range") });
  });

  it("rejeita content com shape inválido", async () => {
    setupApresentacaoMock({});
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa" }, // sem titulo
    }));
    expect(r).toMatchObject({ error: expect.any(String) });
  });

  it("rejeita user que não é criador nem adm/sócio", async () => {
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("permiss") });
  });

  it("permite adm editar slide de outro user", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: "adm-id",
      role: "adm",
      nome: "Admin",
      email: "a@yide.com",
      ativo: true,
    });
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await atualizarSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
      content: { template: "capa", titulo: "x" },
    }));
    expect(r).toEqual({ success: true });
  });
});

describe("excluirSlideAction", () => {
  it("remove slide do array", async () => {
    const { updateMock } = setupApresentacaoMock({});
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
    }));
    expect(r).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slides: [SLIDE_CONTEUDO],
      }),
    );
  });

  it("rejeita index fora do range", async () => {
    setupApresentacaoMock({});
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "99",
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("range") });
  });

  it("rejeita sem permissão", async () => {
    setupApresentacaoMock({ ownerId: "outro-user-id" });
    const r = await excluirSlideAction(makeFormData({
      apresentacao_id: APRES_ID,
      slide_index: "0",
    }));
    expect(r).toMatchObject({ error: expect.stringContaining("permiss") });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/apresenta-yide-edit-actions.test.ts
```
Esperado: erros tipo `atualizarSlideAction is not a function`.

- [ ] **Step 3: Implementar as actions**

Adicione ao final de `src/lib/apresenta-yide/actions.ts`:

```typescript
import { isValidSlide, type Slide, type SlideContent } from "./tipos";

const atualizarSlideSchema = z.object({
  apresentacao_id: z.string().uuid(),
  slide_index: z.coerce.number().int().nonnegative(),
  content: z.string().min(1), // JSON string, parsed below
});

export async function atualizarSlideAction(
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = atualizarSlideSchema.safeParse({
    apresentacao_id: formData.get("apresentacao_id"),
    slide_index: formData.get("slide_index"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let newContent: unknown;
  try {
    newContent = JSON.parse(parsed.data.content);
  } catch {
    return { error: "Content inválido (JSON malformado)" };
  }

  // Wrap em { template, content } pra validar shape via isValidSlide
  const newSlide = isObj(newContent) && typeof newContent.template === "string"
    ? { template: newContent.template, content: newContent }
    : null;
  if (!newSlide || !isValidSlide(newSlide)) {
    return { error: "Content do slide inválido — verifique os campos" };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, criado_por, slides")
    .eq("id", parsed.data.apresentacao_id)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra editar essa apresentação" };
  }

  const slides = (row.slides ?? []) as Slide[];
  if (parsed.data.slide_index >= slides.length) {
    return { error: `Slide index ${parsed.data.slide_index} fora do range (0..${slides.length - 1})` };
  }

  const newSlides = slides.slice();
  newSlides[parsed.data.slide_index] = newSlide;

  const { error } = await sb
    .from("apresentacoes_yide")
    .update({ slides: newSlides })
    .eq("id", parsed.data.apresentacao_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.apresentacao_id,
    acao: "update",
    dados_depois: { slide_atualizado: parsed.data.slide_index },
    ator_id: actor.id,
    justificativa: "Edição inline de slide",
  });

  revalidatePath(`/social-media/apresenta-yide/${parsed.data.apresentacao_id}`);
  return { success: true };
}

const excluirSlideSchema = z.object({
  apresentacao_id: z.string().uuid(),
  slide_index: z.coerce.number().int().nonnegative(),
});

export async function excluirSlideAction(
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = excluirSlideSchema.safeParse({
    apresentacao_id: formData.get("apresentacao_id"),
    slide_index: formData.get("slide_index"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, criado_por, slides")
    .eq("id", parsed.data.apresentacao_id)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra editar essa apresentação" };
  }

  const slides = (row.slides ?? []) as Slide[];
  if (parsed.data.slide_index >= slides.length) {
    return { error: `Slide index ${parsed.data.slide_index} fora do range (0..${slides.length - 1})` };
  }

  const newSlides = slides.slice();
  newSlides.splice(parsed.data.slide_index, 1);

  const { error } = await sb
    .from("apresentacoes_yide")
    .update({ slides: newSlides })
    .eq("id", parsed.data.apresentacao_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.apresentacao_id,
    acao: "update",
    dados_depois: { slide_excluido: parsed.data.slide_index },
    ator_id: actor.id,
    justificativa: "Exclusão de slide individual",
  });

  revalidatePath(`/social-media/apresenta-yide/${parsed.data.apresentacao_id}`);
  return { success: true };
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
```

- [ ] **Step 4: Rodar testes — passam**

```bash
npm test -- tests/unit/apresenta-yide-edit-actions.test.ts
```
Esperado: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/apresenta-yide-edit-actions.test.ts src/lib/apresenta-yide/actions.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): atualizarSlideAction + excluirSlideAction

Permite editar/remover slide individual sem regerar. Valida shape do
content via isValidSlide. Permissão: criador + adm/sócio. Audit log
em cada operação.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ArrayInput helper

**Files:**
- Create: `src/components/apresenta-yide/ArrayInput.tsx`

- [ ] **Step 1: Criar componente**

```typescript
"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  minItems?: number;
}

/**
 * Lista editável de strings — bullets, tópicos, etc. Botão "+" adiciona
 * item ao fim, "×" remove. Respeita maxItems/minItems pra desabilitar
 * os botões nos limites.
 */
export function ArrayInput({
  label,
  values,
  onChange,
  placeholder,
  maxItems = 10,
  minItems = 0,
}: Props) {
  function setAt(i: number, value: string) {
    const next = values.slice();
    next[i] = value;
    onChange(next);
  }

  function removeAt(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
  }

  function addItem() {
    if (values.length >= maxItems) return;
    onChange([...values, ""]);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeAt(i)}
              disabled={values.length <= minItems}
              aria-label="Remover item"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {values.length < maxItems && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar item
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apresenta-yide/ArrayInput.tsx
git commit -m "feat(apresenta-yide): ArrayInput pra editar bullets/topicos

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: EditSlideDialog (modal de edição)

**Files:**
- Create: `src/components/apresenta-yide/EditSlideDialog.tsx`

- [ ] **Step 1: Criar dialog com forms discriminados**

```typescript
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/apresenta-yide/EditSlideDialog.tsx
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): EditSlideDialog — modal de edição inline

Dialog com form discriminado por template (capa/conteudo/duas_colunas/
metrica/topicos/encerramento). Cada template tem campos próprios.
Bullets/tópicos editáveis dinamicamente. Botão excluir slide
desabilitado quando é o único slide. Confirmação inline pra delete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrar Edit no ApresentacaoEditor

**Files:**
- Modify: `src/components/apresenta-yide/ApresentacaoEditor.tsx`
- Modify: `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx`

- [ ] **Step 1: Modificar `ApresentacaoEditor.tsx`**

Read the current file first. Then add props + state for editing.

Add import at top:
```typescript
import { Edit2 } from "lucide-react";
import { EditSlideDialog } from "./EditSlideDialog";
```

Modify the `Props` interface to accept `editable` and `apresentacaoId`:
```typescript
interface Props {
  slides: Slide[];
  titulo: string;
  editable?: boolean;
  apresentacaoId?: string;
}

export function ApresentacaoEditor({ slides, titulo, editable = false, apresentacaoId }: Props) {
```

After the existing `const [idx, setIdx] = useState(0);` line, add:
```typescript
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
```

Adjust the navigation buttons block to include Edit button if `editable` and `apresentacaoId` are set. Find the block:
```tsx
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
```

Replace with:
```tsx
        <div className="flex items-center gap-1.5">
          {editable && apresentacaoId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingIdx(idx)}
              aria-label="Editar slide atual"
            >
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
```

At the end of the return (right before the closing `</div>`), add:
```tsx
      {editable && apresentacaoId && editingIdx !== null && slides[editingIdx] && (
        <EditSlideDialog
          apresentacaoId={apresentacaoId}
          slideIndex={editingIdx}
          slide={slides[editingIdx]}
          totalSlides={total}
          onClose={() => setEditingIdx(null)}
        />
      )}
```

Also handle the case when a slide gets deleted and `idx` becomes out of range. Add `useEffect`:
```typescript
import { useEffect } from "react";
...
  useEffect(() => {
    if (idx >= slides.length && slides.length > 0) {
      setIdx(slides.length - 1);
    }
  }, [slides.length, idx]);
```

- [ ] **Step 2: Modificar `/[id]/page.tsx`**

Encontrar a chamada `<ApresentacaoEditor slides={apresentacao.slides} titulo={apresentacao.titulo} />` e substituir por:

```tsx
<ApresentacaoEditor
  slides={apresentacao.slides}
  titulo={apresentacao.titulo}
  editable={apresentacao.criado_por === user.id || isPrivileged}
  apresentacaoId={apresentacao.id}
/>
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Esperado: 0 erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/apresenta-yide/ApresentacaoEditor.tsx 'src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): botão Editar no Editor + integração na /[id] page

ApresentacaoEditor agora aceita props editable + apresentacaoId.
Quando editable=true, mostra botão "Editar" que abre EditSlideDialog
pro slide atual. useEffect ajusta idx se slide for excluído e idx
ficar fora do range.

/[id] page passa editable baseado em ownership/role (criador ou
adm/sócio podem editar).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Push + PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/apresenta-yide-v21-edicao-inline
```

- [ ] **Step 2: PR via curl**

```bash
curl -s --resolve api.github.com:443:140.82.112.6 \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  -X POST https://api.github.com/repos/time-yide/yide-acompanha/pulls \
  -d '{"title":"feat(apresenta-yide): v2.1 — edição inline de slides","head":"claude/apresenta-yide-v21-edicao-inline","base":"main","body":"## Summary\nApresenta Yide v2.1 — usuária pode editar/excluir slides individuais sem ter que regerar tudo.\n\n### Como funciona\n- Botão **Editar** no editor (visível quando user é criador ou adm/sócio)\n- Click abre modal com form específico do template do slide\n- Edita campos, salva → action `atualizarSlideAction` valida shape via isValidSlide, persiste no DB, `router.refresh()`\n- Botão **Excluir slide** no rodapé do modal (com confirmação inline)\n\n### Templates suportados\nTodos os 6: capa, conteudo, duas_colunas, metrica, topicos_numerados, encerramento. Cada um tem form próprio com os campos corretos. Bullets/tópicos editáveis dinamicamente (add/remove).\n\n### Fora de escopo (v2.2+)\n- Mudar template do slide\n- Reordenar slides (drag-and-drop)\n- Adicionar novo slide do zero\n- Upload de imagens (v2.3)\n\n### Tests\n- 8 unit cobrem atualizarSlideAction + excluirSlideAction (shape inválido, index fora do range, permissões, adm bypass)\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"}'
```

- [ ] **Step 3: Reportar URL do PR**

---

## Self-review

- [x] **Spec coverage:**
  - atualizarSlideAction ✓ Task 1
  - excluirSlideAction ✓ Task 1
  - Forms discriminados por template ✓ Task 3
  - ArrayInput pra bullets/topicos ✓ Task 2
  - Botão excluir no modal ✓ Task 3
  - Integração editor + page ✓ Task 4
  - useEffect ajusta idx pós-delete ✓ Task 4
- [x] Sem placeholders.
- [x] Type consistency: `Slide`, `SlideContent` reusados; props `editable + apresentacaoId` opcionais consistentes.
- [x] Commits frequentes: 4 commits.
