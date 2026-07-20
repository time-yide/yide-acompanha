# Churn com motivo (categoria) + valor perdido por motivo

**Data:** 2026-07-20
**Status:** Aprovado (brainstorm)

## Problema

Ao marcar um cliente como churn, o "motivo" hoje é um **textarea livre** (`clients.motivo_churn`).
Isso impede qualquer relatório de "por que mais perdi cliente" — não dá pra agrupar texto livre.
A Yasmin quer:

1. Escolher o motivo do churn a partir de **opções fixas** (dropdown).
2. Ver um relatório do **motivo que mais causa churn**, com o **valor (R$) perdido** por motivo.

## Decisões (fechadas no brainstorm)

- **7 opções fixas**, sem "Outro":
  `preco`, `insatisfacao_resultado`, `insatisfacao_equipe`, `empresa_fechou`,
  `concorrente`, `inadimplencia`, `contrato_encerrado`.
- Dropdown **obrigatório** + **detalhe de texto opcional** (mantém o `motivo_churn` livre atual como "detalhe").
- **Valor**: reaproveita `clients.valor_mensal` — sem coluna nova, sem snapshot (YAGNI; mesma fonte do KPI `valorPerdido`).
- Relatório no **Dashboard** (só ADM/Sócio, junto dos outros charts de churn), janela **6 meses**.
- Gráfico conta **todos** os churns do período; soma R$ **só de `tipo_relacao` comum/null** (não infla com permuta/parceria).
- Clientes que já deram churn (pré-feature) têm `categoria = null` → aparecem como **"Sem categoria"** (bucket ao fim, sem sumir do total).

## Modelo de dados (1 migration manual)

`supabase/migrations/2026072000XXXX_churn_motivo_categoria.sql`:

```sql
create type public.churn_motivo as enum (
  'preco', 'insatisfacao_resultado', 'insatisfacao_equipe',
  'empresa_fechou', 'concorrente', 'inadimplencia', 'contrato_encerrado'
);

alter table public.clients
  add column motivo_churn_categoria public.churn_motivo;

create index idx_clients_motivo_churn_categoria
  on public.clients(motivo_churn_categoria)
  where motivo_churn_categoria is not null;
```

- `motivo_churn` (texto) permanece — vira o "detalhe opcional".
- Coluna nullable: clientes existentes e clientes ativos ficam com `null` sem quebrar.

## Constantes + schema — `src/lib/clientes/schema.ts`

```ts
export const CHURN_MOTIVOS = [
  { slug: "preco",                  label: "Preço / orçamento" },
  { slug: "insatisfacao_resultado", label: "Insatisfação com resultado" },
  { slug: "insatisfacao_equipe",    label: "Insatisfação com a equipe" },
  { slug: "empresa_fechou",         label: "Cliente fechou / pausou a empresa" },
  { slug: "concorrente",            label: "Foi pra concorrente" },
  { slug: "inadimplencia",          label: "Problema financeiro (inadimplência)" },
  { slug: "contrato_encerrado",     label: "Contrato pontual encerrado (fim natural)" },
] as const;
export const CHURN_MOTIVO_SLUGS = CHURN_MOTIVOS.map((m) => m.slug) as [string, ...string[]];
export type ChurnMotivo = (typeof CHURN_MOTIVOS)[number]["slug"];
```

`churnClienteSchema` passa a:
- `motivo_churn_categoria: z.enum(CHURN_MOTIVO_SLUGS)` — **obrigatório**.
- `motivo_churn: z.string().optional()` — vira o detalhe opcional (deixa de ser `min(3)` obrigatório).

## Server action — `churnClienteAction` (`src/lib/clientes/actions.ts`)

- Lê `motivo_churn_categoria` + `motivo_churn` do FormData.
- `updatePayload` grava categoria + detalhe.
- `justificativa` do audit = label da categoria + detalhe (pra continuar legível no log).
- `reactivateClienteAction`: limpar também `motivo_churn_categoria` (junto de `motivo_churn`/`data_churn`).

## UI — `src/components/clientes/StatusPopover.tsx`

- Novo estado `categoria`.
- Campo **`<select>` obrigatório** "Motivo do churn" com as 7 opções (placeholder "Selecione…").
- Textarea vira "Detalhar (opcional)".
- Validação client: exige categoria escolhida (o detalhe é livre).
- Reset ao fechar limpa `categoria` também.

## Relatório — query `getChurnMotivos` (`src/lib/dashboard/queries.ts`)

Segue o padrão `_getEntradaChurnImpl` + wrapper cacheado:

```ts
export interface ChurnMotivoPoint {
  motivo: string | null;   // slug ou null (sem categoria)
  label: string;           // label PT ou "Sem categoria"
  quantidade: number;
  valorPerdido: number;
}
export async function getChurnMotivos(
  months = 6, filter?: ClientFilter, ateMes?: string
): Promise<ChurnMotivoPoint[]>
```

- Service-role. Janela = últimos `months` meses (`monthRange`).
- Universo: `deleted_at is null` + `data_churn` dentro da janela. **Sem** filtro de `tipo_relacao`/`modalidade` (conta todos).
- Agrupa por `motivo_churn_categoria`.
- `valorPerdido` por grupo = soma `valor_mensal` só de `tipo_relacao` comum/null.
- Ordena por `quantidade` desc; bucket `null` ("Sem categoria") sempre por último.
- Wrapper `unstable_cache` com key `dashboard-churn-motivos-v1`, tag `dashboard`, revalidate 300 — mesmo padrão dos vizinhos.

## Chart + Section

- `src/components/dashboard/ChartChurnMotivos.tsx` (client, recharts) — barras **horizontais** rankeadas; label da barra mostra `quantidade` e `R$` formatado. Tooltip com os dois. Estilo consistente com `ChartEntradaChurn` (cores rose pra churn). Bucket "Sem categoria" em cinza.
- Wrapper lazy `ChartChurnMotivosLazy.tsx` (segue `ChartEntradaChurnLazy`).
- `MotivosChurnSection` em `sections.tsx` (title "Motivos de churn", subtitle "Últimos 6 meses"), busca `getChurnMotivos(6, { unitId }, mes)`.
- Montada em `DashboardSocioAdm.tsx` logo abaixo do grid Carteira/EntradaChurn (só adm/sócio — coerente com dado de R$).

## Cache

- Bump nas keys tocadas: nenhuma existente muda de shape; a nova key `dashboard-churn-motivos-v1` nasce nova. `churnClienteAction`/`reactivate` já fazem `revalidateTag("dashboard")`, então o novo chart invalida junto.

## Migration manual + janela deploy→migration

`2026072000XXXX_churn_motivo_categoria.sql` roda no SQL Editor **após o merge** (Vercel não roda migrations). Entre o deploy e a aplicação da migration a coluna não existe. Blindagens:

- **Leitura** (`getChurnMotivos`): `select` da coluna nova em `try/catch`; se o Supabase reclamar da coluna ausente, retorna `[]` → a `MotivosChurnSection` renderiza vazia em vez de derrubar o dashboard.
- **Escrita** (`churnClienteAction`): grava a categoria via cast `as any` (padrão do repo). Se alguém marcar churn nesse intervalo, o Supabase retorna erro e o popover mostra a mensagem — sem corromper nada. Rara (só ADM/Sócio).
- Recomendação: aplicar a migration **imediatamente após o merge**, antes de marcar qualquer churn.

## Fora de escopo

- Editar a categoria de churns antigos em massa (ficam "Sem categoria").
- Snapshot do valor no momento do churn.
- Relatório fora do dashboard (ex.: página /clientes).
