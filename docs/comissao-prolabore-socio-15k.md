# Mudança de modelo: Sócio vira "Coordenador" no UI + prolábore fixo R$ 15.000

> **Decisão de produto Yasmin** (revisa o que tinha sido feito no PR #257):
> - Sócio passa a ter **prolábore fixo de R$ 15.000** (antes era invisível no calculator)
> - Sócio aparece no UI como **"Coordenador"** (role `socio` no banco continua, só muda label)
> - Role `coordenador` antigo é **descontinuado** (deixou de existir como função)
> - Coordenadores remanescentes no banco aparecem como "Coordenador (legado)" pra você decidir caso a caso

## Mudanças no código

### Calculator
- `socio` agora entra no cálculo (antes retornava `null` no `computeCommissionForProfile` e era excluído do batch via `neq("role", "socio")`)
- Sócio sai com `fixo = profile.fixo_mensal`, sem variável
- Item de fixo pra sócio tem descrição `"Prolábore"` em vez de `"Fixo mensal"`
- Role `coordenador` não tem mais tratamento especial — cai no fallback genérico (só fixo)

### Preview (`comissao-prevista.ts`)
- Tipo `Role` agora aceita `"socio"` também
- `socio` e `coordenador`: pulam cálculo variável

### Labels UI (10 arquivos)
- `socio` → exibe como **"Coordenador"**
- `coordenador` → exibe como **"Coordenador (legado)"**
- Form de criar novo colaborador: opção `coordenador` removida (não dá mais pra criar)
- Form de editar colaborador: opção `coordenador` aparece SÓ quando o user editado já tem esse role (evita quebrar a renderização)

## Passos pra colocar em produção

### 1. Mergear este PR

Code change. UI já mostra "Coordenador" no lugar de "Sócio" depois do redeploy.

### 2. Atualizar `profiles.fixo_mensal` (Supabase SQL Editor)

```sql
-- BACKUP primeiro
create table if not exists public._socio_fixo_backup as
select id, nome, role, fixo_mensal, comissao_percent
from public.profiles
where role in ('socio', 'coordenador');
```

```sql
-- Setar prolábore de R$ 15.000 nos sócios ativos
update public.profiles
set fixo_mensal = 15000,
    comissao_percent = 0
where role = 'socio'
  and ativo = true;
```

```sql
-- Conferir
select id, nome, role, fixo_mensal, comissao_percent
from public.profiles
where role in ('socio', 'coordenador')
order by role, nome;
```

### 3. Decidir caso a caso: quem hoje é `coordenador` no banco

```sql
-- Listar coordenadores remanescentes
select id, nome, email, ativo, fixo_mensal, created_at
from public.profiles
where role = 'coordenador';
```

Pra cada um, decidir:

**A) Promover pra "Coordenador" novo (= role `socio`)**:
```sql
-- ATENÇÃO: dá ao colaborador as permissões de SÓCIO (acesso financeiro,
-- ver carteira completa, etc.). Só faça pra quem realmente é socio/coord-geral.
update public.profiles
set role = 'socio',
    fixo_mensal = 15000,
    comissao_percent = 0
where id = '<UUID>';
```

**B) Rebaixar pra assessor**:
```sql
update public.profiles
set role = 'assessor'
where id = '<UUID>';
```
Lembre de revisar `comissao_percent` no perfil dele pra assessor.

**C) Desativar (manter histórico mas sem acesso)**:
```sql
update public.profiles
set ativo = false
where id = '<UUID>';
```

**D) Não fazer nada agora**: continua como "Coordenador (legado)" no UI. Comissão sai como só fixo. Pode decidir depois.

### 4. Validar

- Logar como sócio → no UI aparece como "Coordenador"
- `/colaboradores` → tabela mostra "Coordenador" pros sócios, "Coordenador (legado)" pros coordenadores antigos remanescentes
- Form de criar novo colaborador: dropdown só mostra "Coordenador" (e não tem mais "Coordenador (legado)")
- `/comissoes/visao-geral`: sócio agora aparece com R$ 15.000 fixo, R$ 0 variável
- Snapshot mensal do mês corrente: sócio incluído

## Rollback

```sql
-- Restaurar valores anteriores
update public.profiles p
set fixo_mensal = b.fixo_mensal,
    comissao_percent = b.comissao_percent,
    role = b.role
from public._socio_fixo_backup b
where b.id = p.id;
```

E reverter o PR no GitHub.

## Por que não renomear o enum no banco?

O role `socio` no enum `app_role` está espalhado em:
- Constraints
- RLS policies de várias tabelas
- Campos em outras tabelas que referenciam role como string

Renomear o enum exigiria migration grande + risco de break em RLS. Mais seguro **manter o role e só trocar o label visível**. Sócios continuam tendo as mesmas permissões (financeiro, etc.) — só o nome muda na UI.

## Snapshots históricos

Snapshots fechados não mudam (valores já em `commission_snapshots`). Apenas:
- ✅ Mês corrente (preview ao vivo recalcula)
- ✅ Snapshots futuros
