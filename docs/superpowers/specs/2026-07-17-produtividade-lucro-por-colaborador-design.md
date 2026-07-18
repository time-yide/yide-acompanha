# Produtividade: lucro por colaborador + coordenador medido pelo time

**Data:** 2026-07-17
**Módulo:** `/produtividade` (`src/lib/produtividade`, `src/components/produtividade`, `src/app/(authed)/produtividade`)
**Fonte:** todos os arquivos vivem em `origin/main` (a `main` local está atrás — branchar de `origin/main`).

## Problema

A tabela "COLABORADORES" do `/produtividade` confunde e mede a coisa errada:

1. **Rótulo mente.** O título da seção é fixo no código (`Colaboradores · hoje`, [page.tsx](../../../src/app/(authed)/produtividade/page.tsx)) enquanto a tabela mostra o **período selecionado no filtro**. Com "Este mês" selecionado, tudo é do mês (13 dias úteis até 17/07), mas o título diz "hoje".
2. **`Custo (per.)` é enigmático.** `per.` = "período". Valor = `salário ÷ 22 × dias úteis`. Correto, mas ninguém adivinha o rótulo.
3. **`Entregas` conta a coisa errada.** Hoje = tarefas com status `postada` atribuídas à pessoa. Mas **videomaker não posta** (quem posta é editor/social media), então videomaker aparece com entrega ~0 mesmo captando 36h. O output real do audiovisual é o status **Concluído Operacional** (`concluida`), não `postada`.
4. **Não existe leitura de lucro.** A dona quer saber, por pessoa, se está dando lucro — receita atribuída vs custo.

## Decisões (brainstorming)

- **Fonte de receita por pessoa:** valor médio por entrega.
- **O que conta como entrega:** por cargo (reusa `ROLES_ENTREGA_OPERACIONAL` de [delivery-roles.ts](../../../src/lib/tarefas/delivery-roles.ts)).
- **Base do rateio:** faturamento ÷ **todas** as entregas de todos os produtores (não infla só no audiovisual).
- **Coordenador de audiovisual:** medido pelo **resultado do time**, não por entrega própria — lucro do time **incluindo o salário dele**.
- **Fora totalmente:** `coordenador` geral (Lucas) e `socio`/dona (Yasmin) — nem linha individual, nem denominador.

## Modelo de cálculo

Tudo pró-rateado pelo **mesmo** número de dias úteis do período selecionado (`diasUteis`), pra numerador e denominador ficarem na mesma janela.

```
Faturamento do período (F) = Σ clients.valor_mensal (ativos, tipo "comum") ÷ 22 × diasUteis
Total de entregas (T)      = Σ entregas de todos os produtores individuais no período
Valor por entrega          = F ÷ T            (se T = 0 → null)
```

### Entrega por cargo

| Cargo | 1 entrega = |
|---|---|
| Videomaker | captações concluídas (`videomaker_status = 'completed'`) **+** tarefas em `concluida` (edições dele) |
| Editor, Fast Mídia, Designer, Audiovisual chefe | tarefas em `concluida` (Concluído Operacional) |
| Assessor e demais que entregam | tarefas em `postada` (terminal deles) |
| Coordenador geral, Sócia | — (fora da tabela) |

Contagem de `concluida`: atribuir à pessoa (`atribuido_a`) as tarefas que **atingiram** `concluida` no período. `completed_at` é carimbado ao entrar em `concluida` ou `postada`, então usar `completed_at` no range + `status IN ('concluida','postada')` cobre quem concluiu operacionalmente (postada implica que passou por concluída). Captações de videomaker vêm de `audiovisual_capturas` / `calendar_events` (já buscadas na query para tempo externo e atrasados).

### Por produtor individual

```
entregas_periodo   = contagem por cargo (acima)
custo_periodo      = fixo_mensal ÷ 22 × diasUteis        (já existe)
receita_periodo    = valor_por_entrega × entregas_periodo   (null se valor_por_entrega null)
lucro_periodo      = receita_periodo − custo_periodo        (null se qualquer parte null)
```

### Coordenador de audiovisual (`audiovisual_chefe`) — card à parte

Não aparece na lista individual. Vira um card "Time Audiovisual · <nome>":

```
Produtores do time = videomaker, fast_midia, designer, editor  (PRODUCERS existente)
receita_time = Σ receita_periodo dos produtores do time
custo_time   = Σ custo_periodo dos produtores do time + custo_periodo do coordenador
lucro_time   = receita_time − custo_time
```

Mais agregados do time: entregas, tempo ativo, atrasados (somados). Responde: "o time dele, já pagando ele, dá lucro?". Fica visualmente separado pra não confundir agregado com linha individual.

## Escopo da tabela / exclusões

- **Linhas individuais:** produtores (videomaker, editor, fast_midia, designer) + assessores (postada) + ADM (aparece como overhead, sem entrega).
- **Card do time:** `audiovisual_chefe`.
- **Removidos de tudo:** `coordenador`, `socio` (e o cargo da dona). Não entram no `T` (denominador) nem em custo/receita.

## Mudanças de UI

1. Título `Colaboradores · hoje` → dinâmico via `PERIODO_LABEL[range]` ("Hoje" / "Esta semana" / "Este mês").
2. Coluna `Custo (per.)` → **"Custo salário"** com `title`/tooltip: "salário ÷ 22 dias úteis × dias úteis do período".
3. Colunas novas: **Receita** (atribuída) e **Lucro** (verde se ≥0, vermelho se <0; "—" se null).
4. Cards de resumo: **Faturamento do período**, **Custo total**, **Lucro total** do time.
5. Card "Time Audiovisual · <coord>" com receita/custo/lucro/entregas do time.

## Casos de borda

- Produtor sem `fixo_mensal` → `custo_periodo = null`; conta entrega/receita mas custo entra como 0 no `custo_time` com aviso visual (não quebra o lucro do time).
- `T = 0` (nenhuma entrega na empresa) → `valor_por_entrega = null` → Receita/Lucro "—".
- Sem `audiovisual_chefe` ativo → card do time não renderiza.
- Parceria/permuta (`valor_mensal = 0`) já não infla `F`.

## Arquivos afetados (sem migration nova — reusa tabelas existentes)

- `src/lib/produtividade/queries.ts` — buscar `F` (soma `clients.valor_mensal`), reconta entregas por cargo, calcula `valor_por_entrega`, `receita_periodo`, `lucro_periodo`; agrega o card do time; filtra `coordenador`/`socio`.
- `src/lib/produtividade/schema.ts` — constantes/helpers de exclusão e do time se necessário (reusa `ROLES_ENTREGA_OPERACIONAL`, `PRODUCERS`).
- `src/components/produtividade/ColaboradoresTable.tsx` — colunas Receita/Lucro, rótulo "Custo salário" + tooltip.
- `src/components/produtividade/ProdutividadeSummaryCards.tsx` — totais de faturamento/custo/lucro + card do time.
- `src/app/(authed)/produtividade/page.tsx` — título dinâmico.

## Fora de escopo

- Vínculo por coordenador específico (o sistema define time audiovisual por cargo, não por membership). Se um dia houver mais de um coordenador de audiovisual com times distintos, revisitar.
- Fração de receita destinada à produção (decidido: rateio por todas as entregas da empresa).
- Custos além de salário fixo (ferramentas, tráfego passthrough).
