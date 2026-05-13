# Múltiplos acessos por cliente no painel-cliente

**Data:** 2026-05-13
**Status:** Aprovado, pronto pra plano de implementação

## Contexto

Hoje o `/painel-cliente` permite **1 acesso ativo por cliente** ao portal externo. Empresas com sócios precisam de mais de um login: cada sócio entra com a conta dele pra acompanhar contrato, tráfego, entregas etc.

Vamos permitir **até 5 acessos ativos por cliente**.

## Estado atual

- DB (`client_portal_users`): schema já aguenta múltiplos rows por cliente. PK é `user_id`; `client_id` não tem unique constraint.
- App: `createClientPortalAccessAction` bloqueia o 2º acesso ativo ([`actions.ts:66-74`](../../../src/lib/painel-cliente/actions.ts)).
- UI: `PainelClienteTable` mostra 1 linha por cliente com o único acesso inline.
- Acesso à página: só `adm` e `socio`.

## Mudanças

### DB

Nenhuma migração. Schema já suporta o caso N:1.

### Server actions ([`src/lib/painel-cliente/actions.ts`](../../../src/lib/painel-cliente/actions.ts))

`createClientPortalAccessAction`:
- Trocar o check "já tem 1 acesso ativo → erro" por:
  - Contar `client_portal_users` com `client_id = ? AND ativo = true`.
  - Se `>= 5`, retornar erro `"Limite de 5 acessos ativos por cliente atingido. Revogue um pra criar outro."`.
- Resto idêntico: cria `auth.user`, insere em `client_portal_users`, gera senha forte, audit log, rollback de `auth.user` em caso de falha no insert.

`resetClientPortalPasswordAction` e `revokeClientPortalAccessAction`: sem mudança — já operam por `user_id`.

### Queries ([`src/lib/painel-cliente/queries.ts`](../../../src/lib/painel-cliente/queries.ts))

`listClientesComAcessoPortal`:
- Mudar tipo de retorno: `portal: Portal | null` → `portals: Portal[]`.
- Cada cliente vem com todos seus portal_users (ativos + revogados), ordenados por `created_at desc`.
- Demais campos do cliente continuam iguais.

Novo shape:

```ts
interface ClienteComAcesso {
  client_id: string;
  client_nome: string;
  client_ativo: boolean;
  portals: Array<{
    user_id: string;
    email: string;
    nome_contato: string | null;
    ativo: boolean;
    created_at: string;
    last_login_at: string | null;
  }>;
}
```

### Página ([`src/app/(authed)/painel-cliente/page.tsx`](../../../src/app/(authed)/painel-cliente/page.tsx))

Atualizar contadores do header pro novo shape:
- "X com acesso" = clientes com `portals.some(p => p.ativo)`
- "Y sem acesso" = clientes com `portals.length === 0`
- "Z revogados" = clientes com `portals.length > 0 && !portals.some(p => p.ativo)`

### Tabela ([`src/components/painel-cliente/PainelClienteTable.tsx`](../../../src/components/painel-cliente/PainelClienteTable.tsx))

**Cabeçalho da tabela** (renomear 1 coluna):
- `Cliente | Status | Acessos | Último login | Ações`
- "Email do contato" vira "Acessos".

**Linha-resumo (estado recolhido):**
- Chevron à esquerda do nome do cliente (só renderiza se `portals.length > 0`).
- `Status` agregado:
  - `Ativo` se ≥1 ativo
  - `Revogado` se `portals.length > 0` mas nenhum ativo
  - `Sem acesso` se vazio
- `Acessos`: contagem amigável — `"3 ativos"`, `"2 ativos · 1 revogado"`, ou `"Sem acesso"`.
- `Último login`: `max(last_login_at)` entre os acessos ativos; "—" se nenhum.
- `Ações` na linha-resumo:
  - Sem acesso → botão **"Conceder acesso"**.
  - Com ≥1 acesso → **"Copiar link"** (as ações por acesso ficam no expandido).

**Expansão:** clicar na linha (ou chevron) toggla. Estado local: `useState<Set<string>>` com `client_id` expandidos.

**Sub-tabela expandida (uma row por acesso):**

Colunas: `Nome do contato | Email | Status | Último login | Ações`

| Estado do acesso | Ações renderizadas |
|---|---|
| Ativo | `Resetar senha` · `Revogar` |
| Revogado | `Conceder novo` (reusa fluxo existente — abre dialog pra criar outro acesso pro mesmo cliente) |

Embaixo da sub-tabela, um rodapé:
- Se `portals.filter(p => p.ativo).length < 5` → botão **"+ Adicionar acesso de sócio"** (abre `ConcederAcessoDialog`).
- Se já tem 5 ativos → botão desabilitado com tooltip "Limite de 5 acessos ativos por cliente".

**Filtros** existentes (`Todos / Com acesso / Sem acesso / Revogados`) continuam mas adaptados ao novo shape:
- `Com acesso`: `portals.some(p => p.ativo)`
- `Sem acesso`: `portals.length === 0`
- `Revogados`: `portals.length > 0 && !portals.some(p => p.ativo)`

### Componentes auxiliares

| Arquivo | Mudança |
|---|---|
| `ConcederAcessoDialog.tsx` | Nenhuma — já recebe `clientId`/`clientNome`. Só vai ser chamado mais vezes. |
| `ResetPasswordDialog.tsx` | Nenhuma — opera por `user_id`. |
| `RevogarAcessoButton.tsx` | Nenhuma. |
| `CopyLinkButton.tsx` | Nenhuma. |

## Erros / edge cases

- **6º acesso ativo:** server action retorna erro amigável. UI também deve esconder o botão (defense in depth, mas server é a fonte da verdade).
- **Email duplicado:** mesma regra de hoje — `auth.users.email` é único globalmente, e o check em `profiles` continua bloqueando email de colaborador interno.
- **2 sócios no mesmo email:** não permitido (Supabase enforça). Cada sócio precisa de email próprio.
- **Revogados:** não contam pro teto de 5. Cliente pode ter 5 ativos + N revogados.

## Permissões

Sem mudança: só `adm` e `socio` acessam a página e as actions. Cada portal user, uma vez logado, enxerga o mesmo conjunto de dados do cliente (sem permissões granulares por sócio — fora de escopo).

## Audit log

Sem mudança: cada `create`/`update`/`soft_delete` em `client_portal_users` já loga via `logAudit`. Múltiplos acessos = múltiplas entradas, naturalmente.

## Testes

**Unit ([`tests/unit/painel-cliente-actions.test.ts`](../../../tests/unit/), novo se não existir):**
- Cria 1º acesso → ok.
- Cria 2º a 5º acesso ativo no mesmo cliente → ok.
- Cria 6º acesso ativo → erro "Limite de 5...".
- Cria acesso com 5 ativos + revogados existentes → conta só os 5 ativos, retorna o erro corretamente.
- Revoga um, cria novo → ok (volta a ter 5 ativos).

**E2E ([`tests/e2e/painel-cliente.spec.ts`](../../../tests/e2e/), se existir):**
- Adicionar 2 acessos pro mesmo cliente.
- Expandir e ver os 2 acessos listados.
- Revogar 1 dos 2; outro continua ativo; contadores corretos.

## Fora de escopo

- Permissões diferenciadas entre sócios do mesmo cliente.
- UI mobile-only para o painel interno (continua usando o layout atual de tabela).
- Notificação quando um sócio é adicionado/revogado (segue o audit log de hoje).
- Limite configurável por cliente (fica fixo em 5).
