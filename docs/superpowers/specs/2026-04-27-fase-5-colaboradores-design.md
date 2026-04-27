# Fase 5 — Colaboradores (Yide Digital) — Design

**Data:** 2026-04-27
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md), seção 5.11
**Fases anteriores:** Fundação, Clientes, Kanban Onboarding, Calendário, Tarefas (todas em produção)

---

## 1. Objetivo

Completar a feature de Colaboradores (RH leve) e estender o sistema de papéis com 4 novos perfis voltados à área audiovisual da Yide Digital: `videomaker`, `designer`, `editor` (produtores) e `audiovisual_chefe` (supervisor). Adiciona filtros, upload de avatar, e ajusta a UI dos clientes para ocultar R$ dos produtores. **Boa parte do colaboradores já existe** no repo (lista, convite, edit, audit log, proteção de campos sensíveis) — esta fase completa o que falta da spec e adiciona os novos papéis.

**Princípios:**
- Permissão mínima: produtores não veem nada de faturamento de cliente
- Papel é informacional + permissão: 3 produtores têm permissões idênticas; o label diferencia para fins de atribuição de tarefa
- Audiovisual Chefe é supervisor (paralelo ao Coordenador): vê R$ + tem comissão sobre carteira da agência
- Avatar opcional, fallback com iniciais
- Sem delete de colaborador — apenas `ativo=false` preserva histórico

**Fora do escopo:**
- Notificação 3 dias antes do aniversário → **Fase 6** (precisa Vercel Cron)
- Bulk import / bulk deactivate / exportar CSV → futuro
- Crop / resize de avatar → v1 só upload direto
- Histórico de mudanças do colaborador como página dedicada → audit_log já registra; visualizar fica pra v2
- Cálculo de comissão do Audiovisual Chefe → Fase 7 (Comissões); aqui só guarda o `%` no perfil

---

## 2. Modelo de dados

### Migration: estender enum `user_role`

Adicionar 4 valores ao enum existente:

```sql
-- supabase/migrations/20260427000010_user_role_extend.sql
alter type public.user_role add value 'videomaker';
alter type public.user_role add value 'designer';
alter type public.user_role add value 'editor';
alter type public.user_role add value 'audiovisual_chefe';
```

Os 5 valores existentes (`adm`, `socio`, `comercial`, `coordenador`, `assessor`) permanecem.

### Tabela `profiles` (existente)

**Sem mudança de schema.** Todos os campos já existem:
- `avatar_url text` (nullable) — vamos popular via UI
- `data_nascimento`, `data_admissao`, `endereco`, `pix`, `telefone`, `fixo_mensal`, `comissao_percent`, `comissao_primeiro_mes_percent`, `role`, `ativo`

### Migration: bucket `avatars` no Supabase Storage

```sql
-- supabase/migrations/20260427000011_avatars_storage.sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio upload any avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));

create policy "anyone read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio update any avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));
```

Path convention: `{user_id}/avatar.{ext}`. Bucket público para leitura — o `avatar_url` em `profiles` carrega a URL pública direta.

---

## 3. Permissões

### Atualização em `src/lib/auth/permissions.ts`

**Type `Role`:**
```ts
export type Role =
  | "adm" | "socio" | "comercial" | "coordenador" | "assessor"
  | "videomaker" | "designer" | "editor" | "audiovisual_chefe";
```

**Matriz — 4 entradas novas:**

```ts
videomaker: [
  "view:all_clients",
  "view:own_commission",
  "create:tasks",
  "create:calendar_event",
  "customize:notification_recipients",
  "feed:satisfaction",
],
designer: [
  // idêntico a videomaker
  "view:all_clients",
  "view:own_commission",
  "create:tasks",
  "create:calendar_event",
  "customize:notification_recipients",
  "feed:satisfaction",
],
editor: [
  // idêntico a videomaker
  "view:all_clients",
  "view:own_commission",
  "create:tasks",
  "create:calendar_event",
  "customize:notification_recipients",
  "feed:satisfaction",
],
audiovisual_chefe: [
  "view:all_clients",
  "view:client_money_all",     // diferença vs produtores: vê R$
  "view:own_commission",
  "create:tasks",
  "create:calendar_event",
  "customize:notification_recipients",
  "feed:satisfaction",
],
```

### Quadro consolidado

| Permissão | Videomaker / Designer / Editor | Audiovisual Chefe |
|---|---|---|
| Ver lista de clientes | ✓ | ✓ |
| Ver R$ / faturamento dos clientes | ✗ | ✓ |
| Editar dados do cliente | ✗ | ✗ |
| Mover kanban onboarding | ✗ | ✗ |
| Alimentar satisfação semanal | ✓ | ✓ |
| Receber/atribuir tarefas | ✓ | ✓ |
| Criar evento no calendário | ✓ | ✓ |
| Customizar destinatários de notificação | ✓ | ✓ |
| Ver comissão própria | ✓ (só fixo) | ✓ (fixo + %) |
| Ver comissão de terceiros | ✗ | ✗ |
| Aprovar fechamento mensal | ✗ | ✗ |
| Ver financeiro consolidado | ✗ | ✗ |
| Manage users / edit colaboradores | ✗ | ✗ |

### Comissão

- **Videomaker / Designer / Editor:** schema transform força `comissao_percent = 0` e `comissao_primeiro_mes_percent = 0` no convite e edit. Recebem só fixo.
- **Audiovisual Chefe:** modelo igual ao Coordenador → `comissao = fixo + (carteira_total_agência × comissao_percent)`. O cálculo concreto será implementado na Fase 7. Aqui apenas guarda o `comissao_percent` no perfil.

---

## 4. Estrutura de arquivos

```
supabase/migrations/
├── 20260427000010_user_role_extend.sql            [NEW]
└── 20260427000011_avatars_storage.sql             [NEW]

src/
├── app/(authed)/colaboradores/
│   ├── page.tsx                                   [MODIFY — montar filtros]
│   ├── novo/page.tsx                              [MODIFY pequena — passar 9 roles]
│   ├── [id]/page.tsx                              [MODIFY — exibir avatar grande]
│   └── [id]/editar/page.tsx                       [MODIFY — render upload]
│
├── components/colaboradores/
│   ├── ColaboradoresTable.tsx                     [MODIFY — coluna avatar + data admissão]
│   ├── ColaboradoresFilters.tsx                   [NEW — client]
│   ├── ColaboradorForm.tsx                        [MODIFY — 9 roles + aviso produtor]
│   ├── ConviteForm.tsx                            [MODIFY — 9 roles]
│   └── AvatarUpload.tsx                           [NEW — client]
│
├── lib/
│   ├── auth/permissions.ts                        [MODIFY — 9 roles + matriz]
│   └── colaboradores/
│       ├── schema.ts                              [MODIFY — ROLES + transform]
│       ├── queries.ts                             [MODIFY — filtros admissão + avatar_url]
│       ├── actions.ts                             [MODIFY — mensagens]
│       └── avatar-actions.ts                      [NEW — uploadAvatarAction]
│
└── types/database.ts                              [REGENERATE após enum extend]

# Telas de cliente — auditar/ajustar para ocultar R$ quando !view:client_money_all:
src/
├── app/(authed)/clientes/
│   ├── page.tsx                                   [AUDIT — ocultar valor mensal se !permission]
│   ├── [id]/page.tsx                              [AUDIT — ocultar bloco financeiro]
│   └── [id]/editar/page.tsx                       [AUDIT — bloquear campo valor]
└── components/clientes/                           [AUDIT — Table, etc.]

tests/
├── unit/
│   ├── colaboradores-schema.test.ts               [NEW — 9 roles + transform produtor]
│   └── colaboradores-queries.test.ts              [NEW — filtros]
└── e2e/
    └── colaboradores.spec.ts                      [NEW — auth-redirect das 4 rotas]
```

---

## 5. Telas e fluxo

### `/colaboradores` (lista — refatorar)

**Header:**
- H1 "Colaboradores"
- Subtítulo: "X ativos · Y inativos"
- Botão "+ Novo colaborador" (visível só pra `manage:users`)

**Filtros (`<ColaboradoresFilters>` novo, client component):**
- **Papel:** Todos / Sócio / ADM / Comercial / Coordenador / Assessor / Audiovisual Chefe / Videomaker / Designer / Editor
- **Status:** Todos / Ativos (default) / Inativos
- **Data de admissão:** Qualquer / Últimos 30 dias / Últimos 90 dias / Últimos 12 meses

URL search params: `?role=&status=&admissao=`. Padrão `TaskFilters` da Fase 4.

**Tabela `<ColaboradoresTable>` (refatorar):**

| Avatar | Nome | Papel | Email | Data admissão | Status | (Fixo, %) gated |
|---|---|---|---|---|---|---|

- Avatar 32px à esquerda do nome (ou iniciais se `avatar_url` vazio)
- Coluna "% Comissão" mostra:
  - `comissao_primeiro_mes_percent` para `comercial`
  - `—` para videomaker/designer/editor
  - `comissao_percent` para os demais

### `/colaboradores/novo` (convite — refatorar `ConviteForm`)

- Form atual aceita: nome, email, role, fixo, %comissão
- **Adicionar 4 novos roles** no `<Select>` de papel
- Aviso visual quando role for produtor (videomaker/designer/editor): "% de comissão não se aplica a este papel — será zerado"

### `/colaboradores/[id]` (detalhe — refatorar)

- **Avatar grande no topo** (96px circular) + iniciais fallback se `avatar_url` for null
- Botão "Trocar foto" abre o `<AvatarUpload>` em modal/inline (visível pra dono OU `edit:colaboradores`)
- Restante da página mantém estrutura atual

### `/colaboradores/[id]/editar` (edit — refatorar)

- **Bloco de avatar no topo do form** (componente `<AvatarUpload>` separado do form de dados — upload é uma ação independente)
- 4 novos roles disponíveis no `<Select>` de papel (visível só se `canEditRole = true`)
- Aviso visual no campo "% Comissão" quando role atual é produtor

### Componente `<AvatarUpload>` (NEW, client)

- Mostra preview da foto atual (ou iniciais)
- `<input type="file" accept="image/jpeg,image/png,image/webp">` com max 2MB
- Botão "Enviar" dispara `uploadAvatarAction(userId, formData)`
- Mostra erro inline se action retornar `{ error }`
- Após sucesso, `router.refresh()` pra puxar novo `avatar_url`

### Outras telas (auditoria pra ocultação de R$)

Auditar e adicionar guard `canAccess(role, "view:client_money_all")` onde aparece valor monetário de cliente:

- `/clientes` lista (`ClientesTable`) — coluna "valor mensal"
- `/clientes/[id]` visão geral — bloco financeiro
- `/clientes/[id]/editar` — campo `valor_mensal` deve ficar disabled/oculto
- Sidebar do cliente — `/clientes/[id]/datas` exibe valores? (verificar)

---

## 6. Server actions e regras de negócio

### `src/lib/colaboradores/schema.ts` (refatorar)

Atualizar `ROLES`:
```ts
export const ROLES = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "videomaker", "designer", "editor", "audiovisual_chefe",
] as const;
```

**Transform que zera % para produtores:**
```ts
const PRODUCERS = ["videomaker", "designer", "editor"] as const;

function zeroPercentForProducers<T extends { role: string; comissao_percent: number; comissao_primeiro_mes_percent: number }>(data: T): T {
  if ((PRODUCERS as readonly string[]).includes(data.role)) {
    return { ...data, comissao_percent: 0, comissao_primeiro_mes_percent: 0 };
  }
  return data;
}

export const inviteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  role: z.enum(ROLES),
  fixo_mensal: z.coerce.number().min(0).default(0),
  comissao_percent: z.coerce.number().min(0).max(100).default(0),
  comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100).default(0),
}).transform(zeroPercentForProducers);

export const editColaboradorSchema = z.object({
  // ... mesmos campos, plus:
}).transform(zeroPercentForProducers);
```

### `src/lib/colaboradores/queries.ts` (refatorar)

```ts
export interface ColaboradorFilters {
  ativo?: boolean;
  role?: string;
  admissionAfter?: string;
}

export async function listColaboradores(filters?: ColaboradorFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao, avatar_url")
    .order("nome");

  if (typeof filters?.ativo === "boolean") query = query.eq("ativo", filters.ativo);
  if (filters?.role) query = query.eq("role", filters.role as Role);
  if (filters?.admissionAfter) query = query.gte("data_admissao", filters.admissionAfter);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
```

`getColaboradorById` já retorna tudo via `select("*")` — sem mudança.

### `src/lib/colaboradores/avatar-actions.ts` (NEW)

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatarAction(targetUserId: string, formData: FormData) {
  const actor = await requireAuth();

  const canEdit = actor.id === targetUserId || canAccess(actor.role, "edit:colaboradores");
  if (!canEdit) return { error: "Sem permissão" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 2MB" };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${targetUserId}/avatar.${ext}`;
  const admin = createServiceRoleClient();

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { error: uploadErr.message };

  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);
  const urlWithBust = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ avatar_url: urlWithBust })
    .eq("id", targetUserId);
  if (updateErr) return { error: updateErr.message };

  await logAudit({
    entidade: "profiles",
    entidade_id: targetUserId,
    acao: "update",
    dados_depois: { avatar_url: urlWithBust },
    ator_id: actor.id,
  });

  revalidatePath(`/colaboradores/${targetUserId}`);
  revalidatePath("/colaboradores");
  return { success: true };
}
```

### `src/lib/colaboradores/actions.ts` (refatorar)

Sem mudança funcional grande — apenas pequenas atualizações de mensagens. O schema transform já cuida de zerar `%` para produtores em `inviteColaboradorAction` e `editColaboradorAction`. O guard atual "Apenas sócio pode definir % de comissão" continua válido (produtor já chega com `% = 0` pelo transform; não-sócio que tentar settar % > 0 ainda é bloqueado pra não-produtor).

---

## 7. Edge cases

| Caso | Comportamento |
|---|---|
| Mudar role de assessor → designer (produtor) | Schema transform zera `comissao_percent`. Audit log registra mudança de role + zeragem do %. |
| Mudar role de produtor → coordenador | Sócio precisa configurar % manualmente. % anterior era 0; permanece 0 até Sócio atualizar. |
| Audiovisual Chefe sem `comissao_percent` definido | `view:own_commission` mostra fixo + 0% (até Sócio configurar). Sem erro. |
| Upload de avatar > 2MB | Bloqueia client-side (input `accept`/check) e server-side. Mensagem: "Máximo 2MB". |
| Upload de avatar com extensão `.gif` | Rejeitado. Mensagem: "Apenas JPEG, PNG ou WebP". |
| Trocar avatar várias vezes | Cache-busting `?v=timestamp` evita exibir foto antiga. |
| Excluir colaborador | **Sem rota de delete.** Toggle `ativo=false` preserva histórico, audit, snapshots. |
| Email duplicado no convite | Supabase Auth rejeita; mensagem propagada do erro original. |
| Editar próprio perfil sendo produtor | Pode editar dados pessoais (nome, telefone, endereço, Pix, data nasc., avatar). Não pode mudar próprio role nem fixo (já bloqueado pelo guard "sensitiveChanged" + role check). |
| Role desconhecido (vinda de DB com valor não reconhecido) | `canAccess` retorna `false` (defesa: matriz lookup retorna `undefined`). |

---

## 8. Testes

### Unit (`tests/unit/`)

**`colaboradores-schema.test.ts` (NEW):**
- Aceita os 9 roles válidos
- Rejeita role inválido (`"foo"`)
- Para `videomaker`, `comissao_percent` enviado > 0 vira 0 após parse (transform)
- Para `videomaker`, `comissao_primeiro_mes_percent` enviado > 0 vira 0
- Para `designer`, mesmo comportamento
- Para `editor`, mesmo comportamento
- Para `audiovisual_chefe`, % é preservado (não zera)
- Para `coordenador`, % é preservado
- Email mal-formado é rejeitado
- Nome com 1 char é rejeitado

**`colaboradores-queries.test.ts` (NEW):**
- Sort default por nome (ascending)
- Filtro `ativo: true` retorna só ativos
- Filtro `role: "videomaker"` retorna só videomakers
- Filtro `admissionAfter: "2026-01-01"` filtra por data
- Combinação de filtros funciona

(Tests vão precisar de `vi.mock("@/lib/supabase/server")` igual `tarefas-queries.test.ts` da Fase 4.)

### E2E (`tests/e2e/colaboradores.spec.ts` NEW)

Auth-redirect das 4 rotas:
- `/colaboradores`
- `/colaboradores/novo`
- `/colaboradores/[id]` (com UUID de teste)
- `/colaboradores/[id]/editar`

---

## 9. Cobertura do spec mãe — seção 5.11 + extensão

| Spec | Coberto por |
|---|---|
| Página acessível pra Sócio/ADM, leitura para todos | `manage:users` (CRUD) + page já tem render geral |
| Lista com filtros: papel, status, data admissão | `<ColaboradoresFilters>` + `listColaboradores(filters)` |
| Cadastro/edição com todos os campos | Já existe; **adicionar avatar** |
| % comissão read-only para todos exceto sócio | Já existe (guard "sensitiveChanged" no action) |
| Avatar | `<AvatarUpload>` + `uploadAvatarAction` + bucket Storage |
| Aniversário gera evento no calendário | **Já funciona desde Fase 3** (read-time de `profiles.data_nascimento`) |
| Notificação 3 dias antes do aniversário | **Fase 6** (Notificações completa) |
| 4 papéis novos (videomaker/designer/editor/audiovisual_chefe) | Migration enum + matriz de permissões + ROLES schema |
| Produtores ocultam R$ dos clientes | Auditoria + guard `view:client_money_all` nas telas de cliente |
| Audiovisual Chefe vê R$ + tem % | Permissão `view:client_money_all` + matriz + form preserva % |

---

## 10. Estimativa

- **~10 commits**
- **2 migrations** (enum extend + storage bucket)
- **2 componentes novos** (`ColaboradoresFilters`, `AvatarUpload`)
- **3 componentes refatorados** (`ColaboradoresTable`, `ColaboradorForm`, `ConviteForm`)
- **1 server action nova** (`uploadAvatarAction`)
- **2 server actions ajustadas** (`inviteColaboradorAction`, `editColaboradorAction` — schema transform)
- **3 arquivos de teste novos** (2 unit + 1 e2e)
- Auditoria de telas de cliente para ocultação de R$ (~3-5 arquivos com guard simples)
- Sem dependências novas

---

## 11. Aprovação

Brainstorming concluído com a usuária em 2026-04-27. Decisões registradas:
- Fase 5 = Colaboradores (5.11) com escopo C (máximo) + 4 papéis novos
- Videomaker / Designer / Editor: idênticos, só fixo, ocultam R$ de clientes
- Audiovisual Chefe: como Coordenador (% sobre carteira agência), vê R$
- Aniversário no calendário já funciona desde Fase 3 — apenas popular `data_nascimento`
- Notificação 3d antes do aniversário fica para Fase 6

Próximo passo: skill `writing-plans` gera o plano detalhado de execução em `docs/superpowers/plans/2026-04-27-fase-5-colaboradores.md`.
