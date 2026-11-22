# Painel Dados — Parte 2: painel no Sistema Acompanhamento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `/dados`, que vira o item de menu no lugar de "Programação": visão geral de todos os clientes com nota de presença e status por canal, mais a tela de cada cliente com números, "Onde está perdendo" e conexões.

**Architecture:** Regras e nota são funções puras (`src/lib/dados/regras.ts`, `nota.ts`) com testes. Coletores (um por fonte) fazem `fetch` nas APIs externas e devolvem dados crus. `calcular.ts` junta coletores e regras num `SnapshotDados`. Um cron diário grava 1 snapshot por cliente em `client_dados_snapshots`, e a página só lê o mais recente (para não ficar lenta). O botão "Atualizar agora" recalcula um cliente.

**Tech Stack:** Next.js 16 App Router (`searchParams`/`params` são `Promise`), Supabase (service-role nas leituras, depois do gate de acesso em código), Tailwind + `src/components/ui`, vitest (jsdom), `node:crypto` para JWT do Google. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-22-painel-dados-design.md`

**Depende de:** Parte 1 (endpoints do Lyide). Sem ela, o canal CRM fica `sem_acesso` e o resto funciona.

**Antes de começar:**
- Leia `node_modules/next/dist/docs/` nas partes de route handlers, server actions e `params` (AGENTS.md exige).
- Trabalhe na branch `feat/painel-dados`, que já tem o spec e foi criada a partir de `origin/main`.
- Ao rodar o vitest local, use `npx vitest run --exclude '**/.claude/**'`, porque os worktrees geram falhas fantasma.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261122000000_painel_dados.sql` | colunas `ga4_property_id`, `gsc_site_url` + tabela `client_dados_snapshots` |
| `src/lib/dados/access.ts` (+ `.test.ts`) | quem vê o quê |
| `src/lib/dados/tipos.ts` | tipos compartilhados |
| `src/lib/dados/regras.ts` (+ `.test.ts`) | limites e avaliação de cada canal (puro) |
| `src/lib/dados/nota.ts` (+ `.test.ts`) | nota 0–100, faixa, perdas ordenadas (puro) |
| `src/lib/dados/periodo.ts` (+ `.test.ts`) | período padrão de 30 dias e período anterior |
| `src/lib/dados/google-auth.ts` (+ `.test.ts`) | token OAuth da conta de serviço via JWT |
| `src/lib/dados/coletores/google.ts` | GA4 (sessões) + Search Console (cliques, posição) + listas para conexão |
| `src/lib/dados/coletores/meta.ts` | Instagram, Facebook, anúncios |
| `src/lib/dados/coletores/lyide.ts` | resumo CRM + lista de empresas |
| `src/lib/dados/coletores/locais.ts` | GMN e e-commerce (dados do próprio banco) |
| `src/lib/dados/calcular.ts` | orquestra os coletores, aplica as regras e grava o snapshot |
| `src/lib/dados/queries.ts` | leitura para as páginas |
| `src/lib/dados/actions.ts` | "Atualizar agora" + salvar conexões |
| `src/app/api/cron/dados-snapshot/route.ts` | cron diário |
| `src/app/(authed)/dados/page.tsx` | visão geral |
| `src/app/(authed)/dados/[clientId]/page.tsx` | tela do cliente |
| `src/components/dados/*` | UI |
| `src/components/layout/nav-config.ts` | menu "Dados" |
| `src/app/(authed)/programacao/page.tsx` | abas no topo |

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261122000000_painel_dados.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Painel Dados (spec 2026-11-22). Aplicar MANUALMENTE no SQL Editor após o merge.

alter table public.clients
  add column if not exists ga4_property_id text,
  add column if not exists gsc_site_url text;

comment on column public.clients.ga4_property_id is 'ID numérico da propriedade GA4 (ex.: 564211864). Lido pela conta de serviço.';
comment on column public.clients.gsc_site_url is 'Site do Search Console (ex.: sc-domain:atenarh.com.br ou https://atenarh.com.br/).';

create table if not exists public.client_dados_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  nota int check (nota is null or (nota between 0 and 100)),
  nota_anterior int check (nota_anterior is null or (nota_anterior between 0 and 100)),
  canais jsonb not null default '{}'::jsonb,
  perdas jsonb not null default '[]'::jsonb,
  calculado_em timestamptz not null default now()
);

create index if not exists idx_client_dados_snapshots_client
  on public.client_dados_snapshots (client_id, calculado_em desc);

alter table public.client_dados_snapshots enable row level security;

-- Leitura: chefia/programação da org vê tudo; assessor vê os próprios clientes.
-- Escrita: só service-role (sem policy de insert/update).
drop policy if exists client_dados_snapshots_select on public.client_dados_snapshots;
create policy client_dados_snapshots_select on public.client_dados_snapshots
  for select to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = client_dados_snapshots.organization_id
        and p.role in ('adm', 'socio', 'programacao')
    )
    or exists (
      select 1 from public.clients c
      where c.id = client_dados_snapshots.client_id and c.assessor_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261122000000_painel_dados.sql
git commit -m "feat(dados): migration — conexões GA4/GSC e snapshots do painel"
```

---

### Task 2: Acesso

**Files:**
- Create: `src/lib/dados/access.ts`
- Test: `src/lib/dados/access.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import { canAccessDados, dadosVeTodos, podeEditarConexoes } from "./access";

describe("dados/access", () => {
  it("quem acessa", () => {
    for (const r of ["adm", "socio", "programacao", "assessor"]) expect(canAccessDados(r)).toBe(true);
    for (const r of ["comercial", "videomaker", "designer", "coordenador"]) expect(canAccessDados(r)).toBe(false);
  });
  it("quem vê todos", () => {
    expect(dadosVeTodos("adm")).toBe(true);
    expect(dadosVeTodos("programacao")).toBe(true);
    expect(dadosVeTodos("assessor")).toBe(false);
  });
  it("quem edita conexões", () => {
    expect(podeEditarConexoes("socio")).toBe(true);
    expect(podeEditarConexoes("assessor")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dados/access.test.ts --exclude '**/.claude/**'`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

```ts
/**
 * Acesso ao painel /dados. FONTE ÚNICA — página, menu e actions.
 * Chefia + programação veem todos os clientes; assessor só a própria carteira.
 */
export const DADOS_TODOS_ROLES = ["adm", "socio", "programacao"] as const;
export const DADOS_ROLES = [...DADOS_TODOS_ROLES, "assessor"] as const;

export function canAccessDados(role: string): boolean {
  return (DADOS_ROLES as readonly string[]).includes(role);
}
export function dadosVeTodos(role: string): boolean {
  return (DADOS_TODOS_ROLES as readonly string[]).includes(role);
}
export function podeEditarConexoes(role: string): boolean {
  return dadosVeTodos(role);
}
```

- [ ] **Step 4: Rodar e ver passar**, depois commit

```bash
npx vitest run src/lib/dados/access.test.ts --exclude '**/.claude/**'
git add src/lib/dados/access.ts src/lib/dados/access.test.ts
git commit -m "feat(dados): regras de acesso"
```

---

### Task 3: Tipos e período

**Files:**
- Create: `src/lib/dados/tipos.ts`
- Create: `src/lib/dados/periodo.ts`
- Test: `src/lib/dados/periodo.test.ts`

- [ ] **Step 1: `tipos.ts`**

```ts
export const CANAIS = ["site", "google", "gmn", "instagram", "facebook", "anuncios", "ecommerce", "crm"] as const;
export type CanalId = (typeof CANAIS)[number];

export type StatusCanal = "ok" | "fraco" | "ausente" | "sem_acesso" | "nao_se_aplica";
export type Gravidade = "alta" | "media";

export type Metricas = Record<string, number | string | null>;

export interface ResultadoCanal {
  status: StatusCanal;
  /** Frase curta: motivo do status (vira a perda quando fraco/ausente). */
  motivo: string | null;
  metricas: Metricas;
}

export interface Perda { canal: CanalId; gravidade: Gravidade; texto: string }

export type CanaisResultado = Record<CanalId, ResultadoCanal>;

export interface SnapshotDados {
  nota: number | null;
  canais: CanaisResultado;
  perdas: Perda[];
}

export interface Periodo { de: string; ate: string } // YYYY-MM-DD

export const CANAL_LABEL: Record<CanalId, string> = {
  site: "Site",
  google: "Google busca",
  gmn: "Google Meu Negócio",
  instagram: "Instagram",
  facebook: "Facebook",
  anuncios: "Anúncios",
  ecommerce: "E-commerce",
  crm: "CRM",
};
```

- [ ] **Step 2: Teste do período**

```ts
import { describe, expect, it } from "vitest";
import { periodoPadrao, periodoAnterior, diasEntre } from "./periodo";

describe("dados/periodo", () => {
  it("padrão = 30 dias terminando ontem", () => {
    expect(periodoPadrao(new Date("2026-11-22T12:00:00-03:00"))).toEqual({ de: "2026-10-22", ate: "2026-11-20" });
  });
  it("anterior tem o mesmo tamanho", () => {
    expect(periodoAnterior({ de: "2026-10-22", ate: "2026-11-20" })).toEqual({ de: "2026-09-22", ate: "2026-10-21" });
  });
  it("dias entre", () => {
    expect(diasEntre(new Date("2026-11-18T10:00:00Z"), new Date("2026-11-22T10:00:00Z"))).toBe(4);
  });
});
```

- [ ] **Step 3: Implementar `periodo.ts`**

```ts
import type { Periodo } from "./tipos";

const DIA = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD no fuso de São Paulo. */
export function ymdSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}
function addDias(ymd: string, n: number): string {
  const t = new Date(`${ymd}T12:00:00Z`).getTime() + n * DIA;
  return new Date(t).toISOString().slice(0, 10);
}

/** 30 dias completos terminando ontem (hoje ainda está incompleto). */
export function periodoPadrao(agora: Date = new Date()): Periodo {
  const ontem = addDias(ymdSP(agora), -1);
  return { de: addDias(ontem, -29), ate: ontem };
}

export function periodoAnterior(p: Periodo): Periodo {
  const dur = Math.round((new Date(`${p.ate}T12:00:00Z`).getTime() - new Date(`${p.de}T12:00:00Z`).getTime()) / DIA);
  const ate = addDias(p.de, -1);
  return { de: addDias(ate, -dur), ate };
}

export function diasEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DIA);
}
```

- [ ] **Step 4: Rodar, passar e commitar**

```bash
npx vitest run src/lib/dados/periodo.test.ts --exclude '**/.claude/**'
git add src/lib/dados/tipos.ts src/lib/dados/periodo.ts src/lib/dados/periodo.test.ts
git commit -m "feat(dados): tipos e período"
```

---

### Task 4: Regras por canal

**Files:**
- Create: `src/lib/dados/regras.ts`
- Test: `src/lib/dados/regras.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import {
  avaliarSite, avaliarGoogle, avaliarGmn, avaliarRede, avaliarAnuncios, avaliarEcommerce, avaliarCrm,
} from "./regras";

const agora = new Date("2026-11-22T12:00:00Z");

describe("dados/regras", () => {
  it("site", () => {
    expect(avaliarSite({ temSite: false }).status).toBe("ausente");
    expect(avaliarSite({ temSite: true, dados: null }).status).toBe("sem_acesso");
    expect(avaliarSite({ temSite: true, dados: { sessoes: 80, sessoesAnt: 70 } }).status).toBe("fraco");
    const queda = avaliarSite({ temSite: true, dados: { sessoes: 700, sessoesAnt: 1000 } });
    expect(queda.status).toBe("fraco");
    expect(queda.motivo).toBe("Site perdeu 30% das visitas");
    expect(avaliarSite({ temSite: true, dados: { sessoes: 1000, sessoesAnt: 1000 } }).status).toBe("ok");
  });

  it("google busca", () => {
    expect(avaliarGoogle({ temSite: true, dados: { cliques: 100, cliquesAnt: 100, posicao: 25 } }).status).toBe("fraco");
    expect(avaliarGoogle({ temSite: true, dados: { cliques: 79, cliquesAnt: 100, posicao: 8 } }).motivo)
      .toBe("Cliques vindos do Google caíram 21%");
    expect(avaliarGoogle({ temSite: true, dados: { cliques: 100, cliquesAnt: 90, posicao: 8 } }).status).toBe("ok");
  });

  it("gmn", () => {
    expect(avaliarGmn({ temPerfil: false, nota: null, avaliacoes: null, avaliacoesAnt: null }).status).toBe("ausente");
    expect(avaliarGmn({ temPerfil: true, nota: 4.1, avaliacoes: 50, avaliacoesAnt: 40 }).status).toBe("fraco");
    expect(avaliarGmn({ temPerfil: true, nota: 4.8, avaliacoes: 50, avaliacoesAnt: 50 }).motivo)
      .toBe("Nenhuma avaliação nova no Google");
    expect(avaliarGmn({ temPerfil: true, nota: 4.8, avaliacoes: 52, avaliacoesAnt: 50 }).status).toBe("ok");
  });

  it("instagram/facebook: mais de 3 dias sem post = fraco", () => {
    expect(avaliarRede("Instagram", { temPerfil: false }, agora).status).toBe("ausente");
    expect(avaliarRede("Instagram", { temPerfil: true, dados: null }, agora).status).toBe("sem_acesso");
    const r = avaliarRede("Instagram", { temPerfil: true, dados: { ultimoPost: "2026-11-18T10:00:00Z", postsPeriodo: 9 } }, agora);
    expect(r.status).toBe("fraco");
    expect(r.motivo).toBe("Sem post no Instagram há 4 dias");
    expect(avaliarRede("Facebook", { temPerfil: true, dados: { ultimoPost: "2026-11-20T10:00:00Z", postsPeriodo: 9 } }, agora).status).toBe("ok");
    expect(avaliarRede("Facebook", { temPerfil: true, dados: { ultimoPost: null, postsPeriodo: 0 } }, agora).motivo)
      .toBe("Nenhum post no Facebook");
  });

  it("anúncios", () => {
    expect(avaliarAnuncios({ temConta: false }).status).toBe("ausente");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 0, gasto7d: 0, cliques: 0, impressoes: 0 } }).status).toBe("ausente");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 500, gasto7d: 0, cliques: 10, impressoes: 900 } }).status).toBe("fraco");
    expect(avaliarAnuncios({ temConta: true, dados: { gasto: 500, gasto7d: 80, cliques: 10, impressoes: 900 } }).status).toBe("ok");
  });

  it("e-commerce", () => {
    expect(avaliarEcommerce({ aplica: false, anuncios: 0, anunciosAnt: 0 }).status).toBe("nao_se_aplica");
    expect(avaliarEcommerce({ aplica: true, anuncios: 0, anunciosAnt: 3 }).status).toBe("fraco");
    expect(avaliarEcommerce({ aplica: true, anuncios: 7, anunciosAnt: 10 }).status).toBe("fraco");
    expect(avaliarEcommerce({ aplica: true, anuncios: 9, anunciosAnt: 10 }).status).toBe("ok");
  });

  it("crm", () => {
    expect(avaliarCrm({ crmTipo: null }).status).toBe("ausente");
    expect(avaliarCrm({ crmTipo: "nenhum" }).status).toBe("ausente");
    expect(avaliarCrm({ crmTipo: "hubspot" }).status).toBe("sem_acesso");
    expect(avaliarCrm({ crmTipo: "yide", dados: null }).status).toBe("sem_acesso");
    const base = { leadsNovos: 20, vendas: 2, valorVendas: 1000, conversao: 0.1, semResposta24h: 0, origens: {} };
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: base, anterior: base } }).status).toBe("ok");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, semResposta24h: 6 }, anterior: base } }).motivo)
      .toBe("6 leads sem resposta há mais de 24h");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, vendas: 0 }, anterior: base } }).motivo)
      .toBe("Nenhuma venda registrada no período");
    expect(avaliarCrm({ crmTipo: "yide", dados: { atual: { ...base, leadsNovos: 10 }, anterior: base } }).motivo)
      .toBe("Leads novos caíram 50%");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dados/regras.test.ts --exclude '**/.claude/**'`
Expected: FAIL

- [ ] **Step 3: Implementar `regras.ts`**

```ts
import type { ResultadoCanal } from "./tipos";
import { diasEntre } from "./periodo";

/** Limites ajustáveis — fonte única. */
export const LIMITES = {
  quedaFraco: 0.2,          // queda ≥ 20% vs período anterior
  sessoesMinimas: 100,      // site com menos que isso no período = fraco
  posicaoMaxima: 20,        // posição média no Google acima disso = fraco
  notaGmnMinima: 4.3,
  diasSemPost: 3,           // Instagram/Facebook: último post há mais de 3 dias = fraco
  semRespostaMax: 5,        // CRM: 5+ leads sem resposta há 24h = fraco
} as const;

const r = (status: ResultadoCanal["status"], motivo: string | null, metricas: ResultadoCanal["metricas"] = {}): ResultadoCanal =>
  ({ status, motivo, metricas });

/** Queda relativa (0..1). Sem base anterior = 0. */
export function queda(atual: number, anterior: number): number {
  if (anterior <= 0) return 0;
  return Math.max(0, (anterior - atual) / anterior);
}
const pct = (q: number) => `${Math.round(q * 100)}%`;

export function avaliarSite(i: { temSite: boolean; dados?: { sessoes: number; sessoesAnt: number } | null }): ResultadoCanal {
  if (!i.temSite) return r("ausente", "Cliente não tem site");
  if (!i.dados) return r("sem_acesso", "Google Analytics não conectado");
  const m = { sessoes: i.dados.sessoes, sessoesAnt: i.dados.sessoesAnt };
  const q = queda(i.dados.sessoes, i.dados.sessoesAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Site perdeu ${pct(q)} das visitas`, m);
  if (i.dados.sessoes < LIMITES.sessoesMinimas) return r("fraco", `Site com só ${i.dados.sessoes} visitas no período`, m);
  return r("ok", null, m);
}

export function avaliarGoogle(i: { temSite: boolean; dados?: { cliques: number; cliquesAnt: number; posicao: number | null } | null }): ResultadoCanal {
  if (!i.temSite) return r("ausente", "Sem site, não aparece na busca do Google");
  if (!i.dados) return r("sem_acesso", "Search Console não conectado");
  const m = { cliques: i.dados.cliques, cliquesAnt: i.dados.cliquesAnt, posicao: i.dados.posicao };
  const q = queda(i.dados.cliques, i.dados.cliquesAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Cliques vindos do Google caíram ${pct(q)}`, m);
  if (i.dados.posicao != null && i.dados.posicao > LIMITES.posicaoMaxima)
    return r("fraco", `Posição média no Google: ${Math.round(i.dados.posicao)}ª (fora da 1ª página)`, m);
  return r("ok", null, m);
}

export function avaliarGmn(i: { temPerfil: boolean; nota: number | null; avaliacoes: number | null; avaliacoesAnt: number | null }): ResultadoCanal {
  if (!i.temPerfil) return r("ausente", "Não aparece no Google Maps");
  const m = { nota: i.nota, avaliacoes: i.avaliacoes, avaliacoesNovas: i.avaliacoes != null && i.avaliacoesAnt != null ? i.avaliacoes - i.avaliacoesAnt : null };
  if (i.nota != null && i.nota < LIMITES.notaGmnMinima) return r("fraco", `Nota no Google baixa (${i.nota.toFixed(1)})`, m);
  if (i.avaliacoes != null && i.avaliacoesAnt != null && i.avaliacoes <= i.avaliacoesAnt)
    return r("fraco", "Nenhuma avaliação nova no Google", m);
  return r("ok", null, m);
}

export function avaliarRede(
  nome: "Instagram" | "Facebook",
  i: { temPerfil: boolean; dados?: { ultimoPost: string | null; postsPeriodo: number } | null },
  agora: Date = new Date(),
): ResultadoCanal {
  if (!i.temPerfil) return r("ausente", `Cliente não tem ${nome}`);
  if (!i.dados) return r("sem_acesso", `${nome} não conectado`);
  const m = { ultimoPost: i.dados.ultimoPost, postsPeriodo: i.dados.postsPeriodo };
  if (!i.dados.ultimoPost) return r("fraco", `Nenhum post no ${nome}`, m);
  const dias = diasEntre(new Date(i.dados.ultimoPost), agora);
  if (dias > LIMITES.diasSemPost) return r("fraco", `Sem post no ${nome} há ${dias} dias`, m);
  return r("ok", null, m);
}

export function avaliarAnuncios(i: { temConta: boolean; dados?: { gasto: number; gasto7d: number; cliques: number; impressoes: number } | null }): ResultadoCanal {
  if (!i.temConta) return r("ausente", "Sem anúncios rodando");
  if (!i.dados) return r("sem_acesso", "Conta de anúncios sem acesso");
  const m = { ...i.dados };
  if (i.dados.gasto <= 0) return r("ausente", "Sem anúncios rodando", m);
  if (i.dados.gasto7d <= 0) return r("fraco", "Anúncios parados nos últimos 7 dias", m);
  return r("ok", null, m);
}

export function avaliarEcommerce(i: { aplica: boolean; anuncios: number; anunciosAnt: number }): ResultadoCanal {
  if (!i.aplica) return r("nao_se_aplica", null);
  const m = { anuncios: i.anuncios, anunciosAnt: i.anunciosAnt };
  if (i.anuncios === 0) return r("fraco", "Nenhum anúncio novo nos marketplaces", m);
  const q = queda(i.anuncios, i.anunciosAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Anúncios novos nos marketplaces caíram ${pct(q)}`, m);
  return r("ok", null, m);
}

export interface ResumoCrm {
  leadsNovos: number; vendas: number; valorVendas: number; conversao: number | null;
  semResposta24h: number; origens: Record<string, number>;
}

export function avaliarCrm(i: { crmTipo: string | null; dados?: { atual: ResumoCrm; anterior: ResumoCrm } | null }): ResultadoCanal {
  if (!i.crmTipo || i.crmTipo === "nenhum") return r("ausente", "Cliente não usa CRM: leads se perdem");
  if (i.crmTipo !== "yide") return r("sem_acesso", "CRM fora do Lyide (sem leitura)");
  if (!i.dados) return r("sem_acesso", "Lyide não conectado");
  const { atual, anterior } = i.dados;
  const m = {
    leadsNovos: atual.leadsNovos, leadsNovosAnt: anterior.leadsNovos, vendas: atual.vendas,
    valorVendas: atual.valorVendas, conversao: atual.conversao, semResposta24h: atual.semResposta24h,
    origens: JSON.stringify(atual.origens),
  };
  if (atual.semResposta24h >= LIMITES.semRespostaMax) return r("fraco", `${atual.semResposta24h} leads sem resposta há mais de 24h`, m);
  if (atual.leadsNovos === 0) return r("fraco", "Nenhum lead novo no período", m);
  const q = queda(atual.leadsNovos, anterior.leadsNovos);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Leads novos caíram ${pct(q)}`, m);
  if (atual.vendas === 0) return r("fraco", "Nenhuma venda registrada no período", m);
  return r("ok", null, m);
}
```

- [ ] **Step 4: Rodar, passar e commitar**

```bash
npx vitest run src/lib/dados/regras.test.ts --exclude '**/.claude/**'
git add src/lib/dados/regras.ts src/lib/dados/regras.test.ts
git commit -m "feat(dados): regras de status por canal"
```

---

### Task 5: Nota de presença e perdas

**Files:**
- Create: `src/lib/dados/nota.ts`
- Test: `src/lib/dados/nota.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import { calcularNota, faixaNota, listarPerdas, cobertura } from "./nota";
import type { CanaisResultado, ResultadoCanal } from "./tipos";

const c = (status: ResultadoCanal["status"], motivo: string | null = null): ResultadoCanal => ({ status, motivo, metricas: {} });
const base = (): CanaisResultado => ({
  site: c("ok"), google: c("ok"), gmn: c("ok"), instagram: c("ok"),
  facebook: c("ok"), anuncios: c("ok"), ecommerce: c("nao_se_aplica"), crm: c("ok"),
});

describe("dados/nota", () => {
  it("tudo ok = 100", () => expect(calcularNota(base())).toBe(100));
  it("fraco vale metade, ausente zero", () => {
    const k = base();
    k.instagram = c("fraco");   // 20 → 10
    k.anuncios = c("ausente");  // 15 → 0
    expect(calcularNota(k)).toBe(75); // (100-10-15)/100
  });
  it("sem_acesso sai da conta", () => {
    const k = base();
    k.site = c("sem_acesso"); k.google = c("sem_acesso");
    k.crm = c("ausente"); // 10 de 70 → 60/70
    expect(calcularNota(k)).toBe(86);
  });
  it("nada medível = null", () => {
    const k = base();
    for (const key of Object.keys(k) as Array<keyof CanaisResultado>) k[key] = c("sem_acesso");
    expect(calcularNota(k)).toBeNull();
  });
  it("faixas", () => {
    expect(faixaNota(49)).toBe("risco");
    expect(faixaNota(50)).toBe("atencao");
    expect(faixaNota(75)).toBe("bom");
    expect(faixaNota(null)).toBe("sem_dados");
  });
  it("perdas: ausente = alta, fraco = média, alta primeiro e por peso", () => {
    const k = base();
    k.facebook = c("fraco", "Sem post no Facebook há 5 dias");
    k.gmn = c("ausente", "Não aparece no Google Maps");
    k.instagram = c("fraco", "Sem post no Instagram há 4 dias");
    k.site = c("sem_acesso", "Google Analytics não conectado");
    expect(listarPerdas(k)).toEqual([
      { canal: "gmn", gravidade: "alta", texto: "Não aparece no Google Maps" },
      { canal: "instagram", gravidade: "media", texto: "Sem post no Instagram há 4 dias" },
      { canal: "facebook", gravidade: "media", texto: "Sem post no Facebook há 5 dias" },
    ]);
  });
  it("cobertura conta canais lidos sobre aplicáveis", () => {
    const k = base();
    k.site = c("sem_acesso");
    expect(cobertura([k])).toEqual({ lidos: 6, total: 7 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**, depois implementar `nota.ts`

```ts
import { CANAIS, type CanaisResultado, type CanalId, type Perda } from "./tipos";

export const PESOS: Record<CanalId, number> = {
  site: 15, google: 15, gmn: 15, instagram: 20, facebook: 10, anuncios: 15, ecommerce: 10, crm: 10,
};
const FATOR = { ok: 1, fraco: 0.5, ausente: 0 } as const;

export function calcularNota(canais: CanaisResultado): number | null {
  let soma = 0, pesos = 0;
  for (const id of CANAIS) {
    const st = canais[id].status;
    if (st === "sem_acesso" || st === "nao_se_aplica") continue;
    soma += PESOS[id] * FATOR[st];
    pesos += PESOS[id];
  }
  return pesos === 0 ? null : Math.round((soma / pesos) * 100);
}

export type Faixa = "risco" | "atencao" | "bom" | "sem_dados";
export function faixaNota(n: number | null): Faixa {
  if (n == null) return "sem_dados";
  if (n < 50) return "risco";
  if (n < 75) return "atencao";
  return "bom";
}

export function listarPerdas(canais: CanaisResultado): Perda[] {
  const perdas: Perda[] = [];
  for (const id of CANAIS) {
    const { status, motivo } = canais[id];
    if (status === "ausente") perdas.push({ canal: id, gravidade: "alta", texto: motivo ?? "Sem presença" });
    else if (status === "fraco") perdas.push({ canal: id, gravidade: "media", texto: motivo ?? "Fraco ou parado" });
  }
  return perdas.sort((a, b) =>
    a.gravidade === b.gravidade ? PESOS[b.canal] - PESOS[a.canal] : a.gravidade === "alta" ? -1 : 1);
}

/** Canais com leitura (não sem_acesso) sobre canais aplicáveis, somando vários clientes. */
export function cobertura(lista: CanaisResultado[]): { lidos: number; total: number } {
  let lidos = 0, total = 0;
  for (const canais of lista) for (const id of CANAIS) {
    const st = canais[id].status;
    if (st === "nao_se_aplica") continue;
    total++;
    if (st !== "sem_acesso") lidos++;
  }
  return { lidos, total };
}
```

Nota sobre o teste de perdas: Instagram (peso 20) vem antes de Facebook (10). Os dois são "media".

- [ ] **Step 3: Rodar, passar e commitar**

```bash
npx vitest run src/lib/dados/nota.test.ts --exclude '**/.claude/**'
git add src/lib/dados/nota.ts src/lib/dados/nota.test.ts
git commit -m "feat(dados): nota de presença, faixas, perdas e cobertura"
```

---

### Task 6: Token do Google (conta de serviço)

**Files:**
- Create: `src/lib/dados/google-auth.ts`
- Test: `src/lib/dados/google-auth.test.ts`

- [ ] **Step 1: Teste (monta e assina o JWT com uma chave gerada no teste)**

```ts
import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { montarAssertion, lerServiceAccount } from "./google-auth";

describe("dados/google-auth", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("lê a env JSON", () => {
    expect(lerServiceAccount(undefined)).toBeNull();
    expect(lerServiceAccount("{}")).toBeNull();
    expect(lerServiceAccount(JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: pem })))
      .toEqual({ clientEmail: "a@b.iam.gserviceaccount.com", privateKey: pem });
  });

  it("assina RS256 com escopo e audiência certos", () => {
    const jwt = montarAssertion({ clientEmail: "a@b", privateKey: pem }, ["s1", "s2"], 1_700_000_000);
    const [h, p, s] = jwt.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toEqual({ iss: "a@b", scope: "s1 s2", aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Implementar**

```ts
// SERVER ONLY
import "server-only";
import { createSign } from "node:crypto";

/**
 * Token OAuth da conta de serviço (a mesma do ads-manager) pra ler GA4,
 * Search Console e Analytics Admin. Env: GOOGLE_SERVICE_ACCOUNT_JSON (JSON inteiro).
 */
export const SCOPES_DADOS = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

export interface ServiceAccount { clientEmail: string; privateKey: string }

export function lerServiceAccount(raw: string | undefined = process.env.GOOGLE_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!j.client_email || !j.private_key) return null;
    return { clientEmail: j.client_email, privateKey: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function montarAssertion(sa: ServiceAccount, scopes: string[], agoraSeg = Math.floor(Date.now() / 1000)): string {
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iss: sa.clientEmail, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: agoraSeg, exp: agoraSeg + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let cache: { token: string; expira: number } | null = null;

/** null = conta de serviço não configurada ou falha na troca. Cache em memória ~55min. */
export async function getGoogleToken(): Promise<string | null> {
  if (cache && cache.expira > Date.now()) return cache.token;
  const sa = lerServiceAccount();
  if (!sa) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: montarAssertion(sa, SCOPES_DADOS) }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[dados/google-auth] token HTTP", res.status); return null; }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cache = { token: j.access_token, expira: Date.now() + (j.expires_in - 300) * 1000 };
    return j.access_token;
  } catch (e) {
    console.error("[dados/google-auth]", e);
    return null;
  }
}

export function emailContaServico(): string | null {
  return lerServiceAccount()?.clientEmail ?? null;
}
```

- [ ] **Step 3: Rodar, passar e commitar**

```bash
npx vitest run src/lib/dados/google-auth.test.ts --exclude '**/.claude/**'
git add src/lib/dados/google-auth.ts src/lib/dados/google-auth.test.ts
git commit -m "feat(dados): token Google da conta de serviço sem dependência nova"
```

---

### Task 7: Coletores

**Files:**
- Create: `src/lib/dados/coletores/google.ts`
- Create: `src/lib/dados/coletores/meta.ts`
- Create: `src/lib/dados/coletores/lyide.ts`
- Create: `src/lib/dados/coletores/locais.ts`

Regra comum: todo coletor devolve `null` quando não consegue ler (sem configuração, erro de HTTP ou exceção) e loga com `console.error("[dados/<fonte>] ...")`. Ele nunca lança erro. Todo `fetch` usa `cache: "no-store"` e `signal: AbortSignal.timeout(8000)`.

- [ ] **Step 1: `google.ts`**

```ts
// SERVER ONLY
import "server-only";
import { getGoogleToken } from "../google-auth";
import type { Periodo } from "../tipos";

async function gpost<T>(url: string, body: unknown): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error("[dados/google] POST", url.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", e); return null; }
}
async function gget<T>(url: string): Promise<T | null> {
  const token = await getGoogleToken();
  if (!token) return null;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.error("[dados/google] GET", url.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/google]", e); return null; }
}

/** Sessões no período e no anterior (2 dateRanges num relatório só). */
export async function coletarGa4(propertyId: string, atual: Periodo, anterior: Periodo) {
  const j = await gpost<{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      dateRanges: [
        { startDate: atual.de, endDate: atual.ate, name: "atual" },
        { startDate: anterior.de, endDate: anterior.ate, name: "anterior" },
      ],
      metrics: [{ name: "sessions" }],
    },
  );
  if (!j) return null;
  let sessoes = 0, sessoesAnt = 0;
  for (const row of j.rows ?? []) {
    const v = Number(row.metricValues[0]?.value ?? 0);
    if (row.dimensionValues[0]?.value === "anterior") sessoesAnt += v; else sessoes += v;
  }
  return { sessoes, sessoesAnt };
}

/** Cliques e posição média no período + cliques no anterior. */
export async function coletarGsc(siteUrl: string, atual: Periodo, anterior: Periodo) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  type R = { rows?: Array<{ clicks: number; position: number }> };
  const [a, b] = await Promise.all([
    gpost<R>(url, { startDate: atual.de, endDate: atual.ate }),
    gpost<R>(url, { startDate: anterior.de, endDate: anterior.ate }),
  ]);
  if (!a || !b) return null;
  return {
    cliques: a.rows?.[0]?.clicks ?? 0,
    cliquesAnt: b.rows?.[0]?.clicks ?? 0,
    posicao: a.rows?.[0]?.position ?? null,
  };
}

/** Opções para o cartão de conexões. */
export async function listarPropriedadesGa4(): Promise<Array<{ id: string; nome: string }>> {
  const j = await gget<{ accountSummaries?: Array<{ displayName: string; propertySummaries?: Array<{ property: string; displayName: string }> }> }>(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
  );
  return (j?.accountSummaries ?? []).flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({ id: p.property.replace("properties/", ""), nome: `${a.displayName} — ${p.displayName}` })));
}
export async function listarSitesGsc(): Promise<string[]> {
  const j = await gget<{ siteEntry?: Array<{ siteUrl: string }> }>("https://www.googleapis.com/webmasters/v3/sites");
  return (j?.siteEntry ?? []).map((s) => s.siteUrl).sort();
}
```

**Atenção:** quando há 2 `dateRanges`, o GA4 adiciona sozinho a dimensão `dateRange` com o `name` de cada range. É isso que o laço lê em `dimensionValues[0]`.

- [ ] **Step 2: `meta.ts`**

```ts
// SERVER ONLY
import "server-only";
import type { Periodo } from "../tipos";

/**
 * Leitura via System User Token da BM Yide. Env: META_SYSTEM_USER_TOKEN
 * (só leitura; a coleta antiga foi removida no #988, este é o substituto enxuto).
 */
const V = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
const BASE = `https://graph.facebook.com/${V}`;

async function graph<T>(path: string, params: Record<string, string>, token = process.env.META_SYSTEM_USER_TOKEN?.trim()): Promise<T | null> {
  if (!token) return null;
  try {
    const qs = new URLSearchParams({ ...params, access_token: token });
    const res = await fetch(`${BASE}/${path}?${qs.toString()}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.error("[dados/meta]", path.split("/")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/meta]", e); return null; }
}

function contarNoPeriodo(datas: string[], p: Periodo): number {
  const de = new Date(`${p.de}T00:00:00-03:00`).getTime();
  const ate = new Date(`${p.ate}T23:59:59-03:00`).getTime();
  return datas.filter((d) => { const t = new Date(d).getTime(); return t >= de && t <= ate; }).length;
}

export async function coletarInstagram(igId: string, p: Periodo) {
  const j = await graph<{ data: Array<{ timestamp: string }> }>(`${igId}/media`, { fields: "timestamp", limit: "50" });
  if (!j) return null;
  const datas = j.data.map((m) => m.timestamp);
  return { ultimoPost: datas[0] ?? null, postsPeriodo: contarNoPeriodo(datas, p) };
}

export async function coletarFacebook(pageId: string, p: Periodo) {
  const page = await graph<{ access_token?: string }>(pageId, { fields: "access_token" });
  if (!page?.access_token) return null;
  const j = await graph<{ data: Array<{ created_time: string }> }>(`${pageId}/published_posts`, { fields: "created_time", limit: "50" }, page.access_token);
  if (!j) return null;
  const datas = j.data.map((m) => m.created_time);
  return { ultimoPost: datas[0] ?? null, postsPeriodo: contarNoPeriodo(datas, p) };
}

export async function coletarAnuncios(adAccountId: string, p: Periodo, ultimos7: Periodo) {
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  type R = { data: Array<{ spend?: string; clicks?: string; impressions?: string }> };
  const [a, b] = await Promise.all([
    graph<R>(`${act}/insights`, { fields: "spend,clicks,impressions", time_range: JSON.stringify({ since: p.de, until: p.ate }) }),
    graph<R>(`${act}/insights`, { fields: "spend", time_range: JSON.stringify({ since: ultimos7.de, until: ultimos7.ate }) }),
  ]);
  if (!a || !b) return null;
  return {
    gasto: Number(a.data[0]?.spend ?? 0),
    cliques: Number(a.data[0]?.clicks ?? 0),
    impressoes: Number(a.data[0]?.impressions ?? 0),
    gasto7d: Number(b.data[0]?.spend ?? 0),
  };
}
```

- [ ] **Step 3: `lyide.ts`**

```ts
// SERVER ONLY
import "server-only";
import type { ResumoCrm } from "../regras";
import type { Periodo } from "../tipos";

/** Mesma env do /conversas: LYIDE_API_URL + LYIDE_API_SECRET. Endpoints da Parte 1. */
function cfg() {
  const url = process.env.LYIDE_API_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.LYIDE_API_SECRET?.trim();
  return url && secret ? { url, secret } : null;
}
async function lget<T>(path: string): Promise<T | null> {
  const c = cfg();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}${path}`, { headers: { authorization: `Bearer ${c.secret}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.error("[dados/lyide]", path.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/lyide]", e); return null; }
}

export async function coletarCrmLyide(slug: string, p: Periodo): Promise<{ atual: ResumoCrm; anterior: ResumoCrm } | null> {
  const qs = new URLSearchParams({ de: p.de, ate: p.ate });
  const j = await lget<{ atual: ResumoCrm; anterior: ResumoCrm }>(`/api/external/empresas/${encodeURIComponent(slug)}/resumo?${qs.toString()}`);
  return j ? { atual: j.atual, anterior: j.anterior } : null;
}

export async function listarEmpresasLyide(): Promise<Array<{ slug: string; name: string }>> {
  const j = await lget<{ empresas: Array<{ slug: string; name: string }> }>("/api/external/empresas");
  return j?.empresas ?? [];
}
```

- [ ] **Step 4: `locais.ts` (GMN e e-commerce, do próprio banco)**

```ts
// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listPublicadosYideEcom } from "@/lib/ecommerce/yideecom";
import { normalizarNome } from "@/lib/ecommerce/yideecom-match";
import type { Periodo } from "../tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createServiceRoleClient() as any;

/** Total de avaliações no começo do período (snapshot mais próximo antes de `de`). */
export async function avaliacoesGmnNoInicio(clientId: string, p: Periodo): Promise<number | null> {
  const { data } = await sb()
    .from("client_gmb_snapshots")
    .select("review_count")
    .eq("client_id", clientId)
    .lte("captured_at", `${p.de}T23:59:59-03:00`)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { review_count: number | null } | null)?.review_count ?? null;
}

/** Anúncios publicados (manuais + Yide Ecom) no período e no anterior. */
/** Yide Ecom identifica o cliente pelo nome (mesmo critério de casarPublicados em /ecommerce). */
export async function contarAnunciosEcommerce(clientId: string, clientNome: string, atual: Periodo, anterior: Periodo) {
  const contarManuais = async (p: Periodo) => {
    const { data } = await sb()
      .from("anuncios_ecommerce").select("quantidade")
      .eq("client_id", clientId).is("arquivado_em", null)
      .gte("data", p.de).lte("data", p.ate);
    return ((data ?? []) as Array<{ quantidade: number }>).reduce((s, r) => s + r.quantidade, 0);
  };
  const [m1, m2, ecom] = await Promise.all([contarManuais(atual), contarManuais(anterior), listPublicadosYideEcom(anterior.de, atual.ate)]);
  let e1 = 0, e2 = 0;
  if (ecom.ok) {
    const alvo = normalizarNome(clientNome);
    for (const pub of ecom.publicados) {
      if (normalizarNome(pub.cliente_nome) !== alvo) continue;
      if (pub.data >= atual.de && pub.data <= atual.ate) e1 += pub.quantidade;
      else if (pub.data >= anterior.de && pub.data <= anterior.ate) e2 += pub.quantidade;
    }
  }
  return { anuncios: m1 + e1, anunciosAnt: m2 + e2 };
}
```

`PublicadoYideEcom` = `{ cliente_id, cliente_nome, data, marketplace, quantidade }`. O `cliente_id` é o id do **Yide Ecom**, não o nosso. Por isso o casamento é pelo nome normalizado.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/dados/coletores
git commit -m "feat(dados): coletores Google, Meta, Lyide e dados locais"
```

---

### Task 8: Orquestrador + snapshot

**Files:**
- Create: `src/lib/dados/calcular.ts`

- [ ] **Step 1: Implementar**

```ts
// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { avaliarAnuncios, avaliarCrm, avaliarEcommerce, avaliarGmn, avaliarGoogle, avaliarRede, avaliarSite } from "./regras";
import { calcularNota, listarPerdas } from "./nota";
import { periodoAnterior, periodoPadrao } from "./periodo";
import { coletarGa4, coletarGsc } from "./coletores/google";
import { coletarAnuncios, coletarFacebook, coletarInstagram } from "./coletores/meta";
import { coletarCrmLyide } from "./coletores/lyide";
import { avaliacoesGmnNoInicio, contarAnunciosEcommerce } from "./coletores/locais";
import type { CanaisResultado, Periodo, SnapshotDados } from "./tipos";

export const CLIENTE_DADOS_SELECT =
  "id, organization_id, nome, website, instagram_url, instagram_business_id, facebook_page_id, meta_ad_account_id, " +
  "gmb_place_id, gmb_link, gmb_rating, gmb_review_count, crm_tipo, crm_identifier, tipo_pacote, ga4_property_id, gsc_site_url";

export interface ClienteDados {
  id: string; organization_id: string; nome: string; website: string | null;
  instagram_url: string | null; instagram_business_id: string | null; facebook_page_id: string | null;
  meta_ad_account_id: string | null; gmb_place_id: string | null; gmb_link: string | null;
  gmb_rating: number | null; gmb_review_count: number | null; crm_tipo: string | null;
  crm_identifier: string | null; tipo_pacote: string | null; ga4_property_id: string | null; gsc_site_url: string | null;
}

function addDias(ymd: string, n: number): string {
  return new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
const ultimos7 = (p: Periodo): Periodo => ({ de: addDias(p.ate, -6), ate: p.ate });

export async function calcularCliente(c: ClienteDados, periodo: Periodo = periodoPadrao(), agora = new Date()): Promise<SnapshotDados> {
  const ant = periodoAnterior(periodo);
  const temSite = !!c.website?.trim();
  const [ga4, gsc, ig, fb, ads, crm, gmnIni, ecom] = await Promise.all([
    temSite && c.ga4_property_id ? coletarGa4(c.ga4_property_id, periodo, ant) : null,
    temSite && c.gsc_site_url ? coletarGsc(c.gsc_site_url, periodo, ant) : null,
    c.instagram_business_id ? coletarInstagram(c.instagram_business_id, periodo) : null,
    c.facebook_page_id ? coletarFacebook(c.facebook_page_id, periodo) : null,
    c.meta_ad_account_id ? coletarAnuncios(c.meta_ad_account_id, periodo, ultimos7(periodo)) : null,
    c.crm_tipo === "yide" && c.crm_identifier ? coletarCrmLyide(c.crm_identifier, periodo) : null,
    c.gmb_place_id || c.gmb_link ? avaliacoesGmnNoInicio(c.id, periodo) : null,
    c.tipo_pacote === "ecommerce" ? contarAnunciosEcommerce(c.id, c.nome, periodo, ant) : null,
  ]);

  const canais: CanaisResultado = {
    site: avaliarSite({ temSite, dados: ga4 }),
    google: avaliarGoogle({ temSite, dados: gsc }),
    gmn: avaliarGmn({ temPerfil: !!(c.gmb_place_id || c.gmb_link), nota: c.gmb_rating, avaliacoes: c.gmb_review_count, avaliacoesAnt: gmnIni }),
    instagram: avaliarRede("Instagram", { temPerfil: !!(c.instagram_url || c.instagram_business_id), dados: ig }, agora),
    facebook: avaliarRede("Facebook", { temPerfil: !!c.facebook_page_id, dados: fb }, agora),
    anuncios: avaliarAnuncios({ temConta: !!c.meta_ad_account_id, dados: ads }),
    ecommerce: avaliarEcommerce({ aplica: c.tipo_pacote === "ecommerce", anuncios: ecom?.anuncios ?? 0, anunciosAnt: ecom?.anunciosAnt ?? 0 }),
    crm: avaliarCrm({ crmTipo: c.crm_tipo, dados: crm }),
  };
  return { nota: calcularNota(canais), canais, perdas: listarPerdas(canais) };
}

/** Calcula e grava. `nota_anterior` = nota do snapshot anterior mais recente. */
export async function salvarSnapshot(c: ClienteDados): Promise<SnapshotDados> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const periodo = periodoPadrao();
  const snap = await calcularCliente(c, periodo);
  const { data: ultimo } = await sb.from("client_dados_snapshots").select("nota")
    .eq("client_id", c.id).lt("calculado_em", new Date(Date.now() - 20 * 86_400_000).toISOString())
    .order("calculado_em", { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from("client_dados_snapshots").insert({
    organization_id: c.organization_id, client_id: c.id,
    periodo_inicio: periodo.de, periodo_fim: periodo.ate,
    nota: snap.nota, nota_anterior: (ultimo as { nota: number | null } | null)?.nota ?? null,
    canais: snap.canais, perdas: snap.perdas,
  });
  if (error) console.error("[dados/salvarSnapshot]", c.id, error.message);
  return snap;
}
```

A "nota anterior" compara com o snapshot de cerca de 30 dias atrás, que é o que vira a variação "+4 vs mês anterior". Por isso a busca é pelo mais recente com mais de 20 dias.

- [ ] **Step 2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/dados/calcular.ts
git commit -m "feat(dados): orquestrador que calcula e grava o snapshot do cliente"
```

---

### Task 9: Cron diário

**Files:**
- Create: `src/app/api/cron/dados-snapshot/route.ts`
- Modify: `vercel.json` (array `crons`)

- [ ] **Step 1: Rota**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CLIENTE_DADOS_SELECT, salvarSnapshot, type ClienteDados } from "@/lib/dados/calcular";

/**
 * Cron: 1 snapshot do painel Dados por cliente ativo/em onboarding.
 * 7h UTC = 4h SP (depois do refresh-gmb das 6h UTC). Clientes em lotes de 5
 * pra não estourar limite das APIs; erro num cliente não derruba o resto.
 */
export const maxDuration = 300;
const LOTE = 5;

export async function GET(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").select(CLIENTE_DADOS_SELECT)
    .in("status", ["ativo", "em_onboarding"]).is("deleted_at", null);
  if (error) {
    // Migration ainda não aplicada (coluna nova ausente): sai sem erro.
    console.error("[cron/dados-snapshot]", error.message);
    return NextResponse.json({ skipped: error.message });
  }
  const clientes = (data ?? []) as ClienteDados[];
  let ok = 0, falhas = 0;
  for (let i = 0; i < clientes.length; i += LOTE) {
    const res = await Promise.allSettled(clientes.slice(i, i + LOTE).map((c) => salvarSnapshot(c)));
    for (const r of res) r.status === "fulfilled" ? ok++ : falhas++;
  }
  return NextResponse.json({ total: clientes.length, ok, falhas });
}
```

- [ ] **Step 2: `vercel.json`**: adicionar ao array `crons`:

```json
{ "path": "/api/cron/dados-snapshot", "schedule": "0 7 * * *" },
```

- [ ] **Step 3: Typecheck e commit**

```bash
npm run typecheck
git add src/app/api/cron/dados-snapshot/route.ts vercel.json
git commit -m "feat(dados): cron diário de snapshots"
```

---

### Task 10: Queries das páginas

**Files:**
- Create: `src/lib/dados/queries.ts`

- [ ] **Step 1: Implementar**

```ts
// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CurrentUser } from "@/lib/auth/session";
import { CLIENTE_DADOS_SELECT, type ClienteDados } from "./calcular";
import { dadosVeTodos } from "./access";
import type { CanaisResultado, Perda } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createServiceRoleClient() as any;

export interface LinhaDados {
  clientId: string; nome: string; assessorId: string | null; assessorNome: string | null;
  nota: number | null; notaAnterior: number | null; canais: CanaisResultado | null;
  perdas: Perda[]; calculadoEm: string | null;
}

export type VisaoGeral = { ok: true; linhas: LinhaDados[] } | { ok: false; motivo: "sem_tabela" };

/** Clientes visíveis + snapshot mais recente de cada um (1 query por tabela, sem N+1). */
export async function listVisaoGeral(orgId: string, user: CurrentUser): Promise<VisaoGeral> {
  let q = sb().from("clients").select("id, nome, assessor_id")
    .eq("organization_id", orgId).in("status", ["ativo", "em_onboarding"]).is("deleted_at", null).order("nome");
  if (!dadosVeTodos(user.role)) q = q.eq("assessor_id", user.id);
  const { data: clientes, error: e1 } = await q;
  if (e1) { console.error("[dados/listVisaoGeral] clients", e1.message); return { ok: true, linhas: [] }; }
  const ids = ((clientes ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length === 0) return { ok: true, linhas: [] };

  // Snapshots dos últimos 3 dias; fica o mais recente por cliente.
  const desde = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: snaps, error: e2 } = await sb().from("client_dados_snapshots")
    .select("client_id, nota, nota_anterior, canais, perdas, calculado_em")
    .in("client_id", ids).gte("calculado_em", desde).order("calculado_em", { ascending: false });
  if (e2) {
    if (/client_dados_snapshots/.test(e2.message)) return { ok: false, motivo: "sem_tabela" };
    console.error("[dados/listVisaoGeral] snapshots", e2.message);
  }
  const assessorIds = [...new Set(((clientes ?? []) as Array<{ assessor_id: string | null }>).map((c) => c.assessor_id).filter(Boolean))];
  const { data: perfis } = assessorIds.length
    ? await sb().from("profiles").select("id, nome").in("id", assessorIds)
    : { data: [] };
  const nomeAssessor = new Map(((perfis ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));

  const ultimo = new Map<string, Record<string, unknown>>();
  for (const s of (snaps ?? []) as Array<Record<string, unknown>>) if (!ultimo.has(s.client_id as string)) ultimo.set(s.client_id as string, s);

  const linhas = ((clientes ?? []) as Array<Record<string, unknown>>).map((c) => {
    const s = ultimo.get(c.id as string);
    return {
      clientId: c.id as string, nome: c.nome as string, assessorId: (c.assessor_id as string) ?? null,
      assessorNome: nomeAssessor.get(c.assessor_id as string) ?? null,
      nota: (s?.nota as number | null) ?? null, notaAnterior: (s?.nota_anterior as number | null) ?? null,
      canais: (s?.canais as CanaisResultado) ?? null, perdas: (s?.perdas as Perda[]) ?? [],
      calculadoEm: (s?.calculado_em as string) ?? null,
    };
  });
  return { ok: true, linhas };
}

/** Garante que o usuário pode ver o cliente. Devolve a linha do cliente (com conexões) ou null. */
export async function getClienteDados(orgId: string, user: CurrentUser, clientId: string) {
  const { data } = await sb().from("clients").select(`${CLIENTE_DADOS_SELECT}, assessor_id`)
    .eq("id", clientId).eq("organization_id", orgId).is("deleted_at", null).maybeSingle();
  if (!data) return null;
  if (!dadosVeTodos(user.role) && (data as { assessor_id: string | null }).assessor_id !== user.id) return null;
  return data as ClienteDados & { assessor_id: string | null };
}
```

Os nomes dos assessores vêm numa 2ª query, sem embed de FK, porque não há alias confirmado para `clients.assessor_id`. São 3 queries fixas, sem N+1.

- [ ] **Step 2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/dados/queries.ts
git commit -m "feat(dados): queries da visão geral e do cliente"
```

---

### Task 11: Actions (atualizar agora + conexões)

**Files:**
- Create: `src/lib/dados/actions.ts`

- [ ] **Step 1: Implementar**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canAccessDados, podeEditarConexoes } from "./access";
import { getClienteDados } from "./queries";
import { salvarSnapshot } from "./calcular";

type Result = { success: true } | { error: string };

export async function atualizarAgoraAction(clientId: string): Promise<Result> {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) return { error: "Cliente não encontrado" };
  await salvarSnapshot(cliente);
  revalidatePath("/dados");
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}

const conexoesSchema = z.object({
  clientId: z.string().uuid(),
  ga4PropertyId: z.string().regex(/^\d+$/).nullable(),
  gscSiteUrl: z.string().max(300).nullable(),
  lyideSlug: z.string().max(120).nullable(),
});

export async function salvarConexoesAction(input: z.infer<typeof conexoesSchema>): Promise<Result> {
  const user = await requireAuth();
  if (!podeEditarConexoes(user.role)) return { error: "Sem permissão" };
  const parsed = conexoesSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" };
  const orgId = await getOrganizationId(user.id);
  if (!orgId) return { error: "Sem organização" };
  const { clientId, ga4PropertyId, gscSiteUrl, lyideSlug } = parsed.data;

  const patch: Record<string, string | null> = { ga4_property_id: ga4PropertyId, gsc_site_url: gscSiteUrl };
  if (lyideSlug) { patch.crm_tipo = "yide"; patch.crm_identifier = lyideSlug; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("clients").update(patch).eq("id", clientId).eq("organization_id", orgId).select("id");
  if (error) return { error: "Não deu pra salvar. Tente de novo." };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };
  revalidatePath(`/dados/${clientId}`);
  return { success: true };
}
```

`actions.ts` é server-only por definição (`"use server"`). Importar `zod` aqui não pesa no bundle do cliente. Componentes `"use client"` só importam as funções.

- [ ] **Step 2: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/dados/actions.ts
git commit -m "feat(dados): actions atualizar agora e salvar conexões"
```

---

### Task 12: Componentes de UI

**Files:**
- Create: `src/components/dados/CanalIcone.tsx`
- Create: `src/components/dados/NotaBarra.tsx`
- Create: `src/components/dados/ResumoCards.tsx`
- Create: `src/components/dados/TabelaClientes.tsx` (client: busca, filtro de assessor e ordenação)
- Create: `src/components/dados/DadosTabs.tsx`
- Create: `src/components/dados/PerdasLista.tsx`
- Create: `src/components/dados/CanalCards.tsx`
- Create: `src/components/dados/AtualizarAgoraButton.tsx` (client)
- Create: `src/components/dados/ConexoesCard.tsx` (client)

Visual: siga o cabeçalho atual de `src/app/(authed)/programacao/page.tsx` (fundo escuro radial verde-água, `border-white/10`, `rounded-2xl`). Cores de status: verde `emerald`, amarelo `amber`, vermelho `rose`, cinza `white/10` com texto `white/40`. Ícones `lucide-react`: `Globe` (site), `Search` (google), `MapPin` (gmn), `Instagram`, `Facebook`, `Megaphone` (anúncios), `ShoppingCart` (e-commerce), `Users` (CRM).

- [ ] **Step 1: `CanalIcone.tsx`**

```tsx
import { Globe, Search, MapPin, Instagram, Facebook, Megaphone, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { CANAL_LABEL, type CanalId, type ResultadoCanal } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";

const ICONE: Record<CanalId, LucideIcon> = {
  site: Globe, google: Search, gmn: MapPin, instagram: Instagram, facebook: Facebook,
  anuncios: Megaphone, ecommerce: ShoppingCart, crm: Users,
};
const COR: Record<ResultadoCanal["status"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  fraco: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  ausente: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  sem_acesso: "bg-white/5 text-white/35 border-white/10",
  nao_se_aplica: "hidden",
};
const STATUS_LABEL: Record<ResultadoCanal["status"], string> = {
  ok: "Indo bem", fraco: "Fraco ou parado", ausente: "Sem presença", sem_acesso: "Sem acesso ligado", nao_se_aplica: "",
};

export function CanalIcone({ canal, r, size = "md" }: { canal: CanalId; r: ResultadoCanal; size?: "sm" | "md" }) {
  const Icon = ICONE[canal];
  const titulo = `${CANAL_LABEL[canal]}: ${STATUS_LABEL[r.status]}${r.motivo ? ` — ${r.motivo}` : ""}`;
  return (
    <span title={titulo} aria-label={titulo}
      className={cn("inline-flex items-center justify-center rounded-md border", COR[r.status], size === "sm" ? "h-5 w-5" : "h-7 w-7")}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
    </span>
  );
}

export function LegendaStatus() {
  const itens: Array<[ResultadoCanal["status"], string]> = [["ok", "indo bem"], ["fraco", "fraco ou parado"], ["ausente", "sem presença"], ["sem_acesso", "sem acesso ligado"]];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-white/60">
      {itens.map(([s, l]) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded border", COR[s])} />{l}</span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `NotaBarra.tsx`**

```tsx
import { faixaNota } from "@/lib/dados/nota";
import { cn } from "@/lib/utils";

const COR = { risco: "text-rose-300", atencao: "text-amber-300", bom: "text-emerald-300", sem_dados: "text-white/40" };
const BARRA = { risco: "bg-rose-400", atencao: "bg-amber-400", bom: "bg-emerald-400", sem_dados: "bg-white/20" };

export function NotaBarra({ nota, anterior }: { nota: number | null; anterior: number | null }) {
  const f = faixaNota(nota);
  const delta = nota != null && anterior != null ? nota - anterior : null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold tabular-nums", COR[f])}>{nota ?? "—"}</span>
        {delta != null && (
          <span className={cn("text-xs tabular-nums", delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-white/40")}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", BARRA[f])} style={{ width: `${nota ?? 0}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `ResumoCards.tsx`** (servidor)

```tsx
import { TrendingUp, TrendingDown, AlertTriangle, Target, Plug } from "lucide-react";
import { cobertura } from "@/lib/dados/nota";
import type { LinhaDados } from "@/lib/dados/queries";

export function ResumoCards({ linhas }: { linhas: LinhaDados[] }) {
  const comNota = linhas.filter((l) => l.nota != null);
  const media = comNota.length ? Math.round(comNota.reduce((s, l) => s + (l.nota ?? 0), 0) / comNota.length) : null;
  const comAnt = comNota.filter((l) => l.notaAnterior != null);
  const mediaAnt = comAnt.length ? Math.round(comAnt.reduce((s, l) => s + (l.notaAnterior ?? 0), 0) / comAnt.length) : null;
  const delta = media != null && mediaAnt != null ? media - mediaAnt : null;
  const risco = comNota.filter((l) => (l.nota ?? 100) < 50).length;
  const oportunidades = linhas.reduce((s, l) => s + l.perdas.filter((p) => p.gravidade === "alta").length, 0);
  const cob = cobertura(linhas.flatMap((l) => (l.canais ? [l.canais] : [])));
  const cobPct = cob.total ? Math.round((cob.lidos / cob.total) * 100) : 0;

  const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={card}>
        <div className="text-xs uppercase tracking-wide text-white/50">Presença média</div>
        <div className="mt-1 text-3xl font-extrabold">{media ?? "—"}<span className="text-sm font-normal text-white/40">/100</span></div>
        {delta != null && (
          <div className={delta >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>
            {delta >= 0 ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
            {delta >= 0 ? `+${delta}` : delta} vs mês anterior
          </div>
        )}
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Clientes em risco <AlertTriangle className="h-4 w-4 text-rose-300" /></div>
        <div className="mt-1 text-3xl font-extrabold text-rose-300">{risco}</div>
        <div className="text-xs text-white/50">nota abaixo de 50</div>
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Oportunidades abertas <Target className="h-4 w-4 text-amber-300" /></div>
        <div className="mt-1 text-3xl font-extrabold">{oportunidades}</div>
        <div className="text-xs text-white/50">canais sem presença</div>
      </div>
      <div className={card}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">Cobertura de dados <Plug className="h-4 w-4 text-cyan-300" /></div>
        <div className="mt-1 text-3xl font-extrabold">{cobPct}%</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${cobPct}%` }} /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `TabelaClientes.tsx`** (client)

```tsx
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CANAIS } from "@/lib/dados/tipos";
import type { LinhaDados } from "@/lib/dados/queries";
import { CanalIcone } from "./CanalIcone";
import { NotaBarra } from "./NotaBarra";

export function TabelaClientes({ linhas, mostrarAssessor }: { linhas: LinhaDados[]; mostrarAssessor: boolean }) {
  const [busca, setBusca] = useState("");
  const [assessor, setAssessor] = useState("");
  const [ordem, setOrdem] = useState<"risco" | "az">("risco");
  const [soPerdendo, setSoPerdendo] = useState(false);

  const assessores = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) if (l.assessorId && l.assessorNome) m.set(l.assessorId, l.assessorNome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [linhas]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const r = linhas.filter((l) =>
      (!t || l.nome.toLowerCase().includes(t)) &&
      (!assessor || l.assessorId === assessor) &&
      (!soPerdendo || l.perdas.length > 0));
    return r.sort((a, b) => ordem === "az" ? a.nome.localeCompare(b.nome) : (a.nota ?? 101) - (b.nota ?? 101));
  }, [linhas, busca, assessor, ordem, soPerdendo]);

  const sel = "h-9 rounded-md border border-white/15 bg-white/5 px-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        {mostrarAssessor && (
          <select className={sel} value={assessor} onChange={(e) => setAssessor(e.target.value)} aria-label="Assessor">
            <option value="">Todos assessores</option>
            {assessores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <select className={sel} value={ordem} onChange={(e) => setOrdem(e.target.value as "risco" | "az")} aria-label="Ordenar">
          <option value="risco">Mais em risco</option>
          <option value="az">A–Z</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={soPerdendo} onChange={(e) => setSoPerdendo(e.target.checked)} /> Só quem está perdendo
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="w-40 px-4 py-3 text-left">Nota de presença</th>
              <th className="px-4 py-3 text-left">Canais</th>
              <th className="px-4 py-3 text-left">Principal perda</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.clientId} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link href={`/dados/${l.clientId}`} className="font-medium hover:underline">{l.nome}</Link>
                  {l.assessorNome && <div className="text-xs text-white/40">Assessor: {l.assessorNome}</div>}
                </td>
                <td className="px-4 py-3"><NotaBarra nota={l.nota} anterior={l.notaAnterior} /></td>
                <td className="px-4 py-3">
                  {l.canais
                    ? <div className="flex flex-wrap gap-1">{CANAIS.map((c) => <CanalIcone key={c} canal={c} r={l.canais![c]} />)}</div>
                    : <span className="text-xs text-white/40">Calculando…</span>}
                </td>
                <td className="px-4 py-3 text-white/80">{l.perdas[0]?.texto ?? <span className="text-white/40">—</span>}</td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-white/50">Nenhum cliente com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `DadosTabs.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DadosTabs({ ativa, mostrarProgramacao }: { ativa: "dados" | "programacao"; mostrarProgramacao: boolean }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={cn("border-b-2 px-4 py-2 text-sm", on ? "border-teal-300 text-white" : "border-transparent text-white/50 hover:text-white/80")}>{label}</Link>
  );
  return (
    <nav className="flex border-b border-white/10">
      {tab("/dados", "Visão geral", ativa === "dados")}
      {mostrarProgramacao && tab("/programacao", "Programação", ativa === "programacao")}
    </nav>
  );
}
```

- [ ] **Step 6: `PerdasLista.tsx`**

```tsx
import { CANAL_LABEL, type Perda } from "@/lib/dados/tipos";

export function PerdasLista({ perdas }: { perdas: Perda[] }) {
  if (perdas.length === 0) return <p className="text-sm text-emerald-300">Nenhuma perda nos canais que conseguimos ler.</p>;
  return (
    <ul className="space-y-2">
      {perdas.map((p, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className={p.gravidade === "alta"
            ? "rounded bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300"
            : "rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300"}>
            {p.gravidade === "alta" ? "Alto" : "Médio"}
          </span>
          <span><span className="text-white/50">{CANAL_LABEL[p.canal]}:</span> {p.texto}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: `CanalCards.tsx`** (números por canal)

```tsx
import { CANAIS, CANAL_LABEL, type CanaisResultado, type CanalId } from "@/lib/dados/tipos";
import { CanalIcone } from "./CanalIcone";

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "—");
const brl = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const varPct = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" && b > 0 ? Math.round(((a - b) / b) * 100) : null;

function linhas(canal: CanalId, m: Record<string, number | string | null>): Array<[string, string, number | null]> {
  switch (canal) {
    case "site": return [["Visitas", n(m.sessoes), varPct(m.sessoes, m.sessoesAnt)]];
    case "google": return [["Cliques", n(m.cliques), varPct(m.cliques, m.cliquesAnt)], ["Posição média", typeof m.posicao === "number" ? `${Math.round(m.posicao)}ª` : "—", null]];
    case "gmn": return [["Nota", typeof m.nota === "number" ? `${m.nota.toFixed(1)} ★` : "—", null], ["Avaliações", n(m.avaliacoes), null], ["Novas no período", n(m.avaliacoesNovas), null]];
    case "instagram":
    case "facebook": return [["Posts no período", n(m.postsPeriodo), null], ["Último post", typeof m.ultimoPost === "string" ? new Date(m.ultimoPost).toLocaleDateString("pt-BR") : "—", null]];
    case "anuncios": return [["Investido", brl(m.gasto), null], ["Cliques", n(m.cliques), null], ["Investido (7 dias)", brl(m.gasto7d), null]];
    case "ecommerce": return [["Anúncios novos", n(m.anuncios), varPct(m.anuncios, m.anunciosAnt)]];
    case "crm": {
      const origens = typeof m.origens === "string" ? (JSON.parse(m.origens) as Record<string, number>) : {};
      const top = Object.entries(origens).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${ORIGEM[k] ?? k} ${v}`).join(" · ");
      return [
        ["Leads novos", n(m.leadsNovos), varPct(m.leadsNovos, m.leadsNovosAnt)],
        ["Vendas", `${n(m.vendas)} (${brl(m.valorVendas)})`, null],
        ["Conversão", typeof m.conversao === "number" ? `${Math.round(m.conversao * 100)}%` : "—", null],
        ["Sem resposta +24h", n(m.semResposta24h), null],
        ["De onde vêm", top || "—", null],
      ];
    }
  }
}
const ORIGEM: Record<string, string> = { google: "Google", meta_ads: "Anúncios Meta", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", mercado_livre: "Mercado Livre", outros: "Outros" };

export function CanalCards({ canais }: { canais: CanaisResultado }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CANAIS.filter((c) => canais[c].status !== "nao_se_aplica").map((c) => {
        const r = canais[c];
        return (
          <div key={c} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><CanalIcone canal={c} r={r} size="sm" />{CANAL_LABEL[c]}</div>
            {r.status === "sem_acesso" || r.status === "ausente"
              ? <p className="text-xs text-white/50">{r.motivo}</p>
              : (
                <dl className="space-y-1 text-sm">
                  {linhas(c, r.metricas).map(([k, v, d]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-white/50">{k}</dt>
                      <dd className="text-right tabular-nums">{v}{d != null && <span className={d >= 0 ? "ml-1 text-xs text-emerald-300" : "ml-1 text-xs text-rose-300"}>{d >= 0 ? `+${d}%` : `${d}%`}</span>}</dd>
                    </div>
                  ))}
                </dl>
              )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: `AtualizarAgoraButton.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { atualizarAgoraAction } from "@/lib/dados/actions";

export function AtualizarAgoraButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending}
      onClick={() => start(async () => {
        const r = await atualizarAgoraAction(clientId);
        if ("error" in r) toast.error(r.error); else toast.success("Dados atualizados");
      })}>
      <RefreshCw className={pending ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} /> {pending ? "Atualizando…" : "Atualizar agora"}
    </Button>
  );
}
```

- [ ] **Step 9: `ConexoesCard.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarConexoesAction } from "@/lib/dados/actions";

interface Props {
  clientId: string; podeEditar: boolean; emailContaServico: string | null;
  atual: { ga4: string | null; gsc: string | null; lyide: string | null };
  opcoes: { ga4: Array<{ id: string; nome: string }>; gsc: string[]; lyide: Array<{ slug: string; name: string }> };
}

export function ConexoesCard({ clientId, podeEditar, emailContaServico, atual, opcoes }: Props) {
  const [ga4, setGa4] = useState(atual.ga4 ?? "");
  const [gsc, setGsc] = useState(atual.gsc ?? "");
  const [lyide, setLyide] = useState(atual.lyide ?? "");
  const [pending, start] = useTransition();
  const sel = "h-9 w-full rounded-md border border-white/15 bg-white/5 px-2 text-sm disabled:opacity-60";

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-medium">Conexões de dados</div>
      {emailContaServico && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          Peça pro cliente adicionar como leitor no GA4 e no Search Console:
          <code className="rounded bg-white/10 px-1.5 py-0.5">{emailContaServico}</code>
          <button type="button" aria-label="Copiar e-mail" onClick={() => { navigator.clipboard.writeText(emailContaServico); toast.success("E-mail copiado"); }}>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs text-white/60">Google Analytics (GA4)
          <select className={sel} value={ga4} disabled={!podeEditar} onChange={(e) => setGa4(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.ga4.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/60">Search Console
          <select className={sel} value={gsc} disabled={!podeEditar} onChange={(e) => setGsc(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.gsc.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/60">Empresa no Lyide
          <select className={sel} value={lyide} disabled={!podeEditar} onChange={(e) => setLyide(e.target.value)}>
            <option value="">Não conectado</option>
            {opcoes.lyide.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
      </div>
      {podeEditar && (
        <Button size="sm" disabled={pending} onClick={() => start(async () => {
          const r = await salvarConexoesAction({ clientId, ga4PropertyId: ga4 || null, gscSiteUrl: gsc || null, lyideSlug: lyide || null });
          if ("error" in r) toast.error(r.error); else toast.success("Conexões salvas. Clique em Atualizar agora pra ver os dados.");
        })}>{pending ? "Salvando…" : "Salvar conexões"}</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Typecheck + lint e commit**

```bash
npm run typecheck && npm run lint
git add src/components/dados
git commit -m "feat(dados): componentes da visão geral e da tela do cliente"
```

---

### Task 13: Páginas

**Files:**
- Create: `src/app/(authed)/dados/page.tsx`
- Create: `src/app/(authed)/dados/[clientId]/page.tsx`

- [ ] **Step 1: Visão geral**

```tsx
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessDados, dadosVeTodos } from "@/lib/dados/access";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { listVisaoGeral } from "@/lib/dados/queries";
import { ResumoCards } from "@/components/dados/ResumoCards";
import { TabelaClientes } from "@/components/dados/TabelaClientes";
import { DadosTabs } from "@/components/dados/DadosTabs";
import { LegendaStatus } from "@/components/dados/CanalIcone";

export const dynamic = "force-dynamic";

const HEADER_BG = "radial-gradient(120% 140% at 0% 0%, rgba(20,184,166,.28), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(6,182,212,.18), transparent 55%), linear-gradient(180deg,#07110f,#0b1a17)";

export default async function DadosPage() {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();
  const visao = await listVisaoGeral(orgId, user);
  const ultima = visao.ok ? visao.linhas.map((l) => l.calculadoEm).filter(Boolean).sort().at(-1) : null;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 p-6" style={{ background: HEADER_BG }}>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-200">
          <BarChart3 className="h-3.5 w-3.5" /> Inteligência de clientes
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-white via-teal-200 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">Dados</h1>
        <p className="mt-1 text-sm text-white/70">
          Tudo de cada cliente num lugar só: onde está indo bem e onde está perdendo presença.
          {ultima && <span className="text-white/40"> · Atualizado {new Date(ultima).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · últimos 30 dias</span>}
        </p>
      </header>

      <DadosTabs ativa="dados" mostrarProgramacao={canAccessProgramacao(user.role)} />

      {!visao.ok ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/60">Painel em preparação. Volte em alguns minutos.</div>
      ) : (
        <>
          <ResumoCards linhas={visao.linhas} />
          <TabelaClientes linhas={visao.linhas} mostrarAssessor={dadosVeTodos(user.role)} />
          <LegendaStatus />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tela do cliente**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessDados, podeEditarConexoes } from "@/lib/dados/access";
import { getClienteDados } from "@/lib/dados/queries";
import { calcularCliente } from "@/lib/dados/calcular";
import { periodoPadrao } from "@/lib/dados/periodo";
import { faixaNota } from "@/lib/dados/nota";
import { emailContaServico } from "@/lib/dados/google-auth";
import { listarPropriedadesGa4, listarSitesGsc } from "@/lib/dados/coletores/google";
import { listarEmpresasLyide } from "@/lib/dados/coletores/lyide";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CanalCards } from "@/components/dados/CanalCards";
import { PerdasLista } from "@/components/dados/PerdasLista";
import { AtualizarAgoraButton } from "@/components/dados/AtualizarAgoraButton";
import { ConexoesCard } from "@/components/dados/ConexoesCard";
import type { SnapshotDados } from "@/lib/dados/tipos";

export const dynamic = "force-dynamic";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DadosClientePage({
  params, searchParams,
}: { params: Promise<{ clientId: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();
  const { clientId } = await params;
  const sp = await searchParams;
  const cliente = await getClienteDados(orgId, user, clientId);
  if (!cliente) notFound();

  const padrao = periodoPadrao();
  const custom = sp.de && sp.ate && DATE_RE.test(sp.de) && DATE_RE.test(sp.ate) && sp.de <= sp.ate && (sp.de !== padrao.de || sp.ate !== padrao.ate);
  const periodo = custom ? { de: sp.de!, ate: sp.ate! } : padrao;
  const editar = podeEditarConexoes(user.role);

  // Período padrão: lê o snapshot gravado. Período escolhido: calcula na hora (só este cliente).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const [snapRow, opcoesGa4, opcoesGsc, opcoesLyide] = await Promise.all([
    custom ? null : sb.from("client_dados_snapshots").select("nota, canais, perdas, calculado_em")
      .eq("client_id", clientId).order("calculado_em", { ascending: false }).limit(1).maybeSingle().then((r: { data: unknown }) => r.data),
    editar ? listarPropriedadesGa4() : [],
    editar ? listarSitesGsc() : [],
    editar ? listarEmpresasLyide() : [],
  ]);
  const snap: (SnapshotDados & { calculado_em?: string }) | null = custom ? await calcularCliente(cliente, periodo) : (snapRow as SnapshotDados | null);
  const cor = { risco: "text-rose-300", atencao: "text-amber-300", bom: "text-emerald-300", sem_dados: "text-white/40" }[faixaNota(snap?.nota ?? null)];

  return (
    <div className="space-y-5">
      <Link href="/dados" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dados</Link>
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h1 className="text-3xl font-extrabold">{cliente.nome}</h1>
          <p className="text-sm text-white/50">{cliente.website ?? "sem site"} · {periodo.de.split("-").reverse().join("/")} a {periodo.ate.split("-").reverse().join("/")}</p>
          <form className="mt-3 flex flex-wrap items-end gap-2 text-xs text-white/60">
            <label>De <input type="date" name="de" defaultValue={periodo.de} className="ml-1 rounded border border-white/15 bg-white/5 px-2 py-1" /></label>
            <label>Até <input type="date" name="ate" defaultValue={periodo.ate} className="ml-1 rounded border border-white/15 bg-white/5 px-2 py-1" /></label>
            <button className="rounded border border-white/20 px-2 py-1 hover:bg-white/10">Aplicar</button>
          </form>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-white/50">Nota de presença</div>
            <div className={`text-4xl font-extrabold ${cor}`}>{snap?.nota ?? "—"}<span className="text-base font-normal text-white/40">/100</span></div>
          </div>
          <AtualizarAgoraButton clientId={clientId} />
        </div>
      </header>

      {!snap ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/60">Calculando… clique em Atualizar agora.</div>
      ) : (
        <>
          <CanalCards canais={snap.canais} />
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-medium">Onde está perdendo</h2>
            <PerdasLista perdas={snap.perdas} />
          </section>
        </>
      )}

      <ConexoesCard
        clientId={clientId} podeEditar={editar} emailContaServico={editar ? emailContaServico() : null}
        atual={{ ga4: cliente.ga4_property_id, gsc: cliente.gsc_site_url, lyide: cliente.crm_tipo === "yide" ? cliente.crm_identifier : null }}
        opcoes={{ ga4: opcoesGa4, gsc: opcoesGsc, lyide: opcoesLyide }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint e commit**

```bash
npm run typecheck && npm run lint
git add "src/app/(authed)/dados"
git commit -m "feat(dados): páginas visão geral e cliente"
```

---

### Task 14: Menu e aba na Programação

**Files:**
- Modify: `src/components/layout/nav-config.ts:87` (item `/programacao`)
- Modify: `src/app/(authed)/programacao/page.tsx` (adicionar abas logo depois do `</header>`)

- [ ] **Step 1: Menu**: trocar a linha 87 por:

```ts
      { type: "link", href: "/dados", icon: BarChart3, label: "Dados", roles: ["adm", "socio", "programacao", "assessor"], badgeKey: null },
```

Importar `BarChart3` de `lucide-react` no topo do arquivo, no import que já existe. Se `Code2` ficar sem uso, remova do import. Confira se algum teste usa o href `/programacao` no menu: `grep -rn '"/programacao"' src --include='*.test.ts'`. Se usar, atualize para `/dados`.

O gate especial do cargo `programacao` (`isLinkVisible`) só bloqueia itens `roles: "all"`. Como este item lista `programacao` explicitamente, ele aparece normalmente.

- [ ] **Step 2: Abas na Programação**: em `src/app/(authed)/programacao/page.tsx`, importar e renderizar logo depois do `</header>`:

```tsx
import { DadosTabs } from "@/components/dados/DadosTabs";
// ...
      </header>
      <DadosTabs ativa="programacao" mostrarProgramacao />
```

- [ ] **Step 3: Typecheck + lint + testes e commit**

```bash
npm run typecheck && npm run lint && npx vitest run --exclude '**/.claude/**'
git add src/components/layout/nav-config.ts "src/app/(authed)/programacao/page.tsx"
git commit -m "feat(dados): menu Dados no lugar de Programação + abas"
```

---

### Task 15: PR

- [ ] **Step 1:** Rodar tudo de novo: `npm run typecheck && npm run lint && npx vitest run --exclude '**/.claude/**'`. Tudo verde.
- [ ] **Step 2:** `git push -u origin feat/painel-dados` e `gh pr create`. No corpo do PR, liste:
  - Migration manual `20261122000000_painel_dados.sql`, para aplicar no SQL Editor.
  - Envs novas na Vercel: `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON da conta de serviço do ads-manager) e `META_SYSTEM_USER_TOKEN` (token System User da BM, só leitura). `META_GRAPH_API_VERSION` é opcional.
  - Depende do PR do crm-yide (Parte 1) para o canal CRM.
  - Sem migration ou sem env, a página mostra "Painel em preparação" ou canais em cinza, sem quebrar.
- [ ] **Step 3:** Esperar o CI (`ci.yml`) ficar verde e depois `gh pr merge --squash --delete-branch` (autorizado na memória do projeto). Avisar a Yasmin da migration e das envs.
