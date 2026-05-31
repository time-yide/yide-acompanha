# Freelayide: Edição + Notificação de Oportunidade + Urgência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o tipo de oportunidade "Edição" ao Freelayide, notificar os cargos que podem pegar uma oportunidade quando ela é criada, e permitir marcar entrega urgente (com prazo) em oportunidades de Edição — com cor e som diferenciados na notificação urgente dentro do app.

**Architecture:** Mudanças em dois subsistemas existentes. **Freelayide** (`src/lib/freela-yide/`, `src/components/freela-yide/`): novo valor de enum `edicao`, colunas `entrega_urgente`/`prazo_entrega`, UI condicional no formulário e badge no card. **Notificações** (`src/lib/notificacoes/`, `public/sw.js`): novo `notification_event` configurável (`freela_nova_oportunidade`), coluna `prioridade` na tabela `notifications`, propagação de prioridade pelo `dispatchNotification` → push, e render/som diferenciado no `NotificationBell`/`NotificationItem`. A criação de oportunidade chama `dispatchNotification` (best-effort).

**Tech Stack:** Next.js (versão customizada — **leia `node_modules/next/dist/docs/` antes de mexer em `unstable_cache`/`revalidateTag`/`revalidatePath`**, as assinaturas diferem do Next.js padrão; ex.: o projeto usa `revalidateTag("notifications", "default")` com 2 args), TypeScript, Zod, Supabase (Postgres + RLS + service-role), Web Push (VAPID), Web Audio API, Vitest.

**Convenções do projeto (memória):**
- Migrations Supabase são **aplicadas manualmente no SQL Editor após o merge do PR** (Vercel não roda migrations). O plano só cria os arquivos `.sql`.
- **Bumpar cache key do `unstable_cache` no MESMO PR** que muda shape de dados.
- **Fallback do SELECT cobre TODA coluna nova** (não aplicável ao freela aqui pois ele não tem catch de fallback whitelisted — confirmar no Task 2).
- Branch já criada a partir de `origin/main`: `feat/freelayide-edicao-urgencia` (worktree `.claude/worktrees/freela-edicao`).
- Após type-check/lint passar → commit + PR direto (sem subir dev server).

---

## Task 1: Tipo "Edição" no Freelayide

**Files:**
- Modify: `src/lib/freela-yide/tipos.ts` (TIPO_OP + TIPO_OP_DEFS)
- Modify: `src/lib/freela-yide/schema.ts` (enum do `tipo`)
- Modify: `src/components/freela-yide/NovaOportunidadeButton.tsx` (option no select)
- Create: `supabase/migrations/20260618000000_freelayide_edicao_tipo.sql`
- Test: `tests/unit/freelayide-tipos.test.ts`

- [ ] **Step 1: Escrever teste que falha**

Create `tests/unit/freelayide-tipos.test.ts`:

```typescript
// tests/unit/freelayide-tipos.test.ts
import { describe, it, expect } from "vitest";
import { TIPO_OP, TIPO_OP_DEFS } from "@/lib/freela-yide/tipos";
import { criarOportunidadeSchema } from "@/lib/freela-yide/schema";

describe("tipo Edição", () => {
  it("edicao está em TIPO_OP", () => {
    expect(TIPO_OP).toContain("edicao");
  });
  it("edicao tem label e cor", () => {
    expect(TIPO_OP_DEFS.edicao.label).toBe("Edição");
    expect(TIPO_OP_DEFS.edicao.color).toMatch(/orange/);
  });
  it("schema aceita tipo edicao", () => {
    const r = criarOportunidadeSchema.safeParse({ titulo: "Edição reels", valor_comissao: 100, tipo: "edicao" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/unit/freelayide-tipos.test.ts`
Expected: FAIL (`edicao` não existe em `TIPO_OP_DEFS`, schema rejeita `edicao`).

- [ ] **Step 3: Adicionar `edicao` em tipos.ts**

Em `src/lib/freela-yide/tipos.ts`, trocar o bloco `TIPO_OP`:

```typescript
export const TIPO_OP = ["captacao", "modelo", "edicao"] as const;
export type TipoOp = (typeof TIPO_OP)[number];
export const TIPO_OP_DEFS: Record<TipoOp, { label: string; color: string }> = {
  captacao: { label: "Captação", color: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  modelo:   { label: "Modelo",   color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" },
  edicao:   { label: "Edição",   color: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-300" },
};
```

- [ ] **Step 4: Atualizar o enum no schema.ts**

Em `src/lib/freela-yide/schema.ts`, trocar a linha do `tipo`:

```typescript
  tipo: z.enum(["captacao", "modelo", "edicao"]).default("captacao"),
```

- [ ] **Step 5: Adicionar a option no formulário**

Em `src/components/freela-yide/NovaOportunidadeButton.tsx`, no `<select id="tipo" ...>`, adicionar a terceira option:

```tsx
                <option value="captacao">Captação</option>
                <option value="modelo">Modelo</option>
                <option value="edicao">Edição</option>
```

- [ ] **Step 6: Criar a migration do check de `tipo`**

Create `supabase/migrations/20260618000000_freelayide_edicao_tipo.sql`:

```sql
-- supabase/migrations/20260618000000_freelayide_edicao_tipo.sql
-- Adiciona o tipo 'edicao' às oportunidades do Freelayide.
-- O check da coluna `tipo` foi criado inline na 20260616000000_freelayide_tipo.sql
-- com nome auto-gerado freela_oportunidades_tipo_check.

alter table public.freela_oportunidades
  drop constraint if exists freela_oportunidades_tipo_check;

alter table public.freela_oportunidades
  add constraint freela_oportunidades_tipo_check
  check (tipo in ('captacao', 'modelo', 'edicao'));
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/unit/freelayide-tipos.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 8: Commit**

```bash
git add src/lib/freela-yide/tipos.ts src/lib/freela-yide/schema.ts src/components/freela-yide/NovaOportunidadeButton.tsx supabase/migrations/20260618000000_freelayide_edicao_tipo.sql tests/unit/freelayide-tipos.test.ts
git commit -m "feat(freelayide): adiciona tipo Edição

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Campos de urgência de entrega (só em Edição)

**Files:**
- Modify: `src/lib/freela-yide/schema.ts` (campos + helper `normalizeUrgencia`)
- Modify: `src/lib/freela-yide/queries.ts` (SELECT, OportunidadeRow, mapRow)
- Modify: `src/components/freela-yide/NovaOportunidadeButton.tsx` (UI condicional)
- Modify: `src/components/freela-yide/OportunidadeCard.tsx` (badge urgente + prazo)
- Create: `supabase/migrations/20260618000100_freelayide_urgencia.sql`
- Test: `tests/unit/freelayide-urgencia.test.ts`

- [ ] **Step 1: Escrever teste que falha (helper de normalização)**

Create `tests/unit/freelayide-urgencia.test.ts`:

```typescript
// tests/unit/freelayide-urgencia.test.ts
import { describe, it, expect } from "vitest";
import { normalizeUrgencia } from "@/lib/freela-yide/schema";

describe("normalizeUrgencia", () => {
  it("zera urgência quando tipo não é edicao", () => {
    expect(normalizeUrgencia("captacao", true, "2026-06-20T14:00")).toEqual({
      entrega_urgente: false,
      prazo_entrega: null,
    });
  });
  it("mantém urgência quando tipo é edicao", () => {
    expect(normalizeUrgencia("edicao", true, "2026-06-20T14:00")).toEqual({
      entrega_urgente: true,
      prazo_entrega: "2026-06-20T14:00",
    });
  });
  it("edicao sem urgência marca false e prazo null", () => {
    expect(normalizeUrgencia("edicao", false, null)).toEqual({
      entrega_urgente: false,
      prazo_entrega: null,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/unit/freelayide-urgencia.test.ts`
Expected: FAIL (`normalizeUrgencia` não existe).

- [ ] **Step 3: Adicionar campos + helper em schema.ts**

Em `src/lib/freela-yide/schema.ts`, atualizar `criarOportunidadeSchema` e adicionar o helper + tipos. **Nota:** o import já é `import { STATUS_OP, TIPO_OP } from "./tipos";` (Task 1 já adicionou `TIPO_OP`). Substituir o bloco do schema por (mantendo `z.enum(TIPO_OP)`, NÃO voltar para literais):

```typescript
export const criarOportunidadeSchema = z.object({
  titulo: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(2000).optional().nullable(),
  cliente_nome: z.string().trim().max(160).optional().nullable(),
  contato: z.string().trim().max(160).optional().nullable(),
  horario: z.string().trim().max(120).optional().nullable(),
  valor_comissao: z.coerce.number().min(0).max(1_000_000),
  tipo: z.enum(TIPO_OP).default("captacao"),
  entrega_urgente: z.coerce.boolean().default(false),
  prazo_entrega: z.string().trim().max(40).optional().nullable(),
});
```

E adicionar no fim do arquivo (antes do `export type CriarOportunidadeInput`):

```typescript
/**
 * Urgência só vale para o tipo "edicao". Para qualquer outro tipo, zera
 * `entrega_urgente` e `prazo_entrega` no servidor (não confiar só no front).
 */
export function normalizeUrgencia(
  tipo: string,
  entrega_urgente: boolean,
  prazo_entrega: string | null,
): { entrega_urgente: boolean; prazo_entrega: string | null } {
  if (tipo !== "edicao") return { entrega_urgente: false, prazo_entrega: null };
  return {
    entrega_urgente: !!entrega_urgente,
    prazo_entrega: entrega_urgente ? (prazo_entrega ?? null) : null,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/unit/freelayide-urgencia.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Criar a migration das colunas**

Create `supabase/migrations/20260618000100_freelayide_urgencia.sql`:

```sql
-- supabase/migrations/20260618000100_freelayide_urgencia.sql
-- Urgência de entrega para oportunidades de Edição.
alter table public.freela_oportunidades
  add column if not exists entrega_urgente boolean not null default false,
  add column if not exists prazo_entrega timestamptz;
```

- [ ] **Step 6: Incluir as colunas nas queries (SELECT + row + map)**

Em `src/lib/freela-yide/queries.ts`:

(a) Adicionar à interface `OportunidadeRow` (depois de `tipo: TipoOp;`):

```typescript
  entrega_urgente: boolean;
  prazo_entrega: string | null;
```

(b) Adicionar ao `SELECT` (incluir as colunas novas):

```typescript
const SELECT =
  "id, titulo, descricao, cliente_nome, contato, horario, valor_comissao, status, tipo, entrega_urgente, prazo_entrega, pego_por, pego_em, negociacao_em, fechada_em, created_at, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)";
```

(c) No `mapRow`, dentro do objeto `base` (depois de `tipo: ...`):

```typescript
    entrega_urgente: Boolean(row.entrega_urgente ?? false),
    prazo_entrega: (row.prazo_entrega as string | null) ?? null,
```

> Nota: `listOportunidades`/`listMinhas` retornam `[]` em erro (não há catch com whitelist de colunas), então não há risco de "esvaziar lista" por coluna faltante — mas a migration deve ser aplicada antes do deploy, ou o SELECT falha. Como migrations são manuais pós-merge, **aplicar a migration imediatamente após o merge** (igual ao histórico do freela).

- [ ] **Step 7: UI condicional no formulário**

Em `src/components/freela-yide/NovaOportunidadeButton.tsx`:

(a) Adicionar estado do tipo. Logo após `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [tipo, setTipo] = useState("captacao");
```

(b) Tornar o select controlado (trocar `defaultValue="captacao"` por `value`/`onChange`):

```tsx
              <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 w-full rounded-md border bg-card px-2 text-sm">
                <option value="captacao">Captação</option>
                <option value="modelo">Modelo</option>
                <option value="edicao">Edição</option>
              </select>
```

(c) Adicionar o bloco de urgência logo ANTES do campo de descrição (o `<div>` do `descricao`), renderizado só quando `tipo === "edicao"`:

```tsx
            {tipo === "edicao" && (
              <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="entrega_urgente" className="h-4 w-4 accent-orange-500" />
                  Entrega urgente
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="prazo_entrega">Prazo de entrega</Label>
                  <Input id="prazo_entrega" name="prazo_entrega" type="datetime-local" />
                </div>
              </div>
            )}
```

- [ ] **Step 8: Badge urgente + prazo no card**

Em `src/components/freela-yide/OportunidadeCard.tsx`:

(a) Adicionar um helper de formatação de prazo no topo do arquivo (depois dos imports):

```tsx
function fmtPrazo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
```

(b) Dentro do `<div className="flex shrink-0 items-center gap-1">` (onde ficam os badges de tipo/status), adicionar o badge urgente ANTES do badge de tipo:

```tsx
          {op.entrega_urgente && (
            <span className="flex items-center gap-0.5 rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
              <Flame className="h-3 w-3" /> Urgente
            </span>
          )}
```

(c) Mostrar o prazo logo abaixo do `horario` (dentro do `<div className="min-w-0">`, depois do bloco do `op.horario`):

```tsx
          {op.prazo_entrega && (
            <p className={`flex items-center gap-1 truncate text-xs ${op.entrega_urgente ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              <Clock className="h-3 w-3 shrink-0" />Prazo: {fmtPrazo(op.prazo_entrega)}
            </p>
          )}
```

- [ ] **Step 9: Type-check + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: sem erros nos arquivos tocados.

- [ ] **Step 10: Commit**

```bash
git add src/lib/freela-yide/schema.ts src/lib/freela-yide/queries.ts src/components/freela-yide/NovaOportunidadeButton.tsx src/components/freela-yide/OportunidadeCard.tsx supabase/migrations/20260618000100_freelayide_urgencia.sql tests/unit/freelayide-urgencia.test.ts
git commit -m "feat(freelayide): urgência de entrega em oportunidades de Edição

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Evento de notificação `freela_nova_oportunidade`

**Files:**
- Create: `supabase/migrations/20260618000200_notification_event_freela.sql` (add value — migration isolada)
- Create: `supabase/migrations/20260618000300_notification_rules_freela_seed.sql` (seed da rule)
- Modify: `src/types/database.ts` (enum `notification_event` em 2 lugares)

> **Por que 2 migrations:** Postgres não permite usar um valor de enum recém-adicionado na mesma transação em que ele foi criado (`alter type ... add value`). O `insert` na `notification_rules` que referencia `'freela_nova_oportunidade'` precisa rodar numa migration separada (segue o precedente de `20260429000023`/`20260429000024`).

- [ ] **Step 1: Migration que adiciona o valor ao enum**

Create `supabase/migrations/20260618000200_notification_event_freela.sql`:

```sql
-- supabase/migrations/20260618000200_notification_event_freela.sql
-- Novo evento de notificação: nova oportunidade no Freelayide.
alter type public.notification_event add value if not exists 'freela_nova_oportunidade';
```

- [ ] **Step 2: Migration que semeia a rule**

Create `supabase/migrations/20260618000300_notification_rules_freela_seed.sql`:

```sql
-- supabase/migrations/20260618000300_notification_rules_freela_seed.sql
-- Rule default do evento freela_nova_oportunidade: notifica assessores,
-- videomakers e o coordenador audiovisual (audiovisual_chefe). Configurável
-- depois em Configurações → Notificações (admin pode incluir editores etc).
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_nova_oportunidade', true, false, false,
  true, ARRAY['assessor', 'videomaker', 'audiovisual_chefe']::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
```

- [ ] **Step 3: Adicionar o valor ao tipo `notification_event` (union) em database.ts**

Em `src/types/database.ts`, no bloco `notification_event:` que começa na linha ~2658, adicionar após `| "task_alteracao_solicitada"`:

```typescript
        | "freela_nova_oportunidade"
```

- [ ] **Step 4: Adicionar o valor ao array runtime em database.ts**

Em `src/types/database.ts`, no array `notification_event: [` que começa na linha ~2901, adicionar após `"task_alteracao_solicitada",`:

```typescript
        "freela_nova_oportunidade",
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros (o valor novo agora é reconhecido pelo tipo `NotificationEvent`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260618000200_notification_event_freela.sql supabase/migrations/20260618000300_notification_rules_freela_seed.sql src/types/database.ts
git commit -m "feat(notificacoes): evento freela_nova_oportunidade + rule default

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Prioridade na notificação (coluna + dispatch + push + service worker)

**Files:**
- Create: `supabase/migrations/20260618000400_notifications_prioridade.sql`
- Modify: `src/lib/notificacoes/dispatch.ts` (param `prioridade`, insert, push payload)
- Modify: `src/lib/push/server.ts` (PushPayload + `urgent`)
- Modify: `public/sw.js` (render urgente: vibrate + requireInteraction + versão)

- [ ] **Step 1: Migration da coluna `prioridade`**

Create `supabase/migrations/20260618000400_notifications_prioridade.sql`:

```sql
-- supabase/migrations/20260618000400_notifications_prioridade.sql
-- Prioridade da notificação. 'urgente' dispara cor/som diferenciados no app
-- e vibração/requireInteraction no push.
alter table public.notifications
  add column if not exists prioridade text not null default 'normal'
    check (prioridade in ('normal', 'urgente'));
```

- [ ] **Step 2: Adicionar `urgent` ao PushPayload**

Em `src/lib/push/server.ts`, atualizar a interface `PushPayload`:

```typescript
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
}
```

(Nenhuma outra mudança em `server.ts`: o `payload` já é serializado inteiro via `JSON.stringify(payload)`, então `urgent` chega ao service worker automaticamente.)

- [ ] **Step 3: Threading de `prioridade` no dispatch**

Em `src/lib/notificacoes/dispatch.ts`:

(a) Adicionar ao `interface DispatchArgs` (depois de `source_user_id?: string;`):

```typescript
  prioridade?: "normal" | "urgente";
```

(b) No insert do in-app (`supabase.from("notifications").insert({...})`), adicionar o campo:

```typescript
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        tipo: args.evento_tipo,
        titulo: args.titulo,
        mensagem: args.mensagem,
        link: args.link ?? null,
        prioridade: args.prioridade ?? "normal",
      });
```

(c) Na chamada do `sendWebPushToUser`, propagar `urgent`:

```typescript
        await sendWebPushToUser(userId, {
          title: args.titulo,
          body: args.mensagem,
          url: args.link ?? "/",
          tag: args.evento_tipo,
          urgent: args.prioridade === "urgente",
        });
```

- [ ] **Step 4: Render urgente no service worker**

Em `public/sw.js`:

(a) Bumpar a versão:

```javascript
const SW_VERSION = "v1.3.0";
```

(b) No handler de `push`, trocar o objeto `options` para considerar `payload.urgent`:

```javascript
  const title = payload.title || "Yide";
  const urgent = payload.urgent === true;
  const options = {
    body: payload.body || "",
    icon: "/brand/logo-yide.png",
    badge: "/brand/logo-yide.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/" },
    requireInteraction: urgent,
    vibrate: urgent ? [200, 100, 200, 100, 200] : undefined,
  };
```

> Nota: som customizado de push **não é suportável** no navegador (controlado pelo iOS/Android). `vibrate` + `requireInteraction` são a diferenciação possível no push.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260618000400_notifications_prioridade.sql src/lib/notificacoes/dispatch.ts src/lib/push/server.ts public/sw.js
git commit -m "feat(notificacoes): prioridade urgente (coluna + dispatch + push + SW)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Cor + som diferenciados dentro do app

**Files:**
- Modify: `src/lib/escritorio/notification-sound.ts` (novo `playUrgentSound`)
- Modify: `src/lib/notificacoes/queries.ts` (selecionar `prioridade` + bump cache key)
- Modify: `src/lib/notificacoes/schema.ts` (campo `prioridade` no tipo Notification)
- Modify: `src/components/notificacoes/NotificationItem.tsx` (prop + estilo vermelho)
- Modify: `src/components/notificacoes/NotificationBell.tsx` (prioridade no Item + som no INSERT)

- [ ] **Step 1: Adicionar `playUrgentSound` ao notification-sound.ts**

Em `src/lib/escritorio/notification-sound.ts`, adicionar uma função exportada que reusa o mesmo AudioContext/unlock. Adicionar depois de `playOnContext`:

```typescript
// Som de alarme urgente: 3 beeps curtos em frequência mais grave/insistente,
// distinto do "ding" suave do playNotificationSound. Reusa o mesmo ctx.
function playUrgentOnContext(ctx: AudioContext) {
  const now = ctx.currentTime;
  const beeps = [0, 0.22, 0.44];
  for (const offset of beeps) {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(620, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

export function playUrgentSound(): void {
  ensureUnlockBinding();
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      ctx.resume().then(() => playUrgentOnContext(ctx)).catch(() => {});
      return;
    }
    playUrgentOnContext(ctx);
  } catch {
    // silencia falhas isoladas
  }
}
```

- [ ] **Step 2: Selecionar `prioridade` nas queries + bump cache key**

Em `src/lib/notificacoes/queries.ts`:

(a) No `_listMyNotificationsImpl`, adicionar `prioridade` ao `.select(...)`:

```typescript
    .select("id, user_id, tipo, titulo, mensagem, link, lida, created_at, prioridade")
```

(b) Bumpar a cache key do `unstable_cache` em `listMyNotifications` (shape mudou — convenção do projeto). Trocar a key:

```typescript
    ["notifications-list-v2"],
```

> Não precisa bumpar a key de `countMyUnread` (não mudou shape — só conta).

- [ ] **Step 3: Adicionar `prioridade` ao tipo Notification**

Em `src/lib/notificacoes/schema.ts`, no `interface Notification`, adicionar (depois de `lida: boolean;`):

```typescript
  prioridade: "normal" | "urgente";
```

- [ ] **Step 4: Render vermelho no NotificationItem**

Em `src/components/notificacoes/NotificationItem.tsx`:

(a) Adicionar à `interface Props` (depois de `created_at: string;`):

```typescript
  prioridade?: "normal" | "urgente";
```

(b) Atualizar a assinatura do componente e o estilo do `content`:

```tsx
export function NotificationItem({ id, titulo, mensagem, link, lida, created_at, prioridade }: Props) {
  async function markRead() {
    if (lida) return;
    const fd = new FormData();
    fd.set("id", id);
    await markNotificationReadAction(fd);
  }

  const urgente = prioridade === "urgente";
  const content = (
    <div className={`flex items-start gap-2 rounded-md border p-2 ${urgente ? "border-red-500/50 bg-red-500/10" : "border-transparent"} ${lida ? "" : urgente ? "" : "bg-primary/5"}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${urgente ? "text-red-600 dark:text-red-400" : ""}`}>{titulo}</div>
        <div className="text-[11px] text-muted-foreground line-clamp-2">{mensagem}</div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(created_at)}</span>
    </div>
  );
```

(O restante da função — os `return` com `Link`/`button` — fica igual.)

- [ ] **Step 5: Passar `prioridade` e tocar som no NotificationBell**

Em `src/components/notificacoes/NotificationBell.tsx`:

(a) Importar o som no topo (depois dos imports existentes):

```typescript
import { playUrgentSound } from "@/lib/escritorio/notification-sound";
```

(b) Adicionar `prioridade` à `interface Item` (depois de `lida: boolean;`):

```typescript
  prioridade?: "normal" | "urgente";
```

(c) No handler do Realtime, distinguir INSERT e tocar som quando urgente. Trocar o `.on("postgres_changes", {...}, () => { void fetchData(); })` por:

```typescript
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (
              payload.eventType === "INSERT" &&
              (payload.new as { prioridade?: string } | null)?.prioridade === "urgente"
            ) {
              playUrgentSound();
            }
            void fetchData();
          },
        )
```

(d) No `.map` que renderiza os itens, o spread `{...it}` já repassa `prioridade` para `NotificationItem` — nenhuma mudança extra ali, desde que `getMyNotificationsAction` retorne o campo (vem do tipo `Notification` via Task 5 Step 2/3).

- [ ] **Step 6: Type-check + lint + testes**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/lib/escritorio/notification-sound.ts src/lib/notificacoes/queries.ts src/lib/notificacoes/schema.ts src/components/notificacoes/NotificationItem.tsx src/components/notificacoes/NotificationBell.tsx
git commit -m "feat(notificacoes): cor + som de alarme para notificação urgente no app

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Disparar a notificação ao criar oportunidade

**Files:**
- Modify: `src/lib/freela-yide/actions.ts` (insert dos campos + chamada do dispatch)

- [ ] **Step 1: Importar dispatch + helper de urgência**

Em `src/lib/freela-yide/actions.ts`, adicionar aos imports do topo:

```typescript
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { criarOportunidadeSchema, moverStatusSchema, definirMetaSchema, normalizeUrgencia } from "./schema";
```

(Substitui o import existente de `./schema` — não duplicar.)

- [ ] **Step 2: Ler os campos de urgência no parse**

Em `criarOportunidadeAction`, dentro do `criarOportunidadeSchema.safeParse({...})`, adicionar após `tipo:`:

```typescript
    tipo: fd(formData, "tipo") ?? "captacao",
    entrega_urgente: formData.get("entrega_urgente") === "on",
    prazo_entrega: fd(formData, "prazo_entrega"),
```

- [ ] **Step 3: Normalizar urgência e inserir os campos novos**

Em `criarOportunidadeAction`, logo após `if (!orgId) return { error: "Organização não encontrada" };`, normalizar:

```typescript
  const urg = normalizeUrgencia(parsed.data.tipo, parsed.data.entrega_urgente, parsed.data.prazo_entrega ?? null);
```

E no objeto do `.insert({...})`, adicionar (depois de `tipo: parsed.data.tipo,`). **Converter o `datetime-local` (timezone-naive, ex. `"2026-06-20T14:00"`) para UTC ISO antes de gravar no `timestamptz`**, senão o Postgres interpreta no timezone da sessão (UTC no Supabase) e o horário fica 3h adiantado pro usuário no Brasil:

```typescript
    entrega_urgente: urg.entrega_urgente,
    prazo_entrega: urg.prazo_entrega ? new Date(urg.prazo_entrega).toISOString() : null,
```

- [ ] **Step 4: Disparar a notificação após o insert (best-effort)**

Em `criarOportunidadeAction`, depois de `if (error) return { error: error.message };` e ANTES de `revalidatePath("/freela-yide");`, adicionar:

```typescript
  // Notifica quem pode pegar a oportunidade. Best-effort: falha de
  // notificação não invalida a criação. Urgente → prioridade alta (cor/som).
  const tipoLabel = parsed.data.tipo === "edicao" ? "Edição" : parsed.data.tipo === "modelo" ? "Modelo" : "Captação";
  const clienteSuffix = parsed.data.cliente_nome ? ` (${parsed.data.cliente_nome})` : "";
  try {
    await dispatchNotification({
      evento_tipo: "freela_nova_oportunidade",
      // Sem emoji/em-dash no texto (convenção do projeto: UI sem emoji e sem "—").
      titulo: urg.entrega_urgente ? `URGENTE - Edição: ${parsed.data.titulo}` : `Nova oportunidade (${tipoLabel}): ${parsed.data.titulo}`,
      mensagem: `${tipoLabel}${clienteSuffix}. R$ ${parsed.data.valor_comissao.toLocaleString("pt-BR")}. Abra o Freelayide para pegar.`,
      link: "/freela-yide",
      source_user_id: actor.id,
      prioridade: urg.entrega_urgente ? "urgente" : "normal",
    });
  } catch (e) {
    console.error("[freelayide] dispatch nova oportunidade falhou:", e);
  }
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: sem erros.

- [ ] **Step 6: Suite completa de testes**

Run: `npx vitest run`
Expected: todos passam (incluindo `freelayide-tipos`, `freelayide-urgencia`, `freelayide-pontos`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/freela-yide/actions.ts
git commit -m "feat(freelayide): notifica cargos ao criar oportunidade (urgente = prioridade alta)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR

- [ ] **Step 1: Type-check, lint e testes completos**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: tudo verde.

- [ ] **Step 2: Build (confiança extra antes do PR)**

Run: `npx next build`
Expected: build conclui sem erro.

- [ ] **Step 3: Abrir o PR**

```bash
git push -u origin feat/freelayide-edicao-urgencia
gh pr create --base main --title "feat(freelayide): tipo Edição + notificação de oportunidade + urgência" --body "$(cat <<'EOF'
## O que muda

- **Novo tipo "Edição"** nas oportunidades do Freelayide (além de Captação/Modelo).
- **Notificação ao criar oportunidade** para assessores, videomakers e coordenador audiovisual (configurável em Configurações → Notificações).
- **Urgência de entrega** (checkbox + prazo) nas oportunidades de Edição.
- **Notificação urgente diferenciada**: dentro do app, cor vermelha + som de alarme; no push, vibração + notificação fixa (som do push é controlado pelo SO).

## Migrations (aplicar manualmente no SQL Editor APÓS o merge, nesta ordem)

1. `20260618000000_freelayide_edicao_tipo.sql`
2. `20260618000100_freelayide_urgencia.sql`
3. `20260618000200_notification_event_freela.sql`
4. `20260618000300_notification_rules_freela_seed.sql`
5. `20260618000400_notifications_prioridade.sql`

> A `...000200` e a `...000300` são separadas de propósito (Postgres não deixa usar valor de enum novo na mesma transação). Rode a `000200`, confirme, depois a `000300`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas de implementação / riscos

- **Ordem das migrations:** aplicar manualmente no SQL Editor após o merge, na ordem dos timestamps. `notification_event` (`...000200`) **antes** do seed da rule (`...000300`).
- **`database.ts` está fora de sincronia** com migrations antigas (faltam `instagram_meta_offtrack` etc.). Só adicionamos o valor que precisamos (`freela_nova_oportunidade`) — não regenerar o arquivo inteiro neste PR para não inflar o diff.
- **Som in-app só toca com o app aberto** e após o primeiro gesto do usuário na página (limitação de autoplay dos navegadores — já tratada pelo unlock do `notification-sound.ts`).
- **Cache key bump** feito em `listMyNotifications` (`notifications-list` → `notifications-list-v2`) porque o shape ganhou `prioridade`.
- **Next.js customizado:** antes de mexer em `unstable_cache`/`revalidateTag`/`revalidatePath`, conferir `node_modules/next/dist/docs/` (assinaturas diferentes — ex.: `revalidateTag("notifications", "default")`).
- **Editores não recebem** a notificação por padrão (decisão da usuária). Como a rule é configurável, dá pra incluir depois sem código.
