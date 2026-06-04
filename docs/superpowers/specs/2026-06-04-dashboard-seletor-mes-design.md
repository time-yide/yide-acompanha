# Seletor de mês no dashboard ("como fechou mês passado")

Data: 2026-06-04
Branch: `feat/dashboard-seletor-mes`

## Contexto e objetivo

Hoje os dashboards de **assessor, coordenador e comercial** mostram sempre o mês corrente (KPIs "foto de agora", comissão prevista em curso). A usuária quer poder olhar **como um mês passado fechou** — selecionar um mês e ver o dashboard daquele mês: carteira/clientes/churn reconstruídos para o fim do mês e a comissão efetivamente fechada.

## Escopo

**Dentro:** dashboards de `assessor`, `coordenador`, `comercial`.

**Fora (não muda nada):** dashboards de `socio`, `adm`, `audiovisual_chefe`, `designer`, `editor`, `videomaker`; o sistema de snapshots/cron de comissão; qualquer edição de dados passados; o seletor `?periodo=` existente (designer/editor/audiovisual continuam como estão).

## Comportamento por dashboard

Ao selecionar um mês, cada card se comporta assim:

| Card | Mês atual | Mês passado |
|---|---|---|
| **KPIs carteira/clientes/churn** (assessor, coord) | como hoje | reconstruídos "até o fim do mês" + delta vs mês anterior a ele |
| **Comissão / Remuneração** (todos 3) | preview "em curso" | snapshot real "fechado" (ou recálculo "estimado" se não houver) |
| **Gráfico carteira (12m)** e **entrada/churn (6m)** (assessor, coord) | janela termina hoje | janela termina no mês escolhido |
| **Carteira por assessor** (coord) | mês atual (ajustes do mês) | ajustes do mês escolhido |
| **Leads KPIs / Meta** (comercial) | como hoje | reconstruídos pro mês escolhido (queries já recebem `now`) |
| **Próximos eventos, Satisfação da semana, Posts IG, Painel audiovisual, Alerta onboarding, Funil, Próximas reuniões** | aparecem | **escondidos** (são "agora/futuro", não fazem sentido em mês passado) |

## UI / navegação

- Componente cliente `MesSelector` (dropdown) no topo dos 3 dashboards, mostrando os **últimos 12 meses** (rótulo `Mai/2026` via `monthLabel`).
- Navega mudando a URL para `?mes=2026-05`, preservando outros params (ex.: `?as=` de impersonação) — mesmo padrão do `ImpersonateBar`.
- Default = mês atual. Sem `?mes=` → mês atual.
- Quando um mês passado está ativo, um selo discreto reforça "Fechado · histórico".

## Arquitetura / fluxo de dados

### Parsing e validação (página)
- `src/app/(authed)/page.tsx` lê `?mes=` e valida com `parseMes(raw)`:
  - formato `YYYY-MM`; precisa estar dentro dos últimos 12 meses **e não ser futuro**; senão → mês atual.
- Passa `mes: string` (YYYY-MM) como prop para `DashboardAssessor`, `DashboardCoord`, `DashboardComercial`. Deriva `isMesAtual = mes === getCurrentMonthYM(new Date())`.

### Queries do dashboard (`src/lib/dashboard/queries.ts`)
- Extrair um helper puro `clienteAtivoNoFimDoMes(cliente, mes)` a partir da lógica que **já existe** em `_getCarteiraTimelineImpl` (entrada ≤ fim, churn null ou > fim). Reutilizado por timeline e pelos KPIs.
- `getKpis(filter, mesRef?)`: quando `mesRef` é passado, reconstrói carteira/clientes ativos até `lastDayOfMonth(mesRef)`, churn = clientes com `data_churn` dentro do mês, e os deltas "vs mês anterior" comparam `mesRef` com o mês anterior a ele. Sem `mesRef` → comportamento atual.
- `getCarteiraTimeline(months, filter, ateMes?)` e `getEntradaChurn(months, filter, ateMes?)`: a janela de meses passa a **terminar em `ateMes`** (default = mês atual). Internamente trocar `monthRange(months, now)` por `monthRange(months, fimDoMes(ateMes))`.
- `getCarteiraPorAssessor(filter, mesRef?)`: já calcula `monthRef` internamente para puxar ajustes; passar o `mesRef` selecionado.

### Queries do comercial (`src/lib/dashboard/comercial-queries.ts`)
- `getLeadsKpis(id, now)` e `getMetaComercial(id, now)` **já recebem `now`** — passar uma data dentro do mês escolhido (`new Date(lastDayOfMonth(mes) + "T12:00:00Z")`).
- `getFunnelData` e `getProximasReunioes` são "ao vivo/futuro" → **não chamadas** em mês passado (seções escondidas).

### Comissão por mês (novo)
Novo helper `getComissaoDoMes(userId, role, mes, isMesAtual)` em `src/lib/dashboard/comissao-prevista.ts` (ou módulo irmão), retornando `ComissaoPrevista & { status: "em_curso" | "fechado" | "estimado" }`:
- `isMesAtual` → `getComissaoPrevista(userId, role)` (preview ao vivo), status `em_curso`.
- mês passado → ler `commission_snapshots` por (`user_id`, `mes_referencia = mes`):
  - achou → mapear `fixo / percentual_aplicado / base_calculo / valor_variavel` para `ComissaoPrevista`, status `fechado`.
  - não achou → `getComissaoPrevista(userId, role, dataNoMes)` (recálculo), status `estimado`.
- `RemuneracaoCard` ganha um rótulo dinâmico conforme `status` (hoje é fixo "em curso · não fechado ainda").

### Caching
- Incluir `mes`/`ateMes` na **chave** do `unstable_cache` de cada query alterada (`getKpis`, `getCarteiraTimeline`, `getEntradaChurn`, `getCarteiraPorAssessor`). Meses passados são estáveis (cache longo natural); o mês atual revalida como hoje (300s, tag `dashboard`).

## Edge cases
- `?mes=` inválido / futuro / fora dos 12 meses → mês atual (silencioso).
- `?as=` (impersonação) e `?mes=` coexistem; o `MesSelector` preserva o `as`.
- Mês passado sem snapshot de comissão nem dados → comissão `estimado` R$ 0 / KPIs zerados (sem erro).
- Cliente sem `data_churn` ou `data_entrada` futura → tratado pelo helper de reconstrução (mesma regra do timeline atual).

## Testes (TDD)
- `parseMes`: aceita YYYY-MM nos últimos 12 meses; rejeita futuro/inválido/antigo → cai no atual.
- Helper `clienteAtivoNoFimDoMes` / reconstrução de KPIs: carteira e churn corretos para um mês passado dado um conjunto de clientes com entrada/churn variados.
- `getComissaoDoMes`: mês atual → preview/`em_curso`; mês passado com snapshot → valor do snapshot/`fechado`; mês passado sem snapshot → recálculo/`estimado`.
- Janela dos gráficos termina no mês escolhido.
- Seguir o padrão dos testes existentes (mock de `@/lib/supabase/service-role`).

## Fora de escopo (YAGNI)
- Reconstrução histórica para comercial além do que as queries já suportam via `now` (funil/reuniões ficam escondidos, não reconstruídos).
- Exportar / comparar dois meses lado a lado.
- Seletor em dashboards fora dos 3 citados.
