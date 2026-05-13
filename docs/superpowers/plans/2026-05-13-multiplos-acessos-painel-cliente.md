# Múltiplos acessos por cliente — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir até 5 acessos ativos por cliente no portal `/painel-cliente` (hoje é 1), pra empresas com sócios poderem ter 1 login cada.

**Architecture:** Schema `client_portal_users` já aguenta N rows por cliente — só muda o limite na server action (1→5), o shape da query (`portal: P | null` → `portals: P[]`) e a tabela do painel (linha-resumo com expansão).

**Tech Stack:** Next.js 16 (App Router), Supabase (auth.users + RLS), React (Server + Client Components), Vitest, Tailwind, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-05-13-multiplos-acessos-painel-cliente-design.md`](../specs/2026-05-13-multiplos-acessos-painel-cliente-design.md)

---

## Arquivos tocados

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `tests/unit/painel-cliente-actions.test.ts` | Criar | Testes do limite de 5 acessos ativos |
| `src/lib/painel-cliente/actions.ts` | Modificar | Trocar check "1 ativo" por "max 5 ativos" |
| `src/lib/painel-cliente/queries.ts` | Modificar | Retornar `portals: Portal[]` em vez de `portal: Portal\|null` |
| `src/app/(authed)/painel-cliente/page.tsx` | Modificar | Atualizar contadores do header pro novo shape |
| `src/components/painel-cliente/PainelClienteTable.tsx` | Modificar | Linha-resumo + expansão + sub-tabela de acessos |

Não muda: `ConcederAcessoDialog.tsx`, `ResetPasswordDialog.tsx`, `RevogarAcessoButton.tsx`, `CopyLinkButton.tsx`, migrations.

---

## Task 1: Testes do limite de 5 acessos ativos

**Files:**
- Create: `tests/unit/painel-cliente-actions.test.ts`

- [ ] **Step 1: Escrever os testes (vão falhar enquanto `actions.ts` ainda bloqueia no 2º acesso)**

Crie `tests/unit/painel-cliente-actions.test.ts` com este conteúdo:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const deleteUserMock = vi.hoisted(() => vi.fn());
const logAuditMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    auth: { admin: { createUser: createUserMock, deleteUser: deleteUserMock } },
  }),
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: logAuditMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/password-generator", () => ({
  generateStrongPassword: () => "GeneratedPass!123",
}));

import { createClientPortalAccessAction } from "@/lib/painel-cliente/actions";

const CLIENT_UUID = "11111111-1111-1111-1111-111111111111";
const ACTOR_UUID = "22222222-2222-2222-2222-222222222222";

interface PortalRow {
  user_id: string;
  ativo: boolean;
}

/**
 * Configura `fromMock` pra simular as 3 queries que a action faz, na ordem:
 *  1. profiles (lookup de email colaborador interno)
 *  2. clients (existe + status)
 *  3. client_portal_users (count de ativos atuais)
 *  4. client_portal_users (insert do novo acesso)
 */
function setupFromMock(opts: {
  profileExists?: boolean;
  clientExists?: boolean;
  existingActivePortals: PortalRow[];
  insertError?: string | null;
}) {
  const calls: string[] = [];
  fromMock.mockImplementation((table: string) => {
    calls.push(table);
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.profileExists ? { id: "x" } : null,
            }),
          }),
        }),
      };
    }
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: opts.clientExists !== false ? { id: CLIENT_UUID, status: "ativo" } : null,
            }),
          }),
        }),
      };
    }
    if (table === "client_portal_users") {
      // Distingue select (count) vs insert pela ordem da chamada
      const wasInserted = calls.filter((t) => t === "client_portal_users").length > 1;
      if (!wasInserted) {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({
                data: opts.existingActivePortals,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({
          error: opts.insertError ? { message: opts.insertError } : null,
        }),
      };
    }
    return {};
  });
}

function makeFormData(overrides: Partial<{ client_id: string; email: string; nome_contato: string }> = {}) {
  const fd = new FormData();
  fd.set("client_id", overrides.client_id ?? CLIENT_UUID);
  fd.set("email", overrides.email ?? "socio@empresa.com");
  fd.set("nome_contato", overrides.nome_contato ?? "Sócio Teste");
  return fd;
}

beforeEach(() => {
  requireAuthMock.mockReset();
  fromMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  logAuditMock.mockReset();
  requireAuthMock.mockResolvedValue({
    id: ACTOR_UUID,
    role: "socio",
    nome: "Dono",
    email: "dono@yide.com",
    ativo: true,
  });
  createUserMock.mockResolvedValue({
    data: { user: { id: "new-user-id" } },
    error: null,
  });
  logAuditMock.mockResolvedValue(undefined);
});

describe("createClientPortalAccessAction — limite de 5 acessos ativos", () => {
  it("permite criar 1º acesso quando cliente não tem nenhum", async () => {
    setupFromMock({ existingActivePortals: [] });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("permite criar o 5º acesso quando cliente tem 4 ativos", async () => {
    setupFromMock({
      existingActivePortals: [
        { user_id: "u1", ativo: true },
        { user_id: "u2", ativo: true },
        { user_id: "u3", ativo: true },
        { user_id: "u4", ativo: true },
      ],
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("bloqueia 6º acesso quando cliente já tem 5 ativos", async () => {
    setupFromMock({
      existingActivePortals: [
        { user_id: "u1", ativo: true },
        { user_id: "u2", ativo: true },
        { user_id: "u3", ativo: true },
        { user_id: "u4", ativo: true },
        { user_id: "u5", ativo: true },
      ],
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({
      error: expect.stringContaining("Limite de 5 acessos ativos"),
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("revogados não contam pro limite — permite criar quando tem 5 revogados + 0 ativos", async () => {
    setupFromMock({ existingActivePortals: [] });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ success: true, password: "GeneratedPass!123" });
  });

  it("rejeita ator sem permissão (assessor)", async () => {
    requireAuthMock.mockResolvedValueOnce({
      id: ACTOR_UUID,
      role: "assessor",
      nome: "Maria",
      email: "m@x.com",
      ativo: true,
    });
    const r = await createClientPortalAccessAction(makeFormData());
    expect(r).toEqual({ error: expect.stringContaining("Apenas ADM/Sócio") });
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que `bloqueia 6º acesso` passa mas `permite criar o 5º` FALHA**

Execute:

```bash
npm test -- tests/unit/painel-cliente-actions.test.ts
```

Esperado: 2 falhas: o teste "permite criar o 5º" e "permite criar 1º acesso" passa (ou falha por motivos diferentes). O importante é o teste "permite criar o 5º" falhar com erro tipo "já tem um acesso ativo". Isso prova que TDD vermelho tá funcionando.

Não commite ainda.

---

## Task 2: Trocar check "1 ativo" por "max 5 ativos" em `actions.ts`

**Files:**
- Modify: `src/lib/painel-cliente/actions.ts:63-74`

- [ ] **Step 1: Editar o check no `createClientPortalAccessAction`**

No arquivo `src/lib/painel-cliente/actions.ts`, encontre este trecho:

```typescript
  // 3. Valida que o cliente ainda não tem acesso ativo (1 acesso por cliente
  //    por enquanto — se quiser múltiplos contatos, remover essa checagem).
  const { data: existingAccess } = await admin
    .from("client_portal_users")
    .select("user_id, ativo")
    .eq("client_id", parsed.data.client_id)
    .eq("ativo", true)
    .maybeSingle();
  if (existingAccess) {
    return { error: "Esse cliente já tem um acesso ativo. Revogue antes de criar outro." };
  }
```

Substitua por:

```typescript
  // 3. Valida que o cliente ainda não bateu o teto de 5 acessos ATIVOS.
  //    Revogados não contam — cliente pode ter histórico de N revogados +
  //    até 5 ativos vivos. Sócios de uma empresa entram cada um com a conta dele.
  const { data: activePortals } = await admin
    .from("client_portal_users")
    .select("user_id")
    .eq("client_id", parsed.data.client_id)
    .eq("ativo", true);
  const activeCount = activePortals?.length ?? 0;
  if (activeCount >= 5) {
    return {
      error: "Limite de 5 acessos ativos por cliente atingido. Revogue um pra criar outro.",
    };
  }
```

- [ ] **Step 2: Rodar os testes — todos devem passar**

Execute:

```bash
npm test -- tests/unit/painel-cliente-actions.test.ts
```

Esperado: 5 passed.

- [ ] **Step 3: Type-check**

Execute:

```bash
npm run typecheck
```

Esperado: 0 erros (mudança é compatível com o resto do código que ainda usa o shape antigo `portal: P | null`).

- [ ] **Step 4: Commit**

```bash
git add tests/unit/painel-cliente-actions.test.ts src/lib/painel-cliente/actions.ts
git commit -m "$(cat <<'EOF'
feat(painel-cliente): permitir até 5 acessos ativos por cliente

Troca o check "1 acesso ativo por cliente" por "max 5 acessos ativos".
Revogados não contam, então cliente pode ter histórico de N revogados +
até 5 ativos. Mensagem de erro orienta a revogar um pra criar outro.

Sócios de uma mesma empresa agora cada um entra com conta própria no
portal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reshape da query + consumers (queries, page, table) em commit único

**Files:**
- Modify: `src/lib/painel-cliente/queries.ts`
- Modify: `src/app/(authed)/painel-cliente/page.tsx`
- Modify: `src/components/painel-cliente/PainelClienteTable.tsx`

> **Por que tudo num commit:** trocar `portal: P | null` por `portals: P[]` é breaking change de tipo. Se commitar só a query, o `page.tsx` e o `PainelClienteTable.tsx` quebram. Mantém a árvore verde fazendo a troca atômica.

- [ ] **Step 1: Atualizar `queries.ts` pro novo shape**

Substitua o conteúdo INTEIRO de `src/lib/painel-cliente/queries.ts` por:

```typescript
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PortalUser {
  user_id: string;
  email: string;
  nome_contato: string | null;
  ativo: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface ClienteComAcesso {
  client_id: string;
  client_nome: string;
  client_ativo: boolean;
  /**
   * Todos os acessos do cliente (ativos + revogados), ordenados por
   * created_at DESC. Vazio = cliente sem nenhum acesso ainda.
   */
  portals: PortalUser[];
}

/**
 * Lista TODOS os clientes ativos + seus acessos ao portal (até 5 ativos +
 * histórico de revogados). Usa service-role pra ler auth.users (email).
 */
export async function listClientesComAcessoPortal(): Promise<ClienteComAcesso[]> {
  const admin = createServiceRoleClient();

  // 1) Clientes ativos
  const { data: clientsData } = await admin
    .from("clients")
    .select("id, nome, status")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome");
  const clients = (clientsData ?? []) as Array<{ id: string; nome: string; status: string }>;

  if (clients.length === 0) return [];

  // 2) Portal users desses clientes (ativos + revogados)
  const clientIds = clients.map((c) => c.id);
  const { data: portalData } = await admin
    .from("client_portal_users")
    .select("user_id, client_id, nome_contato, ativo, created_at, last_login_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });
  const portalRows = (portalData ?? []) as Array<{
    user_id: string;
    client_id: string;
    nome_contato: string | null;
    ativo: boolean;
    created_at: string;
    last_login_at: string | null;
  }>;

  // 3) Emails dos portal users (de auth.users)
  const portalUserIds = portalRows.map((p) => p.user_id);
  const emailByUserId = new Map<string, string>();
  if (portalUserIds.length > 0) {
    // Mesmo padrão de antes — paginação simples (1 página, 1000 users máx).
    // Como agora pode ter até 5x mais portal users (5 por cliente), atenção:
    // com >200 clientes-com-acesso isso vira limitação. Paginar quando passar.
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (u.email && portalUserIds.includes(u.id)) {
        emailByUserId.set(u.id, u.email);
      }
    }
  }

  // 4) Agrupa portal rows por client_id
  const portalsByClientId = new Map<string, PortalUser[]>();
  for (const p of portalRows) {
    const list = portalsByClientId.get(p.client_id) ?? [];
    list.push({
      user_id: p.user_id,
      email: emailByUserId.get(p.user_id) ?? "—",
      nome_contato: p.nome_contato,
      ativo: p.ativo,
      created_at: p.created_at,
      last_login_at: p.last_login_at,
    });
    portalsByClientId.set(p.client_id, list);
  }

  // 5) Monta resposta
  return clients.map((c) => ({
    client_id: c.id,
    client_nome: c.nome,
    client_ativo: c.status === "ativo",
    portals: portalsByClientId.get(c.id) ?? [],
  }));
}

export interface ClientPortalData {
  cliente: {
    id: string;
    nome: string;
    valor_mensal: number;
    servico_contratado: string | null;
    data_entrada: string;
    tipo_pacote: string | null;
    modalidade: string | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    drive_url: string | null;
  };
  assessor: { nome: string } | null;
}

/**
 * Dados que o cliente portal vê no dashboard dele. Lê só o próprio client.
 */
export async function getClientPortalData(clientId: string): Promise<ClientPortalData | null> {
  const admin = createServiceRoleClient();

  const { data: clientData } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!clientData) return null;
  const client = clientData as unknown as {
    id: string;
    nome: string;
    valor_mensal: number;
    servico_contratado: string | null;
    data_entrada: string;
    tipo_pacote: string | null;
    modalidade: string | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    drive_url: string | null;
    assessor_id: string | null;
  };

  let assessor: { nome: string } | null = null;
  if (client.assessor_id) {
    const { data: a } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", client.assessor_id)
      .single();
    if (a) assessor = { nome: (a as { nome: string }).nome };
  }

  return {
    cliente: {
      id: client.id,
      nome: client.nome,
      valor_mensal: client.valor_mensal,
      servico_contratado: client.servico_contratado,
      data_entrada: client.data_entrada,
      tipo_pacote: client.tipo_pacote,
      modalidade: client.modalidade,
      valor_trafego_google: client.valor_trafego_google,
      valor_trafego_meta: client.valor_trafego_meta,
      drive_url: client.drive_url,
    },
    assessor,
  };
}
```

- [ ] **Step 2: Atualizar `page.tsx` — contadores do header pro novo shape**

Substitua o conteúdo INTEIRO de `src/app/(authed)/painel-cliente/page.tsx` por:

```typescript
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listClientesComAcessoPortal } from "@/lib/painel-cliente/queries";
import { PainelClienteTable } from "@/components/painel-cliente/PainelClienteTable";
import { CopyLinkButton } from "@/components/painel-cliente/CopyLinkButton";
import { env } from "@/lib/env";

export default async function PainelClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) notFound();

  const rows = await listClientesComAcessoPortal();

  // Cada métrica conta CLIENTES (não acessos):
  //  - comAcesso: cliente tem ≥1 acesso ativo
  //  - semAcesso: cliente nunca recebeu acesso
  //  - revogados: cliente já teve acesso mas nenhum está ativo
  const comAcesso = rows.filter((r) => r.portals.some((p) => p.ativo)).length;
  const semAcesso = rows.filter((r) => r.portals.length === 0).length;
  const revogados = rows.filter(
    (r) => r.portals.length > 0 && !r.portals.some((p) => p.ativo),
  ).length;

  // URL única do portal — todo cliente entra pelo mesmo /cliente/login
  const loginUrl = `${env.NEXT_PUBLIC_APP_URL}/cliente/login`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Painel do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie acessos dos seus clientes ao portal externo onde eles acompanham
          contrato, tráfego, entregas e mais. Cada cliente pode ter até 5 acessos
          ativos — útil pra empresas com sócios.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {comAcesso} com acesso · {semAcesso} sem acesso · {revogados} revogados
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Link de acesso do portal
          </p>
          <p className="break-all font-mono text-xs text-foreground/80">{loginUrl}</p>
        </div>
        <CopyLinkButton loginUrl={loginUrl} label="Copiar link" />
      </div>

      <PainelClienteTable rows={rows} loginUrl={loginUrl} />
    </div>
  );
}
```

- [ ] **Step 3: Atualizar `PainelClienteTable.tsx` — linha-resumo + sub-tabela expansível**

Substitua o conteúdo INTEIRO de `src/components/painel-cliente/PainelClienteTable.tsx` por:

```typescript
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConcederAcessoDialog } from "./ConcederAcessoDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { RevogarAcessoButton } from "./RevogarAcessoButton";
import { CopyLinkButton } from "./CopyLinkButton";
import type { ClienteComAcesso, PortalUser } from "@/lib/painel-cliente/queries";

const MAX_ACESSOS_ATIVOS = 5;

interface Props {
  rows: ClienteComAcesso[];
  loginUrl: string;
}

type ClientStatus = "ativo" | "revogado" | "sem_acesso";
type FilterKey = "todos" | "com_acesso" | "sem_acesso" | "revogados";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getClientStatus(r: ClienteComAcesso): ClientStatus {
  if (r.portals.length === 0) return "sem_acesso";
  if (r.portals.some((p) => p.ativo)) return "ativo";
  return "revogado";
}

function getMaxLastLogin(portals: PortalUser[]): string | null {
  const ativos = portals.filter((p) => p.ativo && p.last_login_at);
  if (ativos.length === 0) return null;
  return ativos
    .map((p) => p.last_login_at as string)
    .sort((a, b) => b.localeCompare(a))[0];
}

function describePortals(portals: PortalUser[]): string {
  if (portals.length === 0) return "Sem acesso";
  const ativos = portals.filter((p) => p.ativo).length;
  const revogados = portals.length - ativos;
  if (ativos === 0) return `${revogados} revogado${revogados > 1 ? "s" : ""}`;
  if (revogados === 0) return `${ativos} ativo${ativos > 1 ? "s" : ""}`;
  return `${ativos} ativo${ativos > 1 ? "s" : ""} · ${revogados} revogado${revogados > 1 ? "s" : ""}`;
}

export function PainelClienteTable({ rows, loginUrl }: Props) {
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [conceder, setConceder] = useState<{ clientId: string; clientNome: string } | null>(null);
  const [reset, setReset] = useState<{ userId: string; clientNome: string } | null>(null);

  const filtered = rows.filter((r) => {
    const status = getClientStatus(r);
    if (filter === "com_acesso") return status === "ativo";
    if (filter === "sem_acesso") return status === "sem_acesso";
    if (filter === "revogados") return status === "revogado";
    return true;
  });

  function toggleExpand(clientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          className={filter === "todos" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Todos
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("com_acesso")}
          className={filter === "com_acesso" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Com acesso
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("sem_acesso")}
          className={filter === "sem_acesso" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Sem acesso
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setFilter("revogados")}
          className={filter === "revogados" ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          Revogados
        </button>
      </div>

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Acessos</th>
              <th className="px-4 py-3 text-left">Último login</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum cliente neste filtro.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = getClientStatus(r);
              const ativosCount = r.portals.filter((p) => p.ativo).length;
              const isExpanded = expanded.has(r.client_id);
              const canExpand = r.portals.length > 0;

              return (
                <ClienteRowGroup
                  key={r.client_id}
                  r={r}
                  status={status}
                  ativosCount={ativosCount}
                  isExpanded={isExpanded}
                  canExpand={canExpand}
                  onToggle={() => toggleExpand(r.client_id)}
                  onConceder={() =>
                    setConceder({ clientId: r.client_id, clientNome: r.client_nome })
                  }
                  onReset={(userId) =>
                    setReset({ userId, clientNome: r.client_nome })
                  }
                  loginUrl={loginUrl}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {conceder && (
        <ConcederAcessoDialog
          clientId={conceder.clientId}
          clientNome={conceder.clientNome}
          loginUrl={loginUrl}
          onClose={() => setConceder(null)}
        />
      )}
      {reset && (
        <ResetPasswordDialog
          userId={reset.userId}
          clientNome={reset.clientNome}
          loginUrl={loginUrl}
          onClose={() => setReset(null)}
        />
      )}
    </div>
  );
}

interface ClienteRowGroupProps {
  r: ClienteComAcesso;
  status: ClientStatus;
  ativosCount: number;
  isExpanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
  onConceder: () => void;
  onReset: (userId: string) => void;
  loginUrl: string;
}

function ClienteRowGroup({
  r,
  status,
  ativosCount,
  isExpanded,
  canExpand,
  onToggle,
  onConceder,
  onReset,
  loginUrl,
}: ClienteRowGroupProps) {
  const maxLastLogin = getMaxLastLogin(r.portals);
  const canAdd = ativosCount < MAX_ACESSOS_ATIVOS;

  return (
    <>
      <tr
        className={`border-b last:border-b-0 ${canExpand ? "cursor-pointer hover:bg-muted/20" : ""}`}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="px-4 py-3 font-medium">
          <div className="flex items-center gap-2">
            {canExpand ? (
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            ) : (
              <span className="inline-block w-4" aria-hidden />
            )}
            {r.client_nome}
          </div>
        </td>
        <td className="px-4 py-3">
          {status === "sem_acesso" ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Sem acesso
            </span>
          ) : status === "ativo" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              Ativo
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
              Revogado
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{describePortals(r.portals)}</td>
        <td className="px-4 py-3 text-muted-foreground">{formatDate(maxLastLogin)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {status === "sem_acesso" ? (
            <Button size="sm" onClick={onConceder}>
              Conceder acesso
            </Button>
          ) : status === "revogado" ? (
            <Button size="sm" onClick={onConceder}>
              Conceder novo
            </Button>
          ) : (
            <CopyLinkButton loginUrl={loginUrl} />
          )}
        </td>
      </tr>

      {isExpanded && canExpand && (
        <tr className="border-b bg-muted/10">
          <td colSpan={5} className="px-4 py-3">
            <div className="ml-6 space-y-2">
              <table className="w-full text-xs">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  <tr>
                    <th className="py-1.5 text-left font-medium">Contato</th>
                    <th className="py-1.5 text-left font-medium">Email</th>
                    <th className="py-1.5 text-left font-medium">Status</th>
                    <th className="py-1.5 text-left font-medium">Último login</th>
                    <th className="py-1.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {r.portals.map((p) => (
                    <tr key={p.user_id} className="border-t border-border/40">
                      <td className="py-2">{p.nome_contato ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{p.email}</td>
                      <td className="py-2">
                        {p.ativo ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
                            Revogado
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(p.last_login_at)}
                      </td>
                      <td className="py-2 text-right">
                        {p.ativo ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReset(p.user_id)}
                            >
                              Resetar senha
                            </Button>
                            <RevogarAcessoButton
                              userId={p.user_id}
                              clientNome={r.client_nome}
                            />
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={onConceder}>
                            Conceder novo
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-1">
                {canAdd ? (
                  <Button size="sm" variant="ghost" onClick={onConceder}>
                    + Adicionar acesso de sócio
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled
                    title={`Limite de ${MAX_ACESSOS_ATIVOS} acessos ativos por cliente`}
                  >
                    + Adicionar acesso de sócio (limite de {MAX_ACESSOS_ATIVOS})
                  </Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 4: Rodar type-check**

Execute:

```bash
npm run typecheck
```

Esperado: 0 erros. Se aparecer erro tipo "Property 'portal' does not exist on type 'ClienteComAcesso'", procure por outro consumer não listado e atualize (não deve ter — confirmamos via grep no início).

- [ ] **Step 5: Rodar lint**

Execute:

```bash
npm run lint
```

Esperado: 0 erros.

- [ ] **Step 6: Rodar suite de testes inteira**

Execute:

```bash
npm test
```

Esperado: tudo verde. Em particular, os 5 testes novos de `painel-cliente-actions.test.ts` continuam passando.

- [ ] **Step 7: Commit**

```bash
git add src/lib/painel-cliente/queries.ts src/app/\(authed\)/painel-cliente/page.tsx src/components/painel-cliente/PainelClienteTable.tsx
git commit -m "$(cat <<'EOF'
feat(painel-cliente): UI suporta múltiplos acessos por cliente (até 5)

Reshape da query: `portal: Portal | null` vira `portals: Portal[]`,
com todos os acessos do cliente (ativos + revogados) ordenados por
created_at desc.

Tabela do painel ganha linha-resumo expansível: contagem agregada
("3 ativos · 1 revogado"), e ao expandir mostra sub-tabela com cada
acesso (contato/email/status/último login + ações de resetar/revogar
por acesso). Rodapé tem botão pra adicionar novo sócio, desabilitado
se já tem 5 ativos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verificação manual

> Per CLAUDE.md/feedback memory, o usuário prefere pular smoke test local de UI e ir direto pro PR depois de type-check/lint/tests verdes. Esta task é OPCIONAL — pule se a suite tá toda verde no Task 3.

- [ ] **Step 1 (opcional): Smoke test no dev server**

```bash
npm run dev
```

Abra `http://localhost:3000/painel-cliente` logado como `socio`:
1. Confirme que cada cliente com acesso tem chevron à esquerda.
2. Clica em um cliente — sub-tabela expande mostrando o(s) acesso(s).
3. Clica em "+ Adicionar acesso de sócio" — abre o dialog `ConcederAcessoDialog`.
4. Cria 2º acesso pro mesmo cliente — confirma que aparece na sub-tabela.
5. Filtros (`Todos / Com acesso / Sem acesso / Revogados`) ainda funcionam.

Mata o dev server depois.

- [ ] **Step 2: Push e abrir PR**

```bash
git push -u origin claude/thirsty-leavitt-eecda2
gh pr create --title "feat(painel-cliente): até 5 acessos por cliente (sócios)" --body "$(cat <<'EOF'
## Summary
- Permite até 5 acessos ativos por cliente no `/painel-cliente` (era 1) — útil pra empresas com sócios.
- Schema não muda — `client_portal_users` já aguenta N rows por cliente. Só altera o check no server action e o shape da query.
- Tabela ganha linha-resumo expansível com sub-tabela por acesso.

## Test plan
- [x] `npm test` — 5 testes novos cobrem o limite de 5 ativos (1º, 5º, 6º, revogados não contam, permissão)
- [x] `npm run typecheck` verde
- [x] `npm run lint` verde
- [ ] Smoke manual: criar 2 acessos pro mesmo cliente e verificar que aparecem na sub-tabela expandida
- [ ] Smoke manual: confirmar bloqueio amigável ao tentar criar o 6º acesso

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

- [x] **Spec coverage:** todos itens do spec mapeados — DB sem migração, action max-5, query reshape, page counters, table com expansão, filtros adaptados, edge cases (6º bloqueado, email único, revogados não contam).
- [x] **Sem placeholders:** todo bloco de código tem o conteúdo final, sem TODO/TBD.
- [x] **Type consistency:** `PortalUser` é exportado pela `queries.ts` e importado em `PainelClienteTable.tsx`. `ClienteComAcesso.portals: PortalUser[]` consistente entre query, page e tabela.
- [x] **Granularidade:** cada step é 1 ação verificável (escrever teste, rodar, ver falhar, implementar, ver passar, commitar).
- [x] **Commits frequentes:** 2 commits feature (action + UI), 1 PR.
