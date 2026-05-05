# Dashboard do audiovisual_chefe — design

**Data:** 2026-05-05
**Escopo:** PR2 da sequência. Depende de PR1 ([feat/dashboards-executores](https://github.com/time-yide/yide-acompanha/pull/73)) estar mergeado pra ter `src/lib/dashboard/personal.ts` e os widgets em `src/components/dashboard/personal/`.

## Contexto

Hoje `audiovisual_chefe` cai no `StubGreeting`. Esse PR substitui por dashboard próprio com:
1. Sua remuneração (fixo + comissão estimada do mês)
2. Visão agregada da equipe (videomakers + editores) — totais
3. Listas separadas por papel — videomakers e editores com suas métricas individuais

A comissão do audiovisual_chefe usa o mesmo cálculo do coordenador (`comissao_percent` % da carteira de clientes "comum" ativos), via `calculateCommission` já existente em [src/lib/comissoes/calculator.ts:78](src/lib/comissoes/calculator.ts:78).

## Decisões de produto (validadas com a usuária)

1. **Visão agregada + per-person** — bloco de KPIs agregados em cima, listas individuais abaixo
2. **Período** — reusa `PeriodoSelector` do PR1 (default mês atual; opções mês passado / 7 dias / total)
3. **Listas separadas** — uma de videomakers (Nome / Próximas gravações / Concluídas no período) e outra de editores (Nome / Pendentes / Concluídas no período)
4. **Remuneração** — `FixoCard` (do PR1) + novo `ComissaoCard` mostrando só o variável estimado, com link "Ver detalhes" pra `/comissoes`

## Mudanças por área

### Server queries — novo módulo

**Arquivo:** `src/lib/dashboard/audiovisual.ts`

```ts
// SERVER ONLY
export interface VideomakerStat {
  id: string;
  nome: string;
  proximasGravacoes: number;   // próximas 14 dias (segunda atual → domingo da próxima)
  concluidasNoPeriodo: number; // tasks concluida no período
}
export interface EditorStat {
  id: string;
  nome: string;
  pendentes: number;            // tasks status != concluida (inclui em_andamento + aberta)
  concluidasNoPeriodo: number;
}
export interface EquipeAudiovisual {
  videomakers: VideomakerStat[];
  editores: EditorStat[];
  agregados: {
    totalGravacoesProximas: number;       // soma de proximasGravacoes
    totalConcluidasNoPeriodo: number;     // soma das duas listas
    totalPendentes: number;               // soma de pendentes (só editores)
  };
}

export async function getEquipeAudiovisual(periodo: Periodo): Promise<EquipeAudiovisual>
```

**Implementação:**
- Lista todos os profiles com `role IN ('videomaker', 'editor')` e `ativo = true`
- Em paralelo: busca todas as tasks atribuídas a esses ids + todos os calendar_events com sub_calendar='videomakers' que tenham qualquer participante na lista
- Agrega em JS (volume baixo — empresa pequena)
- Cache `unstable_cache` com tag `dashboard`

Usa `resolvePeriodo` (já existente em PR1) pra calcular `fromIso`/`toIso`.

### Comissão — preview

A função `calculateCommission(userId, monthRef)` já existe e retorna `{ snapshot, items }` onde:
- `snapshot.fixo` — valor fixo
- `snapshot.valor_variavel` — comissão variável calculada
- `items[]` — breakdown por tipo

Uso direto na UI sem nova query — já tem cache via `previewMyCommission`.

### Componente novo: `ComissaoCard`

**Arquivo:** `src/components/dashboard/personal/ComissaoCard.tsx`

Server Component que recebe `userId`. Internamente chama `calculateCommission(userId, monthRefAtual)`. Mostra:
- Label "Comissão estimada (mês)"
- Valor variável formatado em BRL
- Link "Ver detalhes →" pra `/comissoes`

Visual: mesma estrutura do `FixoCard`. Quando comissão é 0 (ex: assessor sem clientes comum), mostra `R$ 0,00` sem alarde.

### Componente novo: `EquipeAudiovisualSection`

**Arquivo:** `src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx`

Server Component que recebe `periodo` e renderiza:
1. Bloco de KPIs agregados (3 KPI cards horizontais)
2. Tabela de videomakers (Nome / Próximas gravações / Concluídas)
3. Tabela de editores (Nome / Pendentes / Concluídas)

Cada nome é link pra um perfil/ficha (ou `/colaboradores/<id>` se tiver — verificar). Empty states quando equipe vazia.

### Dashboard novo: `DashboardAudiovisualChefe`

**Arquivo:** `src/components/dashboard/DashboardAudiovisualChefe.tsx`

Layout:
```
Header: Olá, {primeiroNome}
[grid 2 cols]
  FixoCard | ComissaoCard
[full width]
  EquipeAudiovisualSection (com PeriodoSelector no canto do título)
```

### Roteamento

[src/app/(authed)/page.tsx](src/app/(authed)/page.tsx) — antes do `StubGreeting` final, adicionar:

```ts
if (user.role === "audiovisual_chefe") {
  return <DashboardAudiovisualChefe userId={user.id} nome={user.nome} periodo={periodo} />;
}
```

## Fluxo de dados

```
[user logado, role=audiovisual_chefe]
  → Página /
  → page.tsx detecta role → renderiza <DashboardAudiovisualChefe>
  → Server Components em paralelo:
      FixoCard (lê profiles.fixo_mensal)
      ComissaoCard (chama calculateCommission)
      EquipeAudiovisualSection (chama getEquipeAudiovisual)
  → Renderiza tudo
```

## Casos de borda

- **Sem videomakers ativos** → tabela com empty state "Nenhum videomaker ativo na equipe."
- **Sem editores** → idem
- **AV chefe sem `comissao_percent` configurado** → comissão variável = 0, card mostra R$ 0,00
- **Período "total"** → query de tasks pode retornar muito; aceitar latência (query equivalente ao filtro do designer)
- **Editor com tarefa atribuída a outro mas com participantes_ids contendo o editor** → segue padrão do PR1: pendentes contam ambos (atribuido_a OR participantes_ids); concluídas contam apenas atribuido_a (crédito vai pro dono)

## Fora de escopo

- Filtro de impersonate do sócio — PR3
- Edit/comissionamento variável de videomakers/editores — não há comissão pra esses roles hoje (eles só recebem fixo)
- Drill-down de tarefa específica do colega — basta link pra `/tarefas` ou `/colaboradores/<id>` se existir

## Risco

- **Baixo**: nenhuma alteração em fluxos existentes, só adiciona caminho novo no router
- N+1 já evitado com fetch all + aggregate in JS
- Comissão usa função já testada (`calculateCommission`)
