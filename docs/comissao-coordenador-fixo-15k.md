# Mudança no modelo de comissão: Coordenador agora ganha só fixo

> **Decisão de produto (Yasmin)**: coordenador deixa de ter parte variável sobre a carteira da agência. Passa a receber apenas o `profiles.fixo_mensal` (sugestão: **R$ 15.000**).

## O que mudou no código

| Arquivo | Antes | Depois |
|---|---|---|
| `src/lib/comissoes/calculator.ts` | Coordenador agrupado com `audiovisual_chefe`: fixo + % sobre carteira da agência | Coordenador isolado: **só fixo**. Audiovisual_chefe continua igual |
| `src/lib/dashboard/comissao-prevista.ts` | Coordenador usava `coordenador_id` da tabela clients pra calcular % | Coordenador pula cálculo variável — retorna só fixo |
| `src/components/dashboard/RemuneracaoCard.tsx` | Sempre 3 colunas (Fixo / Comissão / Total) | Quando só tem fixo, vira 2 colunas e remove "em curso" do badge |

`audiovisual_chefe` **NÃO** foi mexido — segue com `fixo + %` como antes.

## Passos pra colocar em produção

### Passo 1 — Mergear este PR

Code change só. Sozinho, faz coordenador receber apenas o que estiver em `profiles.fixo_mensal`. Se você não mudar o valor no banco, vai usar o que já tá lá.

### Passo 2 — Atualizar `fixo_mensal` no banco (SQL Editor)

Abrir Supabase Dashboard → SQL Editor → New query:

```sql
-- Backup (1 minuto)
create table if not exists public._coord_fixo_backup as
select id, nome, fixo_mensal, comissao_percent
from public.profiles
where role = 'coordenador';
```

```sql
-- Atualizar todos os coordenadores ativos pra fixo R$ 15.000 + zerar percentual
update public.profiles
set fixo_mensal = 15000,
    comissao_percent = 0
where role = 'coordenador'
  and ativo = true;
```

```sql
-- Conferir
select id, nome, fixo_mensal, comissao_percent
from public.profiles
where role = 'coordenador'
order by ativo desc, nome;
```

### Passo 3 — Validar

- Logar como coordenador → dashboard:
  - Card "Minha remuneração prevista" mostra **só fixo R$ 15.000** + total R$ 15.000
  - SEM coluna de "Comissão" no meio
  - Badge mostra "Salário fixo do mês" em vez de "Em curso · não fechado ainda"
- Logar como sócio/adm → `/comissoes/visao-geral`:
  - Linha do coordenador mostra R$ 15.000 fixo, R$ 0 variável
  - Snapshot mensal calcula corretamente

## Rollback

Se quiser voltar pro modelo antigo (fixo + % sobre carteira):

```sql
-- Restaurar valores anteriores do backup
update public.profiles p
set fixo_mensal = b.fixo_mensal,
    comissao_percent = b.comissao_percent
from public._coord_fixo_backup b
where b.id = p.id;
```

E reverter o PR no código.

## Por que separei audiovisual_chefe?

`audiovisual_chefe` (Hannamel é editora-chefe, esse role) continua tendo % sobre carteira da agência porque é um cargo diferente — você só falou "coordenador". Se quiser mudar `audiovisual_chefe` também, é só falar e ajusto rapidinho.

## Impacto em snapshots históricos

Snapshots de meses **anteriores** já fechados não mudam (já tem valores salvos em `commission_snapshots`). Apenas:
- O **mês corrente** (preview ao vivo)
- Snapshots **futuros**

Se você quiser refazer um snapshot já fechado, vai precisar deletar o snapshot do mês + rodar `generateMonthSnapshot` de novo — mas em geral não faz sentido reabrir mês fechado.
