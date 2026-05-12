# Painel do Cliente — design

> Portal externo onde clientes finais da Yide podem acompanhar a performance deles.

**Decisões fechadas com Yasmin:**
- Auth: email + senha (não magic link)
- Onboarding: Yasmin cria acesso, sistema gera senha aleatória, revela uma vez (mesmo padrão de colaborador novo)
- Fase 1: Contrato + Tráfego + Pasta Drive + CRM placeholder (visual sem integração)
- Fase 2: Satisfação dupla + Últimas reuniões
- Fase 3: CRM tracking real + customizações

## Arquitetura

### Isolamento auth

Cliente final usa Supabase Auth **compartilhado** com a equipe (mesma `auth.users` table), mas a identidade dele é registrada numa tabela separada `client_portal_users` (linkando `auth.user.id` → `client.id`). Isso evita:
- Adicionar `cliente` no enum `app_role` (quebraria RLS espalhado)
- Cliente aparecendo em listas de colaboradores
- Permissions matrix precisar de role extra

Decisão: cada `auth.user` é OU um colaborador (`profiles`) OU um cliente portal (`client_portal_users`), nunca os dois.

### Schema

```sql
create table public.client_portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  nome_contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index idx_client_portal_users_client_id on public.client_portal_users(client_id);
```

### RLS

Cliente portal só lê os próprios dados:

```sql
-- Cliente portal lê apenas a própria linha em client_portal_users
alter table public.client_portal_users enable row level security;
create policy "self_read_portal_user" on public.client_portal_users
  for select using (user_id = auth.uid());

-- Cliente portal lê apenas o próprio client em clients
create policy "client_portal_reads_own_client" on public.clients
  for select using (
    id in (select client_id from public.client_portal_users where user_id = auth.uid())
  );

-- Equipe interna continua tendo acesso total via service-role (já é o padrão)
```

### Roteamento

```
/login              → portal interno (existente)
/cliente/login      → portal cliente (NOVO)
/cliente            → dashboard cliente (NOVO)
/painel-cliente     → admin interno: gerenciar acessos de clientes (NOVO)
```

### Middleware

Atualização em `src/middleware.ts`:
- `/cliente/login` → público
- `/cliente/*` → exige auth + verifica que `user.id` está em `client_portal_users`
- `/` e `/painel-cliente` etc. → exige auth + verifica que está em `profiles` (já é o padrão)

Cliente logado tentando `/` → redirect `/cliente`. Colab logado tentando `/cliente` → redirect `/`.

### Auth helpers

Novo: `src/lib/auth/client-portal-session.ts`
- `getClientPortalUser()` — retorna `{ userId, clientId, nomeContato, clientNome }` ou null
- `requireClientPortalAuth()` — redirect `/cliente/login` se não autenticado

`src/lib/auth/session.ts` existente (`getCurrentUser`) **filtra**: se o `auth.user.id` está em `client_portal_users`, retorna null (cliente portal user não pode entrar como colab).

## Telas

### Admin: `/painel-cliente`

Lista todos os clientes ativos com coluna "Acesso ao portal":

| Cliente | Status | Email do contato | Último login | Ações |
|---|---|---|---|---|
| Pizzaria Bella | Ativo | dono@pizzaria.com | 12/05 09:30 | [Resetar senha] [Revogar] |
| Restaurante Sabor | Sem acesso | — | — | [Conceder acesso] |

**Modal "Conceder acesso":**
- Email do contato (input)
- Nome do contato (input)
- Botão "Criar acesso"
- Ao submeter: gera senha, mostra com `RevealedPasswordBlock` (já existe), instrui a copiar e enviar

**Botão "Resetar senha":**
- Gera nova senha, mostra com `RevealedPasswordBlock`

**Botão "Revogar":**
- Set `ativo = false` em `client_portal_users`
- Não deleta auth.user (mantém histórico)
- Cliente logado é deslogado no próximo request (middleware checa `ativo`)

### Cliente: `/cliente/login`

Login form simples (email + senha). Layout reusa `(auth)/layout.tsx` (gradient mesh background) com branding "Yide Digital - Portal do cliente".

### Cliente: `/cliente`

Layout: full-width, sem sidebar interno. Header simples com logo Yide + nome do cliente + botão "Sair".

**Seções na ordem:**

1. **Hero**
   ```
   Olá, [nome_contato] 👋
   Sua conta com a Yide Digital · Cliente desde [data_entrada]
   ```

2. **Contrato** (card)
   - Serviço contratado
   - Modalidade (mensal/pontual)
   - Valor mensal
   - Tipo de pacote
   - Seu assessor: [nome do assessor]

3. **Tráfego pago do mês** (2 cards lado a lado)
   - Google: R$ [valor_trafego_google]
   - Meta: R$ [valor_trafego_meta]
   - Total: R$ [soma]

4. **Sua pasta** (CTA grande)
   - Botão grande linkando `clients.drive_url`
   - Se sem drive_url: "Sua agência ainda não compartilhou uma pasta — pergunte ao seu assessor"

5. **Seu CRM** (placeholder Fase 1)
   - Card com texto: "🚧 Em breve você vai poder acompanhar tudo sobre o seu CRM aqui — leads, follow-ups, status. Em desenvolvimento."
   - Visual presente, sem integração

## Fora do escopo da Fase 1

- Satisfação dupla (Fase 2)
- Últimas reuniões com resumo IA (Fase 2)
- CRM tracking real (Fase 3)
- Recuperação de senha pelo cliente (Fase 3 ou pedir pra agência reset)
- Email transacional (não usar ainda, password via WhatsApp)
- Customização de seções por cliente

## Risk / unknowns

- **Permissões RLS:** policy `client_portal_reads_own_client` precisa ser testada com o cliente realmente logado pra garantir que ele vê apenas o próprio. Service-role bypassa, então testar com anon-key.
- **Auth conflito:** se o mesmo email existe em `profiles` E foi cadastrado em `client_portal_users`, dá conflito. Mitigação: server action valida que email não existe em `profiles` antes de criar.
- **Avatar / branding:** Fase 1 deixa branding Yide só. Fase 4 talvez tema por cliente.
