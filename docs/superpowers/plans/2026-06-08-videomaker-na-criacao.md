# Escolher o videomaker direto na criação da gravação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na criação (e edição) de um evento de gravação (`sub_calendar = "videomakers"`), exigir a escolha do videomaker e já gravar o evento como `scheduled` (delegado), pulando a fila `pending_delegation` do coordenador.

**Architecture:** As colunas `videomaker_assigned_id`, `videomaker_status`, `videomaker_delegado_por`, `videomaker_delegado_em` já existem em `origin/main` (criadas pro fluxo de delegação do coordenador). Esta mudança apenas passa a preenchê-las na criação/edição do evento, espelhando as validações de `delegateVideomakerAction` (role=videomaker, ativo, sem conflito de horário). **Sem migration.**

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Zod, Supabase (RLS + exclusion constraint `no_videomaker_overlap`), Vitest.

**Base branch:** `feat/videomaker-na-criacao` criada a partir de `origin/main`.

---

## File Structure

- **Modify:** `src/lib/calendario/schema.ts` — campo `videomaker_assigned_id` + `superRefine` (obrigatório p/ videomakers).
- **Modify:** `src/lib/calendario/actions.ts` — helper `validateAndResolveVideomaker` + wiring em create/update.
- **Modify:** `src/components/calendario/EventForm.tsx` — prop `videomakers` + seletor "Videomaker responsável".
- **Modify:** `src/app/(authed)/calendario/novo/page.tsx` — busca `listVideomakersAtivos()` e passa ao form.
- **Modify:** `src/app/(authed)/calendario/[id]/page.tsx` — idem + default `videomaker_assigned_id`.
- **Create:** `tests/unit/calendario-videomaker-criacao.test.ts` — testa schema + helper de participantes.

**Não tocar:** `queries.ts`, `coord-actions.ts`, dialogs do coordenador.

---

### Task 1: Schema — campo obrigatório + helper de participantes (TDD)

**Files:**
- Modify: `src/lib/calendario/schema.ts`
- Test: `tests/unit/calendario-videomaker-criacao.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/unit/calendario-videomaker-criacao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createEventSchema,
  comParticipanteVideomaker,
} from "@/lib/calendario/schema";

const VM = randomUUID();
const P1 = randomUUID();

const base = {
  titulo: "Gravação reels",
  inicio: "2026-06-10T10:00",
  fim: "2026-06-10T11:00",
  participantes_ids: [P1],
};

describe("createEventSchema — videomaker na gravação", () => {
  it("rejeita videomakers sem videomaker_assigned_id", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "videomakers" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain("videomaker_assigned_id");
      expect(r.error.issues[0].message).toMatch(/videomaker/i);
    }
  });

  it("aceita videomakers com videomaker_assigned_id", () => {
    const r = createEventSchema.safeParse({
      ...base, sub_calendar: "videomakers", videomaker_assigned_id: VM,
    });
    expect(r.success).toBe(true);
  });

  it("aceita agência sem videomaker", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});

describe("comParticipanteVideomaker", () => {
  it("adiciona o videomaker quando ausente", () => {
    expect(comParticipanteVideomaker([P1], VM)).toEqual([P1, VM]);
  });
  it("não duplica quando já presente", () => {
    expect(comParticipanteVideomaker([P1, VM], VM)).toEqual([P1, VM]);
  });
  it("retorna a lista intacta quando videomaker é null", () => {
    expect(comParticipanteVideomaker([P1], null)).toEqual([P1]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- calendario-videomaker-criacao`
Expected: FAIL — `comParticipanteVideomaker` não existe / schema aceita sem videomaker.

- [ ] **Step 3: Implementar no schema**

In `src/lib/calendario/schema.ts`, add `videomaker_assigned_id` to `baseEventFields` (after `observacoes_gravacao`):

```ts
  observacoes_gravacao: z.string().optional().nullable(),
  videomaker_assigned_id: z.string().uuid().optional().nullable(),
```

Replace the two schema export lines:

```ts
export const createEventSchema = z.object(baseEventFields);
export const editEventSchema = z.object({ ...baseEventFields, id: z.string().uuid() });
```

with:

```ts
// Na gravação (videomakers) o videomaker responsável é obrigatório: o evento
// nasce já delegado (scheduled) em vez de cair na fila do coordenador.
function refineVideomaker(
  data: { sub_calendar: SelectableSub; videomaker_assigned_id?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.sub_calendar === "videomakers" && !data.videomaker_assigned_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["videomaker_assigned_id"],
      message: "Escolha o videomaker responsável pela gravação",
    });
  }
}

export const createEventSchema = z.object(baseEventFields).superRefine(refineVideomaker);
export const editEventSchema = z
  .object({ ...baseEventFields, id: z.string().uuid() })
  .superRefine(refineVideomaker);

/**
 * Garante que o videomaker designado esteja em participantes_ids (sem
 * duplicar) — pra agenda/notificação dele funcionarem. Retorna a lista
 * intacta quando não há videomaker.
 */
export function comParticipanteVideomaker(
  participantes: string[],
  videomakerId: string | null | undefined,
): string[] {
  if (!videomakerId) return participantes;
  return participantes.includes(videomakerId)
    ? participantes
    : [...participantes, videomakerId];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- calendario-videomaker-criacao`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/schema.ts tests/unit/calendario-videomaker-criacao.test.ts
git commit -m "feat(calendario): exige videomaker na gravação + helper de participantes"
```

---

### Task 2: Helper de validação do videomaker (server)

**Files:**
- Modify: `src/lib/calendario/actions.ts`

> Espelha a validação de `delegateVideomakerAction` (role=videomaker, ativo, conflito
> de horário). Recebe um client supabase já criado. Usa `as any` no client pra
> acessar colunas videomaker_* que podem não estar nos types gerados ainda — mesmo
> padrão de `coord-actions.ts`.

- [ ] **Step 1: Adicionar o helper no topo de actions.ts (após `canCreateVideomaker`)**

```ts
/**
 * Valida que `videomakerId` é um videomaker ativo e não tem captação scheduled
 * com horário sobreposto a [inicioUtc, fimUtc]. `excludeEventId` ignora o
 * próprio evento (usado na edição). Espelha delegateVideomakerAction.
 * Inputs de horário são ISO UTC.
 */
async function validateVideomakerAssignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  params: { videomakerId: string; inicioUtc: string; fimUtc: string; excludeEventId?: string },
): Promise<{ error: string } | { ok: true; nome: string }> {
  const { data: vm } = await sb
    .from("profiles")
    .select("id, nome, role, ativo")
    .eq("id", params.videomakerId)
    .single();
  if (!vm || vm.role !== "videomaker" || !vm.ativo) {
    return { error: "Videomaker inválido ou inativo" };
  }

  let q = sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim")
    .eq("sub_calendar", "videomakers")
    .eq("videomaker_status", "scheduled")
    .eq("videomaker_assigned_id", params.videomakerId)
    .lt("inicio", params.fimUtc)
    .gt("fim", params.inicioUtc);
  if (params.excludeEventId) q = q.neq("id", params.excludeEventId);
  const { data: conflict } = await q.limit(1).maybeSingle();
  if (conflict) {
    const inicioBR = new Date(conflict.inicio).toLocaleString("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return { error: `${vm.nome} já tem captação "${conflict.titulo}" às ${inicioBR}` };
  }
  return { ok: true, nome: vm.nome };
}
```

> `APP_TIMEZONE` já está importado em `actions.ts` (de `@/lib/datetime/timezone`).
> `comParticipanteVideomaker` precisa entrar no import de `./schema`.

- [ ] **Step 2: Adicionar `comParticipanteVideomaker` ao import de `./schema`**

Update the import block:

```ts
import {
  createEventSchema,
  editEventSchema,
  comParticipanteVideomaker,
  ROLES_PODEM_CRIAR_VIDEOMAKER,
  type SelectableSub,
  SELECTABLE_SUBS,
} from "./schema";
```

- [ ] **Step 3: Type-check (helper ainda não usado — esperado lint warning de unused, ok no próximo task)**

Run: `npm run typecheck`
Expected: PASS. (lint de "unused" será resolvido no Task 3 quando o helper for chamado; se `npm run lint` reclamar agora, segue — o uso entra no Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendario/actions.ts
git commit -m "feat(calendario): helper validateVideomakerAssignment"
```

---

### Task 3: `createEventAction` — atribuir videomaker direto na criação

**Files:**
- Modify: `src/lib/calendario/actions.ts`

> No `origin/main`, `createEventAction` hoje insere videomaker como
> `pending_delegation` e redireciona pra `/audiovisual?tab=aguardando_videomaker`.
> Vamos: validar o videomaker, inseri-lo já como `scheduled`, e redirecionar pra
> `/calendario`.

- [ ] **Step 1: Passar `videomaker_assigned_id` ao parse**

In the `createEventSchema.safeParse({...})` object, add after `observacoes_gravacao`:

```ts
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
    videomaker_assigned_id: fd(formData, "videomaker_assigned_id"),
```

- [ ] **Step 2: Substituir o bloco de payload/insert/redirect do videomaker**

Locate the existing block that starts at `const isVideomaker = parsed.data.sub_calendar === "videomakers";`
and goes through the `insertPayload`/fallback/insert. Replace from `const isVideomaker = ...`
down to (and including) the line that obtains `const { data: created, error } = createResult;`
with:

```ts
  const isVideomaker = parsed.data.sub_calendar === "videomakers";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Gravação: valida o videomaker escolhido e já agenda (scheduled) direto,
  // sem passar pela fila de delegação do coordenador.
  let videomakerId: string | null = null;
  if (isVideomaker) {
    videomakerId = parsed.data.videomaker_assigned_id ?? null;
    if (!videomakerId) return { error: "Escolha o videomaker responsável pela gravação" };
    const check = await validateVideomakerAssignment(sb, {
      videomakerId,
      inicioUtc,
      fimUtc,
    });
    if ("error" in check) return { error: check.error };
  }

  const participantesFinais = comParticipanteVideomaker(
    parsed.data.participantes_ids,
    videomakerId,
  );

  const basePayload = {
    organization_id: org.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    inicio: inicioUtc,
    fim: fimUtc,
    sub_calendar: parsed.data.sub_calendar,
    criado_por: actor.id,
    participantes_ids: participantesFinais,
    client_id: parsed.data.client_id || null,
    localizacao_endereco: parsed.data.localizacao_endereco?.trim() || null,
    localizacao_maps_url: parsed.data.localizacao_maps_url?.trim() || null,
    link_roteiro: parsed.data.link_roteiro?.trim() || null,
    roteiro_tipo: parsed.data.roteiro_tipo ?? null,
    roteiro_pdf_path: parsed.data.roteiro_pdf_path ?? null,
    observacoes_gravacao: parsed.data.observacoes_gravacao?.trim() || null,
  };
  const insertPayload = isVideomaker
    ? {
        ...basePayload,
        videomaker_assigned_id: videomakerId,
        videomaker_status: "scheduled" as const,
        videomaker_delegado_por: actor.id,
        videomaker_delegado_em: new Date().toISOString(),
      }
    : basePayload;

  const createResult = await sb
    .from("calendar_events")
    .insert(insertPayload)
    .select("id")
    .single();

  // Constraint no_videomaker_overlap é a defesa em profundidade contra corrida
  // (duas criações pro mesmo videomaker no mesmo horário).
  if (createResult.error) {
    const msg = String(createResult.error.message ?? "");
    if (msg.includes("no_videomaker_overlap")) {
      return { error: "Esse videomaker já tem outra captação nesse horário. Recarregue e tente de novo." };
    }
    return { error: createResult.error.message };
  }

  const { data: created, error } = createResult;
```

- [ ] **Step 3: Ajustar a notificação para usar `participantesFinais`**

In the `after(notifyCalendarParticipants({...}))` call, change `participantesNovos`:

```ts
    participantesNovos: participantesFinais,
```

- [ ] **Step 4: Trocar o redirect do videomaker**

Replace the trailing redirect block:

```ts
  if (isVideomaker) {
    revalidatePath("/audiovisual");
    redirect(`/audiovisual?tab=aguardando_videomaker&novo=${created.id}`);
  }
  redirect(`/calendario`);
```

with:

```ts
  // Nasce já agendado (scheduled), então vai direto pra agenda — não mais
  // pra fila "aguardando videomaker".
  if (isVideomaker) revalidatePath("/audiovisual");
  redirect(`/calendario`);
```

- [ ] **Step 5: Type-check + lint + testes**

Run: `npm run typecheck && npm run lint && npm test -- calendario-videomaker-criacao`
Expected: PASS. (Confirme que o `as any` no client cobre `videomaker_status`/`videomaker_assigned_id` no insert; se reclamar de `created` possivelmente null, mantenha o guard `if (error || !created)` logo abaixo, que já existe.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/calendario/actions.ts
git commit -m "feat(calendario): grava videomaker como scheduled direto na criação"
```

---

### Task 4: `updateEventAction` — reatribuir videomaker na edição

**Files:**
- Modify: `src/lib/calendario/actions.ts`

- [ ] **Step 1: Passar `videomaker_assigned_id` ao parse**

In the `editEventSchema.safeParse({...})` object, add after `observacoes_gravacao`:

```ts
    observacoes_gravacao: fd(formData, "observacoes_gravacao"),
    videomaker_assigned_id: fd(formData, "videomaker_assigned_id"),
```

- [ ] **Step 2: Resolver mudança de videomaker e montar updates**

Right after the `fim <= inicio` guard (before `const updatePayload = {`), add:

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeVm = before as any;
  const isVideomaker = parsed.data.sub_calendar === "videomakers";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbUpd = supabase as any;

  let videomakerId: string | null = beforeVm?.videomaker_assigned_id ?? null;
  let participantesFinais = parsed.data.participantes_ids;

  if (isVideomaker) {
    videomakerId = parsed.data.videomaker_assigned_id ?? null;
    if (!videomakerId) return { error: "Escolha o videomaker responsável pela gravação" };
    const mudou = videomakerId !== (beforeVm?.videomaker_assigned_id ?? null);
    if (mudou) {
      const check = await validateVideomakerAssignment(sbUpd, {
        videomakerId,
        inicioUtc,
        fimUtc,
        excludeEventId: id,
      });
      if ("error" in check) return { error: check.error };
      // Remove o videomaker antigo de participantes (se estava só pela atribuição)
      // e adiciona o novo.
      const semAntigo = participantesFinais.filter(
        (pid) => pid !== (beforeVm?.videomaker_assigned_id ?? null),
      );
      participantesFinais = comParticipanteVideomaker(semAntigo, videomakerId);
    } else {
      participantesFinais = comParticipanteVideomaker(participantesFinais, videomakerId);
    }
  }
```

- [ ] **Step 3: Usar `participantesFinais` e gravar os campos do videomaker no updatePayload**

In `updatePayload`, change the `participantes_ids` line:

```ts
    participantes_ids: participantesFinais,
```

Immediately after the `updatePayload` object is declared (before the PDF-cleanup block),
add the videomaker fields when applicable:

```ts
  if (isVideomaker) {
    Object.assign(updatePayload, {
      videomaker_assigned_id: videomakerId,
      videomaker_status: "scheduled",
      videomaker_delegado_por: actor.id,
      videomaker_delegado_em: new Date().toISOString(),
    });
  }
```

- [ ] **Step 4: Tratar a constraint no update**

The existing update is:
`const { error } = await supabase.from("calendar_events").update(updatePayload as any).eq("id", id);`
Replace it with a version that maps the overlap constraint to a friendly message:

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("calendar_events").update(updatePayload as any).eq("id", id);
  if (error) {
    if (error.message?.includes("no_videomaker_overlap")) {
      return { error: "Esse videomaker já tem outra captação nesse horário. Recarregue e tente de novo." };
    }
    return { error: error.message };
  }
```

> Remove the original `if (error) return { error: error.message };` that followed the
> old update call (the new block above replaces it).

- [ ] **Step 5: Ajustar a notificação para `participantesFinais`**

In the update's notification diff, change the source list:

```ts
  const adicionados = participantesFinais.filter(
    (pid) => !participantesAntes.includes(pid),
  );
```

- [ ] **Step 6: Type-check + lint + testes**

Run: `npm run typecheck && npm run lint && npm test -- calendario-videomaker-criacao`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/calendario/actions.ts
git commit -m "feat(calendario): reatribui videomaker na edição da gravação"
```

---

### Task 5: Formulário — seletor "Videomaker responsável"

**Files:**
- Modify: `src/components/calendario/EventForm.tsx`

- [ ] **Step 1: Adicionar a prop `videomakers` e o default**

In `Props`, add a new field after `clientes`:

```ts
  profiles: ProfileOption[];
  clientes: ClientOption[];
  videomakers: ProfileOption[];
  canCreateVideomaker: boolean;
```

In `Props.defaults` Partial, add after `observacoes_gravacao: string | null;`:

```ts
    observacoes_gravacao: string | null;
    videomaker_assigned_id: string | null;
```

- [ ] **Step 2: Receber a prop e criar o estado**

Update the destructuring signature:

```ts
export function EventForm({ action, defaults = {}, profiles, clientes, videomakers, canCreateVideomaker, submitLabel = "Salvar" }: Props) {
```

After the `clientId` state line, add:

```ts
  const [videomakerId, setVideomakerId] = useState<string | null>(defaults.videomaker_assigned_id ?? null);
```

- [ ] **Step 3: Renderizar o seletor no topo do bloco de gravação**

Inside `{isVideomaker && (...)}`, right after the header div
(`...Detalhes da gravação</div>`) and before the Cliente field, insert:

```tsx
          <div className="space-y-2">
            <Label htmlFor="videomaker_assigned_id" className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" /> Videomaker responsável
            </Label>
            <input type="hidden" name="videomaker_assigned_id" value={videomakerId ?? ""} />
            <SearchableSelect
              options={videomakers.map((v) => ({ value: v.id, label: v.nome }))}
              value={videomakerId}
              onChange={(v) => setVideomakerId(v ?? null)}
              placeholder="Escolha o videomaker"
              emptyText="Nenhum videomaker ativo"
            />
            <p className="text-[11px] text-muted-foreground">
              Quem vai gravar. O evento já entra agendado direto pra esse videomaker (sem passar pela fila do coordenador).
            </p>
          </div>
```

> `Video`, `SearchableSelect`, `Label` já estão importados.

- [ ] **Step 4: Type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: pode falhar de propósito nas páginas que ainda não passam `videomakers` — resolvido no Task 6. Confirme que os erros são SÓ "missing prop videomakers" em `novo/page.tsx` e `[id]/page.tsx`. Qualquer outro erro deve ser corrigido aqui.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendario/EventForm.tsx
git commit -m "feat(calendario): seletor de videomaker responsável no form"
```

---

### Task 6: Páginas — fornecer a lista de videomakers

**Files:**
- Modify: `src/app/(authed)/calendario/novo/page.tsx`
- Modify: `src/app/(authed)/calendario/[id]/page.tsx`

- [ ] **Step 1: `novo/page.tsx` — importar e buscar a lista**

Add the import (after the existing imports):

```ts
import { listVideomakersAtivos } from "@/lib/audiovisual/coord-queries";
```

Change the data fetch to also load videomakers:

```ts
  const [{ data: profiles = [] }, { data: clientes = [] }, videomakers] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    listVideomakersAtivos(),
  ]);
```

Pass the prop to `EventForm`:

```tsx
        <EventForm
          action={createEventAction}
          profiles={profiles ?? []}
          clientes={clientes ?? []}
          videomakers={videomakers}
          canCreateVideomaker={canCreateVideomaker}
          submitLabel="Criar evento"
        />
```

- [ ] **Step 2: `[id]/page.tsx` — importar, buscar, passar prop e default**

Add the import:

```ts
import { listVideomakersAtivos } from "@/lib/audiovisual/coord-queries";
```

Change the data fetch:

```ts
  const [{ data: profiles = [] }, { data: clientes = [] }, videomakers] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
    listVideomakersAtivos(),
  ]);
```

In the `EventForm` `defaults={{...}}`, add after `observacoes_gravacao: event.observacoes_gravacao ?? null,`:

```tsx
              observacoes_gravacao: event.observacoes_gravacao ?? null,
              videomaker_assigned_id: event.videomaker_assigned_id ?? null,
```

Add the `videomakers` prop to that same `EventForm`:

```tsx
            profiles={profiles ?? []}
            clientes={clientes ?? []}
            videomakers={videomakers}
            canCreateVideomaker={canCreateVideomaker}
            submitLabel="Salvar alterações"
```

- [ ] **Step 3: Verificação completa**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tudo PASS (incluindo os 6 testes de `calendario-videomaker-criacao`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/calendario/novo/page.tsx" "src/app/(authed)/calendario/[id]/page.tsx"
git commit -m "feat(calendario): páginas fornecem lista de videomakers ao form"
```

---

### Task 7: Verificação final e conferência de aceite

- [ ] **Step 1: Suíte completa**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tudo verde.

- [ ] **Step 2: Build de produção (pega erros de RSC/Next que o typecheck não pega)**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Conferir critérios de aceite contra o spec**

Revisar `docs/superpowers/specs/2026-06-08-responsavel-gravacao-design.md`:
1. Criar gravação sem videomaker → erro de validação. ✅ (Task 1 + Task 3)
2. Criar com videomaker → nasce `scheduled`, em participantes, redireciona `/calendario`. ✅ (Task 3)
3. Videomaker (≠ criador) notificado. ✅ (Task 3, fluxo de participantes)
4. Conflito de horário → erro amigável. ✅ (Task 2 + Task 3)
5. Editar trocando videomaker → reatribui, sincroniza participantes, notifica. ✅ (Task 4)
6. Só videomakers ativos na lista. ✅ (Task 6, `listVideomakersAtivos`)
7. Não-gravação não exige videomaker. ✅ (Task 1, superRefine condicional)
8. Eventos antigos pending abrem; editar passa a exigir videomaker. ✅ (Task 4)

---

## Notas

- **Sem migration** — colunas já existem em `origin/main`.
- **Sem `db:types`** — nenhuma coluna nova; os `as any` cobrem o acesso às colunas
  videomaker_* (mesmo padrão de `coord-actions.ts`).
- O fluxo do coordenador (`coord-actions.ts` + dialogs) permanece para reatribuições.
</content>
