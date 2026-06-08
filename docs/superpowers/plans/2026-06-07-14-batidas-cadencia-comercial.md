# 14 Batidas — Cadência Comercial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma tela "14 Batidas" que conta, por prospecto, as tentativas de contato de saída somando Comercial Rua + Ligação (leads_gerados + leads de Onboarding), com drawer pra registrar cada batida, parando ao converter e sugerindo descarte na 14ª.

**Architecture:** Contador **derivado em app-layer** — nenhuma tabela nova de "batidas". As fontes (`lead_attempts`, `ligacoes` de saída, e a `visita` de origem) são lidas em consultas bulk e agregadas por uma **função pura** (`montarProspectosCadencia`) testável. A única mudança de schema é estender `lead_attempts` para também aceitar `lead_gerado_id` (hoje só aceita `lead_id` de Onboarding). UI nova em `/batidas`.

**Tech Stack:** Next.js (App Router, server components + server actions), Supabase (service-role dentro de `unstable_cache`), Zod, Vitest, Tailwind, lucide-react.

**Branch:** `feat/14-batidas-cadencia` (worktree em `../sistema-14batidas`, criada de `origin/main`). Migrations aplicadas **manualmente** via SQL Editor.

**Glossário de identidade:** um "prospecto" pode ser (a) só um `leads_gerados`, (b) um `leads_gerados` ligado a um `leads` de Onboarding via `leads_gerados.lead_onboarding_id`, ou (c) só um `leads` de Onboarding (sem `leads_gerados`). Batidas dos dois lados somam no mesmo prospecto.

---

## Regras de negócio (referência para todas as tasks)

- **Conta como batida (só saída):** toda linha de `lead_attempts`; toda `ligacoes` com `direcao='saida'` e `arquivado_em is null`; **+1** se o `leads_gerados` tem `visita_id` (a visita é a batida #1 presencial). Ligação de **entrada** NÃO conta (aparece na timeline).
- **Meta:** `BATIDAS_META = 14`.
- **Sucesso (encerra cadência):** `leads_gerados.status ∈ {reuniao_marcada, proposta_enviada, cliente}` **OU** `leads.stage ∈ {reuniao_comercial, proposta_enviada, contrato, marco_zero, ativo, comercial}` **OU** existe `lead_attempts.resultado = 'agendou'`.
- **Descartado:** `leads_gerados.status = 'descartado'` **OU** `leads.motivo_perdido` preenchido.
- **Em cadência:** não-sucesso e não-descartado.
- **Esgotou:** `total_batidas >= 14 && em cadência`.

---

## Task 1: Migration — estender `lead_attempts` com `lead_gerado_id`

**Files:**
- Create: `supabase/migrations/20260607000000_lead_attempts_lead_gerado.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260607000000_lead_attempts_lead_gerado.sql
-- Cadência "14 batidas": lead_attempts passa a aceitar também leads_gerados
-- (antes só aceitava leads de Onboarding). RLS é baseada em autor_id, então
-- tornar lead_id nullable + adicionar lead_gerado_id não afeta nenhuma policy.

alter table public.lead_attempts
  alter column lead_id drop not null;

alter table public.lead_attempts
  add column if not exists lead_gerado_id uuid
    references public.leads_gerados(id) on delete cascade;

-- exatamente um alvo preenchido (lead OU lead_gerado)
alter table public.lead_attempts
  drop constraint if exists lead_attempts_target_chk;
alter table public.lead_attempts
  add constraint lead_attempts_target_chk
  check ((lead_id is not null)::int + (lead_gerado_id is not null)::int = 1);

create index if not exists idx_lead_attempts_lead_gerado
  on public.lead_attempts(lead_gerado_id, created_at desc)
  where lead_gerado_id is not null;
```

- [ ] **Step 2: Validar sintaxe localmente (dry-check)**

Não há banco local. Confirme visualmente que: `lead_id` vira nullable, a coluna referencia `leads_gerados(id)`, o CHECK garante XOR, e o índice é parcial. (A aplicação real é manual no SQL Editor após o merge — ver seção final.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260607000000_lead_attempts_lead_gerado.sql
git commit -m "feat(batidas): migration estende lead_attempts com lead_gerado_id"
```

---

## Task 2: Config + helpers puros de status (`config.ts`)

**Files:**
- Create: `src/lib/batidas/config.ts`
- Test: `tests/unit/batidas.test.ts`

- [ ] **Step 1: Escrever os testes dos helpers**

```ts
// tests/unit/batidas.test.ts
import { describe, it, expect } from "vitest";
import {
  BATIDAS_META,
  leadGeradoEmSucesso,
  leadGeradoDescartado,
  leadOnboardingEmSucesso,
  leadOnboardingDescartado,
  roleVeTudo,
} from "@/lib/batidas/config";

describe("config batidas", () => {
  it("meta é 14", () => {
    expect(BATIDAS_META).toBe(14);
  });

  it("leads_gerados em sucesso", () => {
    expect(leadGeradoEmSucesso("reuniao_marcada")).toBe(true);
    expect(leadGeradoEmSucesso("proposta_enviada")).toBe(true);
    expect(leadGeradoEmSucesso("cliente")).toBe(true);
    expect(leadGeradoEmSucesso("novo")).toBe(false);
    expect(leadGeradoEmSucesso("em_contato")).toBe(false);
  });

  it("leads_gerados descartado", () => {
    expect(leadGeradoDescartado("descartado")).toBe(true);
    expect(leadGeradoDescartado("novo")).toBe(false);
  });

  it("lead onboarding em sucesso", () => {
    expect(leadOnboardingEmSucesso("reuniao_comercial", null)).toBe(true);
    expect(leadOnboardingEmSucesso("ativo", null)).toBe(true);
    expect(leadOnboardingEmSucesso("comercial", null)).toBe(true);
    expect(leadOnboardingEmSucesso("leads_potencial", null)).toBe(false);
    expect(leadOnboardingEmSucesso("leads_ativos", null)).toBe(false);
  });

  it("lead onboarding descartado quando tem motivo_perdido", () => {
    expect(leadOnboardingDescartado("não atendeu nunca")).toBe(true);
    expect(leadOnboardingDescartado(null)).toBe(false);
    expect(leadOnboardingDescartado("")).toBe(false);
  });

  it("roleVeTudo: adm/socio/coordenador veem tudo", () => {
    expect(roleVeTudo("adm")).toBe(true);
    expect(roleVeTudo("socio")).toBe(true);
    expect(roleVeTudo("coordenador")).toBe(true);
    expect(roleVeTudo("comercial")).toBe(false);
    expect(roleVeTudo("assessor")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/batidas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/batidas/config'`.

- [ ] **Step 3: Implementar `config.ts`**

```ts
// src/lib/batidas/config.ts
// Lógica pura da cadência de 14 batidas. Sem I/O — testável isoladamente.

export const BATIDAS_META = 14;

/** Status de leads_gerados que encerram a cadência como sucesso. */
const LEAD_GERADO_SUCESSO = new Set(["reuniao_marcada", "proposta_enviada", "cliente"]);

/** Stages de leads (Onboarding) que indicam que já passou da prospecção (sucesso). */
const LEAD_STAGE_SUCESSO = new Set([
  "reuniao_comercial",
  "proposta_enviada",
  "contrato",
  "marco_zero",
  "ativo",
  "comercial", // legado: equivalente a "já em negociação comercial"
]);

export function leadGeradoEmSucesso(status: string): boolean {
  return LEAD_GERADO_SUCESSO.has(status);
}

export function leadGeradoDescartado(status: string): boolean {
  return status === "descartado";
}

export function leadOnboardingEmSucesso(stage: string, _motivoPerdido: string | null): boolean {
  return LEAD_STAGE_SUCESSO.has(stage);
}

export function leadOnboardingDescartado(motivoPerdido: string | null): boolean {
  return !!motivoPerdido && motivoPerdido.trim().length > 0;
}

/** Papéis que enxergam todos os prospectos; os demais só os que são responsáveis. */
export function roleVeTudo(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/batidas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/batidas/config.ts tests/unit/batidas.test.ts
git commit -m "feat(batidas): helpers puros de status da cadência + testes"
```

---

## Task 3: Agregação pura `montarProspectosCadencia` (núcleo)

**Files:**
- Create: `src/lib/batidas/aggregate.ts`
- Test: `tests/unit/batidas.test.ts` (adiciona um novo `describe`)

- [ ] **Step 1: Adicionar os testes da agregação ao final do arquivo de teste**

```ts
// ...append em tests/unit/batidas.test.ts
import { montarProspectosCadencia } from "@/lib/batidas/aggregate";

const VAZIO = { leadsGerados: [], leads: [], attempts: [], ligacoes: [] };

describe("montarProspectosCadencia", () => {
  it("lead_gerado sem batidas e sem visita = 0/14, em cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "novo", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].totalBatidas).toBe(0);
    expect(r[0].statusCadencia).toBe("em_cadencia");
    expect(r[0].canal).toBe("ligacao");
  });

  it("visita conta como batida #1 (presencial) e canal vira rua", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Bar do Zé", status: "novo", fonte: "visita",
          visita_id: "v1", responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r[0].totalBatidas).toBe(1);
    expect(r[0].canal).toBe("rua");
  });

  it("tentativas (qualquer resultado, incl. sem_resposta) contam; ligação de saída conta; entrada não", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta", created_at: "2026-06-02T10:00:00Z" },
        { lead_id: null, lead_gerado_id: "g1", resultado: "recusou", created_at: "2026-06-03T10:00:00Z" },
      ],
      ligacoes: [
        { lead_id: null, lead_gerado_id: "g1", direcao: "saida", iniciada_em: "2026-06-04T10:00:00Z" },
        { lead_id: null, lead_gerado_id: "g1", direcao: "entrada", iniciada_em: "2026-06-05T10:00:00Z" },
      ],
    });
    expect(r[0].totalBatidas).toBe(3); // 2 attempts + 1 saída (entrada não conta)
    expect(r[0].ultimaBatida).toBe("2026-06-04T10:00:00Z");
  });

  it("resultado 'agendou' marca sucesso e tira da cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "agendou", created_at: "2026-06-02T10:00:00Z" },
      ],
    });
    expect(r[0].temSucesso).toBe(true);
    expect(r[0].statusCadencia).toBe("convertido");
  });

  it("14 batidas sem sucesso = esgotou", () => {
    const attempts = Array.from({ length: 14 }, (_, i) => ({
      lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta",
      created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "em_contato", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      attempts,
    });
    expect(r[0].totalBatidas).toBe(14);
    expect(r[0].statusCadencia).toBe("esgotou");
    expect(r[0].esgotou).toBe(true);
  });

  it("merge de identidade: batidas do lead_gerado + do lead de Onboarding ligado somam num só prospecto", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "qualificado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: "l1",
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
      leads: [
        { id: "l1", nome_prospect: "Acme", stage: "leads_ativos", canal: "ligacao",
          comercial_id: "u1", motivo_perdido: null, created_at: "2026-06-01T10:00:00Z" },
      ],
      attempts: [
        { lead_id: null, lead_gerado_id: "g1", resultado: "sem_resposta", created_at: "2026-06-02T10:00:00Z" },
        { lead_id: "l1", lead_gerado_id: null, resultado: "sem_resposta", created_at: "2026-06-03T10:00:00Z" },
      ],
    });
    expect(r).toHaveLength(1); // não duplica
    expect(r[0].totalBatidas).toBe(2);
    expect(r[0].leadGeradoId).toBe("g1");
    expect(r[0].leadId).toBe("l1");
  });

  it("lead de Onboarding standalone (sem lead_gerado) vira prospecto próprio; convertido sai da cadência", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leads: [
        { id: "l9", nome_prospect: "Solo", stage: "reuniao_comercial", canal: "rua",
          comercial_id: "u1", motivo_perdido: null, created_at: "2026-06-01T10:00:00Z" },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].leadGeradoId).toBeNull();
    expect(r[0].leadId).toBe("l9");
    expect(r[0].canal).toBe("rua");
    expect(r[0].temSucesso).toBe(true);
  });

  it("descartado: leads_gerados status descartado", () => {
    const r = montarProspectosCadencia({
      ...VAZIO,
      leadsGerados: [
        { id: "g1", empresa: "Acme", status: "descartado", fonte: "outscraper",
          visita_id: null, responsavel_id: "u1", lead_onboarding_id: null,
          created_at: "2026-06-01T10:00:00Z", decisor_nome: null, telefone: null, whatsapp: null },
      ],
    });
    expect(r[0].statusCadencia).toBe("descartado");
    expect(r[0].descartado).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/batidas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/batidas/aggregate'`.

- [ ] **Step 3: Implementar `aggregate.ts`**

```ts
// src/lib/batidas/aggregate.ts
import {
  BATIDAS_META,
  leadGeradoEmSucesso,
  leadGeradoDescartado,
  leadOnboardingEmSucesso,
  leadOnboardingDescartado,
} from "./config";

export interface LeadGeradoLite {
  id: string;
  empresa: string;
  status: string;
  fonte: string;
  visita_id: string | null;
  responsavel_id: string | null;
  lead_onboarding_id: string | null;
  created_at: string;
  decisor_nome: string | null;
  telefone: string | null;
  whatsapp: string | null;
}

export interface LeadLite {
  id: string;
  nome_prospect: string;
  stage: string;
  canal: string;
  comercial_id: string | null;
  motivo_perdido: string | null;
  created_at: string;
}

export interface AttemptLite {
  lead_id: string | null;
  lead_gerado_id: string | null;
  resultado: string;
  created_at: string;
}

export interface LigacaoLite {
  lead_id: string | null;
  lead_gerado_id: string | null;
  direcao: string;
  iniciada_em: string;
}

export interface AggInput {
  leadsGerados: LeadGeradoLite[];
  leads: LeadLite[];
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}

export type StatusCadencia = "em_cadencia" | "convertido" | "esgotou" | "descartado";

export interface ProspectoCadencia {
  key: string;
  leadGeradoId: string | null;
  leadId: string | null;
  nome: string;
  canal: "rua" | "ligacao";
  responsavelId: string | null;
  totalBatidas: number;
  meta: number;
  ultimaBatida: string | null;
  temSucesso: boolean;
  descartado: boolean;
  esgotou: boolean;
  statusCadencia: StatusCadencia;
}

function maisRecente(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Agrega as fontes de batida (lead_attempts + ligações de saída + visita de origem)
 * em uma lista de prospectos, resolvendo a identidade lead_gerado <-> lead de Onboarding.
 * Função PURA: não faz I/O.
 */
export function montarProspectosCadencia(input: AggInput): ProspectoCadencia[] {
  const { leadsGerados, leads, attempts, ligacoes } = input;

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const linkedLeadIds = new Set<string>();

  const prospectos: ProspectoCadencia[] = [];

  // 1) Prospectos a partir dos leads_gerados (podem trazer junto o lead ligado).
  for (const g of leadsGerados) {
    const lead = g.lead_onboarding_id ? leadById.get(g.lead_onboarding_id) ?? null : null;
    if (lead) linkedLeadIds.add(lead.id);
    prospectos.push(
      construir({
        key: `g:${g.id}`,
        leadGeradoId: g.id,
        leadId: lead?.id ?? null,
        nome: lead?.nome_prospect || g.empresa,
        canal: g.fonte === "visita" || lead?.canal === "rua" ? "rua" : "ligacao",
        responsavelId: g.responsavel_id ?? lead?.comercial_id ?? null,
        contaVisita: !!g.visita_id,
        visitaData: g.created_at,
        leadGerado: g,
        lead,
        attempts,
        ligacoes,
      }),
    );
  }

  // 2) Leads de Onboarding standalone (não referenciados por nenhum lead_gerado).
  for (const l of leads) {
    if (linkedLeadIds.has(l.id)) continue;
    prospectos.push(
      construir({
        key: `l:${l.id}`,
        leadGeradoId: null,
        leadId: l.id,
        nome: l.nome_prospect,
        canal: l.canal === "rua" ? "rua" : "ligacao",
        responsavelId: l.comercial_id ?? null,
        contaVisita: false,
        visitaData: null,
        leadGerado: null,
        lead: l,
        attempts,
        ligacoes,
      }),
    );
  }

  return prospectos;
}

function construir(args: {
  key: string;
  leadGeradoId: string | null;
  leadId: string | null;
  nome: string;
  canal: "rua" | "ligacao";
  responsavelId: string | null;
  contaVisita: boolean;
  visitaData: string | null;
  leadGerado: LeadGeradoLite | null;
  lead: LeadLite | null;
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}): ProspectoCadencia {
  const { leadGeradoId, leadId } = args;

  const matchAttempt = (a: AttemptLite) =>
    (leadGeradoId && a.lead_gerado_id === leadGeradoId) || (leadId && a.lead_id === leadId);
  const matchLig = (c: LigacaoLite) =>
    c.direcao === "saida" &&
    ((leadGeradoId && c.lead_gerado_id === leadGeradoId) || (leadId && c.lead_id === leadId));

  const meusAttempts = args.attempts.filter(matchAttempt);
  const minhasLig = args.ligacoes.filter(matchLig);

  let total = meusAttempts.length + minhasLig.length + (args.contaVisita ? 1 : 0);

  let ultima: string | null = args.contaVisita ? args.visitaData : null;
  for (const a of meusAttempts) ultima = maisRecente(ultima, a.created_at);
  for (const c of minhasLig) ultima = maisRecente(ultima, c.iniciada_em);

  const temAgendou = meusAttempts.some((a) => a.resultado === "agendou");
  const temSucesso =
    temAgendou ||
    (args.leadGerado ? leadGeradoEmSucesso(args.leadGerado.status) : false) ||
    (args.lead ? leadOnboardingEmSucesso(args.lead.stage, args.lead.motivo_perdido) : false);

  const descartado =
    (args.leadGerado ? leadGeradoDescartado(args.leadGerado.status) : false) ||
    (args.lead ? leadOnboardingDescartado(args.lead.motivo_perdido) : false);

  const esgotou = !temSucesso && !descartado && total >= BATIDAS_META;

  const statusCadencia: StatusCadencia = descartado
    ? "descartado"
    : temSucesso
      ? "convertido"
      : esgotou
        ? "esgotou"
        : "em_cadencia";

  return {
    key: args.key,
    leadGeradoId,
    leadId,
    nome: args.nome,
    canal: args.canal,
    responsavelId: args.responsavelId,
    totalBatidas: total,
    meta: BATIDAS_META,
    ultimaBatida: ultima,
    temSucesso,
    descartado,
    esgotou,
    statusCadencia,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/batidas.test.ts`
Expected: PASS (todos os `describe`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/batidas/aggregate.ts tests/unit/batidas.test.ts
git commit -m "feat(batidas): agregação pura montarProspectosCadencia + testes"
```

---

## Task 4: Queries de leitura (`queries.ts`)

**Files:**
- Create: `src/lib/batidas/queries.ts`

Lê as fontes via service-role (satisfaz a regra "unstable_cache só com service-role") e chama a função pura. `getOrganizationId` já existe em `gerador-leads/queries.ts` — reusar.

- [ ] **Step 1: Implementar `queries.ts`**

```ts
// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { roleVeTudo } from "./config";
import {
  montarProspectosCadencia,
  type ProspectoCadencia,
  type LeadGeradoLite,
  type LeadLite,
  type AttemptLite,
  type LigacaoLite,
} from "./aggregate";

export const BATIDAS_TAG = "batidas" as const;
const REVALIDATE_SECONDS = 60;

export async function getOrganizationId(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  return (data?.organization_id as string | undefined) ?? null;
}

interface RawSources {
  leadsGerados: LeadGeradoLite[];
  leads: LeadLite[];
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}

async function _fetchSources(orgId: string, responsavelId: string | null): Promise<RawSources> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  // leads_gerados em estados de cadência/sucesso (descartado entra pra mostrar badge,
  // mas só se a UI pedir; por padrão filtramos depois). Excluímos arquivados.
  let qg = sb
    .from("leads_gerados")
    .select(
      "id, empresa, status, fonte, visita_id, responsavel_id, lead_onboarding_id, created_at, decisor_nome, telefone, whatsapp",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);
  if (responsavelId) qg = qg.eq("responsavel_id", responsavelId);

  let ql = sb
    .from("leads")
    .select("id, nome_prospect, stage, canal, comercial_id, motivo_perdido, created_at")
    .eq("organization_id", orgId);
  if (responsavelId) ql = ql.eq("comercial_id", responsavelId);

  const [{ data: lg }, { data: ld }] = await Promise.all([qg, ql]);

  const leadsGerados = (lg ?? []) as LeadGeradoLite[];
  const leads = (ld ?? []) as LeadLite[];

  const geradoIds = leadsGerados.map((g) => g.id);
  const leadIds = leads.map((l) => l.id);

  // Busca de batidas em bulk pelos ids encontrados.
  const attempts = await fetchAttempts(sb, geradoIds, leadIds);
  const ligacoes = await fetchLigacoes(sb, geradoIds, leadIds);

  return { leadsGerados, leads, attempts, ligacoes };
}

async function fetchAttempts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  geradoIds: string[],
  leadIds: string[],
): Promise<AttemptLite[]> {
  const out: AttemptLite[] = [];
  if (geradoIds.length) {
    const { data } = await sb
      .from("lead_attempts")
      .select("lead_id, lead_gerado_id, resultado, created_at")
      .in("lead_gerado_id", geradoIds);
    out.push(...((data ?? []) as AttemptLite[]));
  }
  if (leadIds.length) {
    const { data } = await sb
      .from("lead_attempts")
      .select("lead_id, lead_gerado_id, resultado, created_at")
      .in("lead_id", leadIds);
    out.push(...((data ?? []) as AttemptLite[]));
  }
  return out;
}

async function fetchLigacoes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  geradoIds: string[],
  leadIds: string[],
): Promise<LigacaoLite[]> {
  const out: LigacaoLite[] = [];
  const base = () =>
    sb
      .from("ligacoes")
      .select("lead_id, lead_gerado_id, direcao, iniciada_em")
      .eq("direcao", "saida")
      .is("arquivado_em", null);
  if (geradoIds.length) {
    const { data } = await base().in("lead_gerado_id", geradoIds);
    out.push(...((data ?? []) as LigacaoLite[]));
  }
  if (leadIds.length) {
    const { data } = await base().in("lead_id", leadIds);
    out.push(...((data ?? []) as LigacaoLite[]));
  }
  return out;
}

export type CadenciaView = "em_cadencia" | "convertidos" | "esgotados" | "todos";

export interface GetProspectosArgs {
  orgId: string;
  responsavelId: string | null; // null = vê tudo
  view?: CadenciaView;
  canal?: "rua" | "ligacao" | "todos";
}

async function _getProspectosImpl(args: GetProspectosArgs): Promise<ProspectoCadencia[]> {
  const sources = await _fetchSources(args.orgId, args.responsavelId);
  let lista = montarProspectosCadencia(sources);

  const view = args.view ?? "em_cadencia";
  if (view === "em_cadencia") lista = lista.filter((p) => p.statusCadencia === "em_cadencia" || p.statusCadencia === "esgotou");
  else if (view === "convertidos") lista = lista.filter((p) => p.temSucesso);
  else if (view === "esgotados") lista = lista.filter((p) => p.esgotou);
  // "todos": sem filtro de status

  if (args.canal && args.canal !== "todos") lista = lista.filter((p) => p.canal === args.canal);

  // Ordena: esgotou primeiro, depois mais parado (ultimaBatida mais antiga), depois nome.
  lista.sort((a, b) => {
    if (a.esgotou !== b.esgotou) return a.esgotou ? -1 : 1;
    const ua = a.ultimaBatida ?? "";
    const ub = b.ultimaBatida ?? "";
    if (ua !== ub) return ua < ub ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  return lista;
}

export async function getProspectosEmCadencia(args: GetProspectosArgs): Promise<ProspectoCadencia[]> {
  const cached = unstable_cache(
    async () => _getProspectosImpl(args),
    ["batidas-cadencia", args.orgId, args.responsavelId ?? "all", args.view ?? "em_cadencia", args.canal ?? "todos"],
    { revalidate: REVALIDATE_SECONDS, tags: [BATIDAS_TAG] },
  );
  return cached();
}

// ---- Timeline de um prospecto (para o drawer) ----

export interface BatidaTimelineItem {
  tipo: "tentativa" | "ligacao" | "visita";
  canal: string;          // whatsapp | email | ligacao | presencial | outro | telefone | whatsapp(lig)
  rotulo: string;         // texto humano (resultado/status)
  observacao: string | null;
  autorNome: string | null;
  data: string;           // ISO
  conta: boolean;         // false p/ ligação de entrada
  numero: number | null;  // ordinal entre as que contam (1..N), null se não conta
}

export async function getBatidasTimeline(args: {
  leadGeradoId: string | null;
  leadId: string | null;
  visitaId: string | null;
  visitaData: string | null;
}): Promise<BatidaTimelineItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const items: BatidaTimelineItem[] = [];

  const orFilter: string[] = [];
  if (args.leadGeradoId) orFilter.push(`lead_gerado_id.eq.${args.leadGeradoId}`);
  if (args.leadId) orFilter.push(`lead_id.eq.${args.leadId}`);

  if (orFilter.length) {
    const { data: at } = await sb
      .from("lead_attempts")
      .select("canal, resultado, observacao, created_at, autor:profiles!lead_attempts_autor_id_fkey(nome)")
      .or(orFilter.join(","));
    for (const a of (at ?? []) as Array<Record<string, unknown>>) {
      items.push({
        tipo: "tentativa",
        canal: String(a.canal),
        rotulo: String(a.resultado),
        observacao: (a.observacao as string | null) ?? null,
        autorNome: ((a.autor as { nome?: string } | null)?.nome) ?? null,
        data: String(a.created_at),
        conta: true,
        numero: null,
      });
    }

    const { data: lg } = await sb
      .from("ligacoes")
      .select("tipo, direcao, status, observacoes, iniciada_em, colaborador:profiles!ligacoes_colaborador_id_fkey(nome)")
      .is("arquivado_em", null)
      .or(orFilter.join(","));
    for (const c of (lg ?? []) as Array<Record<string, unknown>>) {
      const entrada = String(c.direcao) === "entrada";
      items.push({
        tipo: "ligacao",
        canal: String(c.tipo),
        rotulo: String(c.status),
        observacao: (c.observacoes as string | null) ?? null,
        autorNome: ((c.colaborador as { nome?: string } | null)?.nome) ?? null,
        data: String(c.iniciada_em),
        conta: !entrada,
        numero: null,
      });
    }
  }

  if (args.visitaId && args.visitaData) {
    items.push({
      tipo: "visita",
      canal: "presencial",
      rotulo: "Visita (origem)",
      observacao: null,
      autorNome: null,
      data: args.visitaData,
      conta: true,
      numero: null,
    });
  }

  // ordena cronológico asc e numera as que contam
  items.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  let n = 0;
  for (const it of items) {
    if (it.conta) it.numero = ++n;
  }
  return items;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos de `src/lib/batidas/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/batidas/queries.ts
git commit -m "feat(batidas): queries de cadência (lista + timeline) via service-role"
```

---

## Task 5: Server actions (`actions.ts`) + invalidação cruzada

**Files:**
- Create: `src/lib/batidas/actions.ts`
- Modify: `src/lib/prospeccao/actions.ts` (add `revalidateTag("batidas","default")` em `addLeadAttemptAction`)
- Modify: `src/lib/visitas/actions.ts` (revalidate batidas ao criar/editar visita)
- Modify: `src/lib/ligacoes/actions.ts` (revalidate batidas ao registrar ligação)

- [ ] **Step 1: Implementar `batidas/actions.ts`**

```ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { ATTEMPT_CHANNELS, ATTEMPT_RESULTS } from "@/lib/prospeccao/schema";

export type ActionResult = { ok: true } | { error: string };

const registrarBatidaSchema = z
  .object({
    lead_id: z.string().uuid().optional().nullable(),
    lead_gerado_id: z.string().uuid().optional().nullable(),
    canal: z.enum(ATTEMPT_CHANNELS),
    resultado: z.enum(ATTEMPT_RESULTS),
    observacao: z.string().max(2000).optional().nullable(),
    proximo_passo: z.string().max(500).optional().nullable(),
    data_proximo_passo: z.string().optional().nullable(),
  })
  .refine((d) => !!d.lead_id !== !!d.lead_gerado_id, {
    message: "Informe exatamente um alvo (lead_id OU lead_gerado_id).",
  });

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function registrarBatidaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = registrarBatidaSchema.safeParse({
    lead_id: str(formData, "lead_id"),
    lead_gerado_id: str(formData, "lead_gerado_id"),
    canal: formData.get("canal"),
    resultado: formData.get("resultado"),
    observacao: str(formData, "observacao"),
    proximo_passo: str(formData, "proximo_passo"),
    data_proximo_passo: str(formData, "data_proximo_passo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lead_attempts").insert({
    lead_id: parsed.data.lead_id,
    lead_gerado_id: parsed.data.lead_gerado_id,
    autor_id: actor.id,
    canal: parsed.data.canal,
    resultado: parsed.data.resultado,
    observacao: parsed.data.observacao,
    proximo_passo: parsed.data.proximo_passo,
    data_proximo_passo: parsed.data.data_proximo_passo,
  });
  if (error) return { error: error.message };

  revalidateTag("batidas", "default");
  revalidatePath("/batidas");
  return { ok: true };
}

const descartarSchema = z
  .object({
    lead_id: z.string().uuid().optional().nullable(),
    lead_gerado_id: z.string().uuid().optional().nullable(),
    motivo: z.string().min(3, "Motivo muito curto").max(2000),
  })
  .refine((d) => !!d.lead_id !== !!d.lead_gerado_id, {
    message: "Informe exatamente um alvo.",
  });

export async function descartarProspectoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = descartarSchema.safeParse({
    lead_id: str(formData, "lead_id"),
    lead_gerado_id: str(formData, "lead_gerado_id"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();

  if (parsed.data.lead_gerado_id) {
    const { data, error } = await supabase
      .from("leads_gerados")
      .update({ status: "descartado", observacoes: parsed.data.motivo })
      .eq("id", parsed.data.lead_gerado_id)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Sem permissão ou registro não encontrado." };
  } else if (parsed.data.lead_id) {
    const { data, error } = await supabase
      .from("leads")
      .update({ motivo_perdido: parsed.data.motivo })
      .eq("id", parsed.data.lead_id)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Sem permissão ou registro não encontrado." };
  }

  await supabase.from("audit_log").insert({
    actor_id: actor.id,
    action: "descartar_prospecto_cadencia",
    detail: parsed.data.motivo,
  });

  revalidateTag("batidas", "default");
  revalidatePath("/batidas");
  return { ok: true };
}
```

> Nota: `audit_log` insert é "best-effort"; se a tabela exigir colunas diferentes, remova esse bloco. Verifique o shape real de `audit_log` em `prospeccao/actions.ts` (lá ele usa `actor_id`, `action`, `detail`). Mantenha consistente.

- [ ] **Step 2: Verificar shape de `audit_log` e ajustar se necessário**

Run: `grep -n "audit_log" src/lib/prospeccao/actions.ts`
Confirme as colunas usadas (`actor_id`, `action`, `detail` ou similar) e ajuste o insert acima para bater exatamente. Se a estrutura divergir, replique o objeto usado em `marcarPerdidoAction`.

- [ ] **Step 3: Invalidação cruzada — `addLeadAttemptAction`**

Em `src/lib/prospeccao/actions.ts`, na função `addLeadAttemptAction`, logo após o `revalidatePath(\`/prospeccao/prospects/${parsed.data.lead_id}\`)`, adicione:

```ts
  revalidateTag("batidas", "default");
```

- [ ] **Step 4: Invalidação cruzada — visitas e ligações**

Em `src/lib/visitas/actions.ts`: em cada action que cria/edita/arquiva visita ou adiciona lead à visita (ex.: `adicionarLeadVisitaAction`), após o `revalidate*` existente, adicione `revalidateTag("batidas", "default");` (importe `revalidateTag` de `next/cache` se ainda não estiver).

Em `src/lib/ligacoes/actions.ts`: nas actions que inserem/atualizam `ligacoes` (registro manual de chamada), após o `revalidate*` existente, adicione `revalidateTag("batidas", "default");`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/batidas/actions.ts src/lib/prospeccao/actions.ts src/lib/visitas/actions.ts src/lib/ligacoes/actions.ts
git commit -m "feat(batidas): actions registrar/descartar + invalidação cruzada da tag batidas"
```

---

## Task 6: Item no menu lateral

**Files:**
- Modify: `src/components/layout/nav-config.ts`

- [ ] **Step 1: Importar o ícone**

No bloco de import de `lucide-react` no topo de `nav-config.ts`, adicione `Target` à lista (junto de `MapPin`, etc.):

```ts
  IdCard, Rocket, BookOpen, Inbox, Activity, Layers, Sparkles, Zap, MapPin, Target,
```

- [ ] **Step 2: Adicionar o link top-level**

Logo após o link `{ type: "link", href: "/", icon: LayoutGrid, label: "Dashboard", ... }` e ANTES do grupo "Comunicação", insira:

```ts
  { type: "link", href: "/batidas", icon: Target, label: "14 Batidas", roles: ["adm", "socio", "comercial", "coordenador", "assessor"], badgeKey: null },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(batidas): item '14 Batidas' no menu lateral"
```

---

## Task 7: Página `/batidas` + tabela de prospectos

**Files:**
- Create: `src/app/(authed)/batidas/page.tsx`
- Create: `src/components/batidas/ProspectosCadenciaTable.tsx`

- [ ] **Step 1: Implementar a tabela (client component)**

```tsx
// src/components/batidas/ProspectosCadenciaTable.tsx
"use client";

import { useState } from "react";
import { Phone, MapPin } from "lucide-react";
import type { ProspectoCadencia } from "@/lib/batidas/aggregate";
import { BatidaDrawer } from "./BatidaDrawer";

interface Props {
  prospectos: ProspectoCadencia[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  em_cadencia: { label: "Em cadência", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  convertido: { label: "🎉 Convertido", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  esgotou: { label: "⚠️ Esgotou", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  descartado: { label: "Descartado", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export function ProspectosCadenciaTable({ prospectos }: Props) {
  const [aberto, setAberto] = useState<ProspectoCadencia | null>(null);

  if (prospectos.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Nenhum prospecto em cadência.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Prospecto</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Progresso</th>
              <th className="px-3 py-2">Última batida</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {prospectos.map((p) => {
              const pct = Math.min(100, Math.round((p.totalBatidas / p.meta) * 100));
              const badge = STATUS_BADGE[p.statusCadencia];
              return (
                <tr
                  key={p.key}
                  onClick={() => setAberto(p)}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-medium">{p.nome}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {p.canal === "rua" ? <MapPin className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                      {p.canal === "rua" ? "Rua" : "Ligação"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${p.esgotou ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.totalBatidas}/{p.meta}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.ultimaBatida ? new Date(p.ultimaBatida).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberto && <BatidaDrawer prospecto={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}
```

- [ ] **Step 2: Implementar a página (server component)**

```tsx
// src/app/(authed)/batidas/page.tsx
import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { roleVeTudo } from "@/lib/batidas/config";
import {
  getOrganizationId,
  getProspectosEmCadencia,
  type CadenciaView,
} from "@/lib/batidas/queries";
import { ProspectosCadenciaTable } from "@/components/batidas/ProspectosCadenciaTable";

const ALLOWED = ["adm", "socio", "comercial", "coordenador", "assessor"];

export default async function BatidasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; canal?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const params = await searchParams;

  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const view = (["em_cadencia", "convertidos", "esgotados", "todos"].includes(params.view ?? "")
    ? params.view
    : "em_cadencia") as CadenciaView;
  const canal = (["rua", "ligacao", "todos"].includes(params.canal ?? "") ? params.canal : "todos") as
    | "rua"
    | "ligacao"
    | "todos";

  const prospectos = await getProspectosEmCadencia({
    orgId,
    responsavelId: roleVeTudo(user.role) ? null : user.id,
    view,
    canal,
  });

  const tabs: Array<{ key: CadenciaView; label: string }> = [
    { key: "em_cadencia", label: "Em cadência" },
    { key: "esgotados", label: "Esgotados" },
    { key: "convertidos", label: "Convertidos" },
    { key: "todos", label: "Todos" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Target className="h-6 w-6 text-primary" /> 14 Batidas
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Cadência comercial (rua + ligação). Cada prospecto deve receber até 14 tentativas de contato.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/batidas?view=${t.key}${canal !== "todos" ? `&canal=${canal}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${view === t.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/30"}`}
          >
            {t.label}
          </a>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {(["todos", "rua", "ligacao"] as const).map((c) => (
          <a
            key={c}
            href={`/batidas?view=${view}${c !== "todos" ? `&canal=${c}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${canal === c ? "bg-secondary" : "bg-card hover:bg-muted/30"}`}
          >
            {c === "todos" ? "Todos canais" : c === "rua" ? "Rua" : "Ligação"}
          </a>
        ))}
      </div>

      <ProspectosCadenciaTable prospectos={prospectos} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: erro só em `./BatidaDrawer` (criado na Task 8). Se quiser compilar agora, crie um stub mínimo; senão, deixe pra Task 8 e rode o type-check completo lá.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/batidas/page.tsx" src/components/batidas/ProspectosCadenciaTable.tsx
git commit -m "feat(batidas): página /batidas + tabela de prospectos em cadência"
```

---

## Task 8: Drawer com timeline + registrar batida + descartar

**Files:**
- Create: `src/components/batidas/BatidaDrawer.tsx`
- Create: `src/app/(authed)/batidas/timeline-action.ts` (server action que devolve a timeline sob demanda)

- [ ] **Step 1: Server action que busca a timeline**

```ts
// src/app/(authed)/batidas/timeline-action.ts
"use server";

import { requireAuth } from "@/lib/auth/session";
import { getBatidasTimeline, type BatidaTimelineItem } from "@/lib/batidas/queries";

export async function carregarTimelineAction(input: {
  leadGeradoId: string | null;
  leadId: string | null;
  visitaId: string | null;
  visitaData: string | null;
}): Promise<BatidaTimelineItem[]> {
  await requireAuth();
  return getBatidasTimeline(input);
}
```

> A timeline precisa de `visitaId`/`visitaData`. Esses campos NÃO vêm no `ProspectoCadencia` atual. Adicione-os: no `aggregate.ts`, inclua `visitaId: string | null` e `visitaData: string | null` na interface `ProspectoCadencia` e preencha em `construir` (`visitaId: args.contaVisita ? args.leadGerado?.visita_id ?? null : null`, `visitaData: args.contaVisita ? args.visitaData : null`). Rode `npx vitest run tests/unit/batidas.test.ts` depois pra garantir que os testes seguem verdes (campos novos não quebram as asserções existentes).

- [ ] **Step 2: Implementar o drawer**

```tsx
// src/components/batidas/BatidaDrawer.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Phone, MessageCircle, Mail, MapPin, MoreHorizontal } from "lucide-react";
import type { ProspectoCadencia } from "@/lib/batidas/aggregate";
import type { BatidaTimelineItem } from "@/lib/batidas/queries";
import { carregarTimelineAction } from "@/app/(authed)/batidas/timeline-action";
import { registrarBatidaAction, descartarProspectoAction } from "@/lib/batidas/actions";

interface Props {
  prospecto: ProspectoCadencia;
  onClose: () => void;
}

const CANAIS = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "presencial", label: "Presencial" },
  { value: "email", label: "Email" },
  { value: "outro", label: "Outro" },
];
const RESULTADOS = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "agendou", label: "Agendou" },
  { value: "recusou", label: "Recusou" },
  { value: "pediu_proposta", label: "Pediu proposta" },
  { value: "outro", label: "Outro" },
];

function iconeCanal(canal: string) {
  if (canal === "presencial") return <MapPin className="h-4 w-4" />;
  if (canal === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  if (canal === "email") return <Mail className="h-4 w-4" />;
  if (canal === "ligacao" || canal === "telefone") return <Phone className="h-4 w-4" />;
  return <MoreHorizontal className="h-4 w-4" />;
}

export function BatidaDrawer({ prospecto, onClose }: Props) {
  const [timeline, setTimeline] = useState<BatidaTimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // @ts-expect-error: campos adicionados em aggregate.ts (Step 1)
  const visitaId: string | null = prospecto.visitaId ?? null;
  // @ts-expect-error
  const visitaData: string | null = prospecto.visitaData ?? null;

  useEffect(() => {
    carregarTimelineAction({
      leadGeradoId: prospecto.leadGeradoId,
      leadId: prospecto.leadId,
      visitaId,
      visitaData,
    }).then(setTimeline);
  }, [prospecto.leadGeradoId, prospecto.leadId, visitaId, visitaData]);

  function setAlvo(fd: FormData) {
    if (prospecto.leadGeradoId) fd.set("lead_gerado_id", prospecto.leadGeradoId);
    else if (prospecto.leadId) fd.set("lead_id", prospecto.leadId);
  }

  function onRegistrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setAlvo(fd);
    const formEl = e.currentTarget;
    startTransition(async () => {
      const r = await registrarBatidaAction(fd);
      if ("error" in r) setError(r.error);
      else {
        formEl.reset();
        const tl = await carregarTimelineAction({
          leadGeradoId: prospecto.leadGeradoId, leadId: prospecto.leadId, visitaId, visitaData,
        });
        setTimeline(tl);
      }
    });
  }

  function onDescartar() {
    const motivo = window.prompt("Motivo do descarte:");
    if (!motivo || motivo.trim().length < 3) return;
    const fd = new FormData();
    setAlvo(fd);
    fd.set("motivo", motivo.trim());
    startTransition(async () => {
      const r = await descartarProspectoAction(fd);
      if ("error" in r) setError(r.error);
      else onClose();
    });
  }

  const pct = Math.min(100, Math.round((prospecto.totalBatidas / prospecto.meta) * 100));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{prospecto.nome}</h2>
            <p className="text-xs text-muted-foreground">{prospecto.canal === "rua" ? "Comercial Rua" : "Comercial Ligação"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums">{prospecto.totalBatidas}/{prospecto.meta}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${prospecto.esgotou ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {prospecto.temSucesso && (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            🎉 Prospecto convertido — cadência encerrada.
          </div>
        )}
        {prospecto.esgotou && (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            ⚠️ Esgotou as 14 batidas sem sucesso.
            <button onClick={onDescartar} disabled={pending} className="mt-2 block rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:opacity-90 disabled:opacity-50">
              Marcar como perdido / descartar
            </button>
          </div>
        )}

        {!prospecto.temSucesso && (
          <form onSubmit={onRegistrar} className="mb-5 space-y-2 rounded-lg border bg-card p-3">
            <h3 className="text-sm font-semibold">Registrar batida</h3>
            <div className="grid grid-cols-2 gap-2">
              <select name="canal" required defaultValue="ligacao" className="h-9 rounded-md border bg-card px-2 text-sm">
                {CANAIS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select name="resultado" required defaultValue="sem_resposta" className="h-9 rounded-md border bg-card px-2 text-sm">
                {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <textarea name="observacao" rows={2} placeholder="Observação" className="w-full rounded-md border bg-card px-2 py-1.5 text-sm" />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {pending ? "Salvando..." : "Registrar batida"}
            </button>
          </form>
        )}

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
        {timeline === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma batida ainda.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((it, i) => (
              <li key={i} className="flex gap-2 rounded-md border bg-card p-2 text-sm">
                <span className="mt-0.5 text-muted-foreground">{iconeCanal(it.canal)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {it.numero ? `#${it.numero} ` : ""}{it.rotulo}
                      {!it.conta && <span className="ml-1 text-[10px] text-muted-foreground">(não conta)</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(it.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {it.observacao && <p className="text-xs text-muted-foreground">{it.observacao}</p>}
                  {it.autorNome && <p className="text-[10px] text-muted-foreground">por {it.autorNome}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

> Após implementar, REMOVA os `@ts-expect-error` do Step 2 assim que os campos `visitaId`/`visitaData` existirem em `ProspectoCadencia` (Step 1) — leia `prospecto.visitaId`/`prospecto.visitaData` direto. Se o `@ts-expect-error` ficar sem erro pra suprimir, o `tsc` reclama.

- [ ] **Step 3: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros em nenhum arquivo de batidas.

- [ ] **Step 4: Lint**

Run: `npx next lint --dir src/lib/batidas --dir src/components/batidas --dir "src/app/(authed)/batidas"` (ou o comando de lint do projeto: ver `package.json`).
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/batidas/BatidaDrawer.tsx "src/app/(authed)/batidas/timeline-action.ts" src/lib/batidas/aggregate.ts
git commit -m "feat(batidas): drawer com timeline unificada, registrar batida e descartar"
```

---

## Task 9: Verificação final + build

**Files:** nenhum novo.

- [ ] **Step 1: Rodar a suíte de testes**

Run: `npx vitest run`
Expected: todos verdes, incluindo `tests/unit/batidas.test.ts`.

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build conclui sem erros. (Se `npm run build` for pesado, ao menos `tsc --noEmit` + `npx next lint`.)

- [ ] **Step 3: Checklist manual de fumaça (anotar, não automatizar)**

Confirme mentalmente contra as regras de negócio:
- `/batidas` aparece no menu para os papéis certos.
- Lista mostra X/14, badge de status, filtros de view e canal.
- Drawer abre, mostra timeline com numeração e marca entrada como "(não conta)".
- "Registrar batida" insere e a timeline recarrega; o contador sobe após revalidate.
- Em prospecto com ≥14 e sem sucesso, aparece o aviso de esgotado + botão descartar.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore(batidas): ajustes finais de verificação"
```

---

## Aplicação manual da migration (pós-merge)

Depois que o PR for mergeado, aplicar no **SQL Editor** do Supabase (produção), em ordem:

1. Conteúdo de `supabase/migrations/20260607000000_lead_attempts_lead_gerado.sql`.

Verificar com:

```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'lead_attempts' and column_name in ('lead_id','lead_gerado_id');
-- lead_id => YES ; lead_gerado_id => YES
```

Sem essa migration, `registrarBatidaAction` para lead_gerado falha (coluna inexistente) e o
SELECT de `lead_attempts.lead_gerado_id` quebra a página `/batidas`. Aplicar **antes** de
divulgar a tela ao time.

---

## Self-review (preenchido pelo autor do plano)

- **Cobertura do spec:** contagem unificada (Tasks 3/4), só-saída + entrada-não-conta (Task 3 testes + Task 4 filtro), visita=batida#1 (Task 3), estender lead_attempts (Task 1+5), sucesso/esgotou/descarte (Tasks 3/5/8), tela nova + menu (Tasks 6/7), drawer + registrar (Task 8), service-role+unstable_cache+tag (Task 4), invalidação cruzada (Task 5), papéis (Tasks 2/7), testes (Tasks 2/3). ✅
- **Placeholders:** nenhum "TODO/TBD"; todo passo tem código real.
- **Consistência de tipos:** `ProspectoCadencia` ganha `visitaId`/`visitaData` na Task 8 Step 1 (usado pelo drawer/timeline); `montarProspectosCadencia`, `getProspectosEmCadencia`, `getBatidasTimeline`, `registrarBatidaAction`, `descartarProspectoAction` referenciados com as mesmas assinaturas em todas as tasks.
- **Risco conhecido:** `audit_log` (Task 5 Step 2) precisa bater com o shape real — passo de verificação incluído. `.in()` com muitos ids é aceitável para v1 (bounded por org+responsável); paginação fica para depois (YAGNI).
