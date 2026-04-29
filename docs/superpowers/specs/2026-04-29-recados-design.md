# Recados (Yide Digital) — Design

**Data:** 2026-04-29
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md)

---

## 1. Objetivo

Mural de recados internos da agência. Qualquer colaborador pode postar, com prioridade visual hierárquica (Sócio > Coordenador > Assessor > Geral) e notificação opcional. Substitui mensagens informais soltas em grupos de WhatsApp por um histórico organizado dentro do sistema.

**Princípios:**
- Mural compartilhado — todo mundo vê todos os recados (visibilidade total, igual `tasks` e `clients`).
- Hierarquia visual, não restritiva — todos podem postar, mas a UI dá destaque por papel.
- Postagem leve (título + corpo); reações de emoji pra engajamento sem virar fórum.
- Notificação é escolha do autor por post (não há regra automática global).
- Ciclo de vida automático: arquiva após 30 dias, exceto recados marcados como permanentes pelo Sócio.

**Fora do escopo (v1):**
- Comentários inline / threads.
- Anexos (imagem, arquivo).
- Mentions (`@usuário`) com notificação direcionada.
- Custom emoji ou paleta extensível de reações.
- Notificação por email (mural gera muito volume — fica só no sininho).
- Audit log das edições/exclusões de recado.
- Realtime (sem WebSocket / sem polling — recarrega a cada navegação).
- Filtros por papel, busca por texto.
- Página de detalhe `/recados/[id]` (tudo no feed).

---

## 2. Modelo de dados

### Tabela `recados` (nova)

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `autor_id` | uuid | FK → `profiles(id)`, NOT NULL, ON DELETE SET NULL aceitável |
| `autor_role_snapshot` | text | NOT NULL — congela `profiles.role` no momento da criação. Define o tier visual mesmo se o autor mudar de papel depois. |
| `titulo` | text | NOT NULL, CHECK length entre 1 e 120 |
| `corpo` | text | NOT NULL, CHECK length entre 1 e 2000 |
| `permanente` | bool | NOT NULL, DEFAULT false — se `true`, não arquiva via cron |
| `arquivado` | bool | NOT NULL, DEFAULT false |
| `notif_scope` | text | NOT NULL, CHECK in (`'todos'`, `'meu_time'`, `'nenhum'`) |
| `criado_em` | timestamptz | NOT NULL, DEFAULT `now()` |
| `atualizado_em` | timestamptz | NOT NULL, DEFAULT `now()` (atualizado via trigger ou na action de edição) |

**Índices:**
- `(arquivado, permanente, criado_em desc)` — query principal do feed Ativos.
- `(autor_id)` — pra contagens / debug.

### Tabela `recado_visualizacoes` (nova)

| Campo | Tipo | Restrição |
|---|---|---|
| `user_id` | uuid | PK, FK → `profiles(id)` ON DELETE CASCADE |
| `last_seen_at` | timestamptz | NOT NULL, DEFAULT `now()` |

Uma linha por usuário. "Tudo criado até `last_seen_at` eu já vi". Mantém o badge simples e barato (1 row por user, sem N×M de leituras).

### Tabela `recado_reacoes` (nova)

| Campo | Tipo | Restrição |
|---|---|---|
| `recado_id` | uuid | FK → `recados(id)` ON DELETE CASCADE |
| `user_id` | uuid | FK → `profiles(id)` ON DELETE CASCADE |
| `emoji` | text | CHECK in (`'👍'`, `'❤️'`, `'✅'`, `'🎉'`) |
| `criado_em` | timestamptz | NOT NULL, DEFAULT `now()` |

PK composta `(recado_id, user_id, emoji)` — usuário pode reagir com emojis diferentes ao mesmo recado, mas não duplicar o mesmo emoji.

---

## 3. Permissões e RLS

| Operação | Quem |
|---|---|
| `SELECT recados` | Qualquer authenticated |
| `INSERT recados` | Qualquer authenticated (`autor_id = auth.uid()`) |
| `UPDATE recados` (titulo, corpo, arquivado) | autor OR `socio`/`adm` |
| `UPDATE recados` (permanente) | apenas `socio` |
| `DELETE recados` | autor OR `socio`/`adm` |
| `SELECT recado_visualizacoes` | apenas o próprio user |
| `INSERT/UPDATE recado_visualizacoes` | apenas o próprio user (`user_id = auth.uid()`) |
| `SELECT recado_reacoes` | qualquer authenticated |
| `INSERT/DELETE recado_reacoes` | apenas o próprio user (`user_id = auth.uid()`) |

`current_user_role()` (helper SQL já existente) é usado nas políticas de moderação (socio/adm).

---

## 4. UI

### Sidebar

Item novo entre **Tarefas** e **Painel mensal**: `Recados` (ícone `MessageSquare` do lucide), `roles: "all"`. Badge numérico (estilo do `NotificationBell`) com contagem de recados ativos não-fixados criados após `last_seen_at` do user.

### Página `/recados`

```
┌─ Header ────────────────────────────────────────────┐
│ Recados                            [+ Novo recado]  │
│ [Ativos] [Arquivados]                               │
└─────────────────────────────────────────────────────┘

┌─ 📌 Fixados ────────────────────────────────────────┐  (só renderiza se houver permanente=true)
│  cards                                               │
└─────────────────────────────────────────────────────┘

┌─ Sócios ───────────────────────────────────────────┐  bg azul-marinho intenso (sky-900)
│  cards                                              │
└────────────────────────────────────────────────────┘

┌─ Coordenadores ────────────────────────────────────┐  bg azul-médio (sky-700)
│  cards                                              │
└────────────────────────────────────────────────────┘

┌─ Assessores ───────────────────────────────────────┐  bg turquesa claro (cyan-400)
│  cards                                              │
└────────────────────────────────────────────────────┘

┌─ Geral ────────────────────────────────────────────┐  bg muted (cinza tema)
│  cards                                              │
└────────────────────────────────────────────────────┘
```

**Renderização:** Server Component carrega todos os recados ativos (ou arquivados, conforme aba), agrupa em memória por tier (`Sócios` / `Coordenadores` / `Assessores` / `Geral`) usando `autor_role_snapshot`, ordena por `criado_em desc` dentro de cada tier. Seção que ficar vazia não renderiza.

**Permanente=true:** sai dos tiers normais e vai pra seção "📌 Fixados" no topo, ordenada por `criado_em desc`. Se não houver fixados, a seção inteira não aparece.

### Card de recado

- Avatar do autor (usa `avatar_url` do profile, com fallback de iniciais — mesmo padrão do `UserMenu`).
- Nome + badge de papel (text-only, ex: "Coordenador").
- Título (`font-semibold`).
- Corpo (`whitespace-pre-wrap`, máx 2000 chars com `text-sm`).
- Hora relativa pt-BR ("há 2h", "há 3 dias") via helper já existente, com tooltip da data absoluta.
- Rodapé: chips de reação `👍 3`, `❤️ 1`, etc. — clique alterna a reação do user. Botão `+` ao final abre popover com os 4 emojis disponíveis.
- Menu `⋯` (DropdownMenu) no canto superior direito:
  - **Editar** (autor OR socio/adm)
  - **Apagar** (autor OR socio/adm) — confirmação obrigatória
  - **Arquivar** (autor OR socio/adm) — só na aba Ativos
  - **Desarquivar** (autor OR socio/adm) — só na aba Arquivados
  - **Fixar** / **Desafixar** (apenas socio)

### Paleta (4 tons, aprovada pela usuária)

| Tier | Background da seção | Token Tailwind |
|---|---|---|
| Sócios | `#0c4a6e` | `bg-sky-900` |
| Coordenadores | `#0369a1` | `bg-sky-700` |
| Assessores | `#22d3ee` | `bg-cyan-400` |
| Geral | `var(--muted)` | `bg-muted` |

Cards dentro das seções coloridas usam `bg-card` (mantém legibilidade) com borda sutil herdada da seção. Texto adapta-se ao contraste (claro nos azuis fortes, padrão no muted).

### Dialog "Novo recado"

Componente `Dialog` (shadcn) com formulário:
- Input `titulo` (max 120, contador)
- Textarea `corpo` (max 2000, contador, `whitespace-pre-wrap`)
- Select `notif_scope`:
  - `todos` — "Notificar todo mundo"
  - `meu_time` — "Notificar só meu time" (com tooltip explicando quem entra)
  - `nenhum` — "Não notificar (só vai ficar no mural)"
- Se user é `socio`: checkbox "Fixar permanentemente"
- Botão `Postar` (loading state via `useTransition`)

Mesmo dialog é reaproveitado pra "Editar" (preenche valores, sem o select de notif — edição não dispara nova notificação).

---

## 5. Notificações

### Quando dispara

Apenas no **INSERT** de um novo recado, conforme `notif_scope` escolhido pelo autor. **Edição não dispara.**

### Resolução de destinatários

| `notif_scope` | Destinatários |
|---|---|
| `todos` | Todos os profiles `ativo=true` exceto o `autor_id` |
| `meu_time` | Função SQL `recados_team_member_ids(autor_id)` (criada nesta migration) — ver tabela abaixo |
| `nenhum` | Nenhum |

### Função `recados_team_member_ids(autor uuid) returns setof uuid`

Lógica por papel do autor:

| Papel do autor | "Meu time" |
|---|---|
| `socio`, `adm` | Todos os ativos exceto o autor |
| `coordenador` | Os assessores que ele coordena (DISTINCT `clients.assessor_id` WHERE `clients.coordenador_id = autor`) |
| `assessor` | Seu coordenador (DISTINCT `clients.coordenador_id` WHERE `clients.assessor_id = autor`) + os outros assessores do(s) mesmo(s) coordenador(es) |
| `comercial` | Outros profiles ativos com `role = 'comercial'` exceto o autor |
| `audiovisual_chefe`, `videomaker`, `designer`, `editor` | Profiles ativos com `role in ('audiovisual_chefe','videomaker','designer','editor')` exceto o autor |

Se a função retornar 0 destinatários (ex: assessor sem cliente atribuído), nenhum recipient — silenciosamente sem notificação. (Não erro.)

### Integração com sistema de notificações existente

Na server action `criarRecadoAction`, depois do INSERT do recado, se `notif_scope !== 'nenhum'`, resolve a lista de `recipientIds` (via `recados_team_member_ids` ou todos-os-ativos) e chama `dispatchNotification` (helper existente em `src/lib/notificacoes/dispatch.ts`):

```ts
await dispatchNotification({
  evento_tipo: 'recado_novo',
  titulo: `Novo recado de ${autor.nome}`,
  mensagem: recado.titulo,
  link: `/recados#${recado.id}`,
  user_ids_extras: recipientIds,
  source_user_id: autor.id,
});
```

**Mudanças necessárias no sistema de notificações:**

1. **Migration:** `ALTER TYPE notification_event ADD VALUE 'recado_novo'`.
2. **Seed em `notification_rules`** (mesma migration): registro com `evento_tipo='recado_novo'`, `ativo=true`, `mandatory=false`, `email_default=false`, `permite_destinatarios_extras=true`, `default_roles=[]`, `default_user_ids=[]` — destinatários são 100% dinâmicos via `user_ids_extras` (não há regra estática global).
3. **Sem seed em `notification_preferences`**: o `dispatchNotification` já trata ausência de preferência como `in_app=true` (default `pref?.in_app ?? true`). Usuário cria preferência só quando muda explicitamente em `/configuracoes/notificacoes`.

`notification_preferences` é respeitado normalmente — usuário pode desligar `recado_novo` (canal in-app) em `/configuracoes/notificacoes`. Email fica `email_default=false` (não envia, mural gera volume demais).

---

## 6. Ciclo de vida

### Badge na sidebar

Server-side, no `(authed)/layout.tsx`:

```sql
select count(*) from recados
where arquivado = false
  and permanente = false
  and criado_em > (
    select coalesce(last_seen_at, '1970-01-01'::timestamptz)
    from recado_visualizacoes
    where user_id = auth.uid()
  )
  and autor_id != auth.uid()
```

Resultado passa pro `Sidebar` como prop. Recados fixados não contam (já estão sempre visíveis no topo). Recados criados pelo próprio user não contam.

### `last_seen_at` atualiza ao abrir `/recados`

Page é Server Component. No próprio `page.tsx`, antes do return, chama:

```ts
await updateRecadosLastSeenAction(); // upsert recado_visualizacoes set last_seen_at = now() where user_id = auth.uid()
```

`revalidatePath('/', 'layout')` no fim pra zerar o badge na sidebar imediatamente após render.

### Cron de arquivamento

- Endpoint: `POST /api/cron/recados-arquivar` (mesmo padrão dos crons existentes — autenticado por `CRON_SECRET`).
- Schedule: diário às 03:00 BRT (`vercel.json` cron).
- SQL: `update recados set arquivado = true where arquivado = false and permanente = false and criado_em < now() - interval '30 days'`
- Registra execução em `cron_runs` (job: `recados_arquivar`).

### Desarquivar / apagar

- **Desarquivar:** `update recados set arquivado = false`. Não toca `criado_em`. Pode arquivar de novo no próximo cron se já passou de 30 dias — comportamento desejado.
- **Apagar:** `delete from recados where id = ?` (cascade em `recado_reacoes` por FK). Confirmação obrigatória no UI. Sem audit log no MVP.

---

## 7. Estrutura de arquivos

```
src/
  app/(authed)/recados/
    page.tsx                       # Server Component, lista feed, atualiza last_seen
    archived/page.tsx              # OU usa search param ?aba=arquivados na mesma page — decidir no plano
  components/recados/
    NovoRecadoDialog.tsx           # client, formulário
    RecadoCard.tsx                 # client (precisa do popover de reações + dropdown)
    RecadoFeed.tsx                 # client OU server — agrupa por tier
    EmojiReactionPicker.tsx        # client, popover com 4 emojis
    PriorityBadge.tsx              # text-only badge de papel
  lib/recados/
    actions.ts                     # criar, editar, apagar, arquivar/desarquivar, fixar/desafixar, reagir, marcar como visto
    queries.ts                     # listRecadosAtivos, listRecadosArquivados, countNaoLidos
    team-members.ts                # opcional, se quiser tipar a função SQL
supabase/migrations/
  YYYYMMDDNNNNNN_recados.sql       # 3 tabelas + RLS + função meu_time + índices
src/app/api/cron/recados-arquivar/
  route.ts                         # endpoint do cron
vercel.json                        # adiciona cron schedule
```

---

## 8. Critérios de aceitação

- [ ] Qualquer authenticated user posta um recado (título + corpo + escolha de notificação).
- [ ] Feed agrupa em 4 tiers visuais (Sócios/Coord/Assessor/Geral) com paleta azul aprovada, ordenado por data desc dentro de cada tier.
- [ ] Recado fixado (apenas Sócio) aparece em "📌 Fixados" no topo, fora dos tiers.
- [ ] Autor edita/apaga seu próprio recado; Sócio/ADM edita/apaga qualquer um.
- [ ] Reações de emoji (4 fixos) funcionam: adicionar, remover, contadores corretos por emoji.
- [ ] Notificação no sininho dispara conforme escolha do autor (`todos` / `meu_time` / `nenhum`); respeita preferências de canal.
- [ ] Badge numérico na sidebar mostra recados ativos não-fixados criados após `last_seen_at`. Zera ao abrir `/recados`.
- [ ] Aba "Arquivados" lista recados com `arquivado=true`, mesma estrutura visual; menu permite desarquivar.
- [ ] Cron diário arquiva recados com mais de 30 dias e `permanente=false`.
- [ ] RLS testada: user não-autor sem papel socio/adm não consegue editar/apagar recado de terceiro.

---

## 9. Decisões revisadas durante o brainstorm

- **Snapshot do papel (`autor_role_snapshot`)** em vez de derivar do `profiles.role` atual — preserva a classificação histórica em caso de promoção. Mesmo padrão de `commission_snapshots`.
- **`recado_visualizacoes` com 1 row por user** em vez de tabela `(user_id, recado_id, lido_em)` — evita N×M, badge fica trivial. Custo: não dá pra mostrar "lido por X, Y, Z" individualmente. Aceitável no MVP.
- **Edição não notifica de novo** — typo fix do Sócio não vai re-disparar notificação pra equipe inteira.
- **Notificação por email fora de escopo** — mural gera volume; só sininho.
- **Sem audit log de recado no MVP** — pode adicionar depois se virar issue de governança.
