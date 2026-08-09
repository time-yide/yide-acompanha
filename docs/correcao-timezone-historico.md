# Correção de timezone — dados históricos

> **Contexto**: Os PRs #249, #251 e #252 corrigiram bugs de timezone na exibição e gravação. Mas dados gravados **antes** dos fixes ficaram com timestamps deslocados. Este doc te orienta a auditar e corrigir cirurgicamente.

## TL;DR

Existem **2 categorias** de bugs históricos:

| Categoria | Onde | Como corrigir |
|---|---|---|
| 🟢 **Server-side** (gravou wall-clock como UTC) | `leads.data_prospeccao_agendada`, `leads.data_reuniao_marco_zero`, `calendar_events` criados via prospecção | UPDATE em massa: **adicionar 4h** (offset de Cuiabá) |
| 🟡 **Browser-side** (cada browser converteu com seu fuso) | `social_media_posts.agendar_para`, `design_artes.agendado_para` | Auditoria manual — não dá pra UPDATE em massa porque depende do fuso do colaborador que salvou |

Você só consegue corrigir o grupo 🟢 com SQL. O grupo 🟡 precisa olhar caso a caso.

---

## Antes de começar — backup

Antes de QUALQUER UPDATE, faça backup das colunas afetadas:

```sql
-- Salva snapshot pra reverter se algo der errado
create table if not exists public._tz_backup_20260513 as
select
  id,
  data_prospeccao_agendada,
  data_reuniao_marco_zero
from public.leads
where data_prospeccao_agendada is not null
   or data_reuniao_marco_zero is not null;

create table if not exists public._tz_backup_calendar_events_20260513 as
select
  id,
  inicio,
  fim,
  lead_id,
  created_at
from public.calendar_events
where lead_id is not null;
```

Se algo der errado, reverter com:
```sql
update public.leads l
set data_prospeccao_agendada = b.data_prospeccao_agendada,
    data_reuniao_marco_zero = b.data_reuniao_marco_zero
from public._tz_backup_20260513 b
where b.id = l.id;
```

---

## 🟢 Grupo 1 — Server-side (CORRIGÍVEL)

### O que estava errado

Em `leads/actions.ts` e `prospeccao/actions.ts`, o valor do input `datetime-local` (que vem como string `"2026-05-15T14:00"` SEM timezone) ia direto pro Supabase. Postgres armazena em `timestamptz` e **interpreta string sem TZ como UTC**.

Resultado: usuário queria gravar "14:00 Cuiabá (UTC-4)" mas o banco guardou "14:00 UTC". **Diferença: precisa somar 4h** pra trazer pro valor correto.

### Janela temporal

Antes do **merge do PR #252** (assumindo que você vai mergear logo). Use uma data de corte segura, ex.: `2026-05-13T00:00:00Z`. Ajuste conforme quando você mergear/redeployar.

### Passo 1 — AUDITAR (não muda nada)

Rode os 3 SELECTs abaixo no Supabase SQL Editor pra ver quantos registros serão afetados:

```sql
-- 1.A — leads.data_prospeccao_agendada
select count(*) as total_a_corrigir
from public.leads
where data_prospeccao_agendada is not null
  and data_prospeccao_agendada < '2026-05-13T00:00:00Z';

-- 1.B — leads.data_reuniao_marco_zero
select count(*) as total_a_corrigir
from public.leads
where data_reuniao_marco_zero is not null
  and data_reuniao_marco_zero < '2026-05-13T00:00:00Z';

-- 1.C — calendar_events criados via agendarReuniaoAction (lead_id != null)
select count(*) as total_a_corrigir
from public.calendar_events
where lead_id is not null
  and created_at < '2026-05-13T00:00:00Z';
```

### Passo 2 — VER EXEMPLOS antes de aplicar

Antes do UPDATE, veja como ficaria a correção:

```sql
-- Exemplos de leads.data_prospeccao_agendada
select
  id,
  nome_prospect,
  data_prospeccao_agendada as antes_utc,
  to_char(data_prospeccao_agendada at time zone 'UTC', 'DD/MM HH24:MI') as antes_visualizado_utc,
  to_char(data_prospeccao_agendada at time zone 'America/Cuiaba', 'DD/MM HH24:MI') as antes_visualizado_cuiaba,
  data_prospeccao_agendada + interval '4 hours' as depois_utc,
  to_char((data_prospeccao_agendada + interval '4 hours') at time zone 'America/Cuiaba', 'DD/MM HH24:MI') as depois_visualizado_cuiaba
from public.leads
where data_prospeccao_agendada is not null
  and data_prospeccao_agendada < '2026-05-13T00:00:00Z'
limit 10;
```

**Confira manualmente alguns**:
- Pega um lead que você lembra (ex.: pergunta pra alguém que agendou) qual horário foi DIGITADO no form
- Compara com a coluna `antes_visualizado_cuiaba` (o que aparece pra usuários hoje)
- Compara com `depois_visualizado_cuiaba` (o que deve aparecer após o UPDATE)

Se `depois_visualizado_cuiaba` bate com o que o usuário lembra ter digitado → pode rodar o UPDATE.

### Passo 3 — APLICAR a correção

⚠️ **Faça o backup do "Antes de começar" PRIMEIRO.**

```sql
-- ATENÇÃO: rode UMA vez só. Rodar 2x adiciona 8 horas.

-- A — leads.data_prospeccao_agendada
update public.leads
set data_prospeccao_agendada = data_prospeccao_agendada + interval '4 hours'
where data_prospeccao_agendada is not null
  and data_prospeccao_agendada < '2026-05-13T00:00:00Z';

-- B — leads.data_reuniao_marco_zero
update public.leads
set data_reuniao_marco_zero = data_reuniao_marco_zero + interval '4 hours'
where data_reuniao_marco_zero is not null
  and data_reuniao_marco_zero < '2026-05-13T00:00:00Z';

-- C — calendar_events criados via prospecção (têm lead_id)
update public.calendar_events
set inicio = inicio + interval '4 hours',
    fim = fim + interval '4 hours'
where lead_id is not null
  and created_at < '2026-05-13T00:00:00Z';
```

### Passo 4 — VALIDAR

Pega 2-3 leads conhecidos e confere com os colaboradores que agendaram:
- Abre o lead em `/onboarding/[id]` ou `/prospeccao/prospects/[id]`
- A hora exibida deve bater com o que foi DIGITADO originalmente
- Se bater: ✅
- Se ainda estiver errado: usar o backup pra reverter e me chamar

---

## 🟡 Grupo 2 — Browser-side (AUDITORIA MANUAL)

### O que estava errado

Em `PostFormModal.tsx` (social media) e `AgendarPostagemModal.tsx` (design), o código fazia:

```ts
const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
return local.toISOString();
```

`getTimezoneOffset()` é do **browser do colaborador que está usando o sistema**. Então:
- Colaborador em Cuiabá (UTC-4) digita "14:00" → grava `2026-05-15T18:00Z` (correto por sorte, mas só funciona se ele está em Cuiabá)
- Colaborador em SP viajando (UTC-3) digita "14:00" → grava `2026-05-15T17:00Z` (errado, deveria ser 18:00Z se a intenção era 14:00 Cuiabá)

**Não dá pra UPDATE em massa porque cada registro depende do fuso do browser que salvou.** Sem auditoria, vc não sabe quem estava em qual fuso na hora.

### Auditoria

Liste posts/artes agendados pra ver quais estão suspeitos:

```sql
-- Posts agendados (futuros, não publicados ainda)
select
  p.id,
  p.titulo,
  c.nome as cliente,
  p.agendar_para as gravado_utc,
  to_char(p.agendar_para at time zone 'America/Cuiaba', 'DD/MM HH24:MI') as visualizacao_cuiaba,
  p.created_at,
  prof.nome as criado_por
from public.social_media_posts p
left join public.clients c on c.id = p.client_id
left join public.profiles prof on prof.id = p.created_by
where p.agendar_para is not null
  and p.agendar_para > now()
  and p.archived_at is null
order by p.agendar_para;
```

```sql
-- Artes agendadas (futuras)
select
  a.id,
  a.nome,
  c.nome as cliente,
  a.agendado_para as gravado_utc,
  to_char(a.agendado_para at time zone 'America/Cuiaba', 'DD/MM HH24:MI') as visualizacao_cuiaba,
  a.created_at,
  prof.nome as criado_por
from public.design_artes a
left join public.clients c on c.id = a.client_id
left join public.profiles prof on prof.id = a.created_by
where a.agendado_para is not null
  and a.agendado_para > now()
order by a.agendado_para;
```

Pra cada registro suspeito:
1. Pergunta pro `criado_por` qual horário ele DIGITOU
2. Compara com `visualizacao_cuiaba`
3. Se diferente, corrige manualmente:

```sql
-- Exemplo de correção individual (ajusta horas conforme o caso)
update public.social_media_posts
set agendar_para = '2026-05-20T17:00:00Z'  -- ISO UTC do horário correto em Cuiabá
where id = 'uuid-do-post';

update public.design_artes
set agendado_para = '2026-05-20T17:00:00Z'
where id = 'uuid-da-arte';
```

### Heurística pra agilizar

Se você sabe que **a maioria dos colaboradores estava em Cuiabá** quando salvaram (= browser UTC-4), pode aplicar o mesmo UPDATE de massa do Grupo 1. Mas só se você tem alta confiança nisso. Em caso de dúvida, faça auditoria manual.

---

## Reverter tudo (rollback)

Se algo der errado após qualquer UPDATE:

```sql
-- Reverte leads
update public.leads l
set data_prospeccao_agendada = b.data_prospeccao_agendada,
    data_reuniao_marco_zero = b.data_reuniao_marco_zero
from public._tz_backup_20260513 b
where b.id = l.id;

-- Reverte calendar_events
update public.calendar_events ce
set inicio = b.inicio,
    fim = b.fim
from public._tz_backup_calendar_events_20260513 b
where b.id = ce.id;

-- Quando confirmar que está tudo OK, apaga os backups:
-- drop table public._tz_backup_20260513;
-- drop table public._tz_backup_calendar_events_20260513;
```

---

## Cronograma sugerido

1. **Backup** (1 min): roda o bloco de backup
2. **Auditar Grupo 1** (5 min): roda os 3 SELECTs de contagem + o de exemplos
3. **Validar com colaboradores** (15-30 min): pega 3-5 exemplos, confirma horários
4. **Aplicar Grupo 1** (1 min): roda os 3 UPDATEs
5. **Validar UI** (5 min): abre alguns leads, confere
6. **Auditar Grupo 2** (10 min): roda os 2 SELECTs
7. **Decidir Grupo 2**: aplicar heurística OU caso a caso
8. **Após 1 semana sem reports de erro**: drop dos backups

Total: ~1h. Recomendo fazer fora do horário de pico.
