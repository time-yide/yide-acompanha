# Tarefas — anexos, links, equipe auto + atribuídos extras

**Status:** Aprovado, pronto pra implementar.
**Escopo:** Form de Nova Tarefa ganha 4 features:
1. Anexos (imagens) opcionais
2. Links de referência opcionais (múltiplos)
3. Auto-puxa equipe (assessor + coord + designer) ao selecionar cliente
4. Múltiplos atribuídos (principal + adicionais)

**Fora do escopo:** vídeo, áudio, anexos não-imagem; thumbnails server-side; comentários em tarefas; assignees como many-to-many com tabela própria.

## Modelo de dados

### Migration nova: estende `tasks`

```sql
alter table public.tasks
  add column participantes_ids uuid[] not null default '{}',
  add column links jsonb not null default '[]'::jsonb,
  add column attachment_urls text[] not null default '{}';

create index idx_tasks_participantes on public.tasks using gin (participantes_ids);
```

- `participantes_ids`: UUIDs de profiles além do `atribuido_a` principal. Não inclui o próprio `atribuido_a` (evita duplicação).
- `links`: array de `{label?: string, url: string}`. Validação: url começando com `http(s)://`.
- `attachment_urls`: URLs públicas do Storage bucket `task-attachments`.

### Storage: novo bucket `task-attachments`

```sql
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

-- Qualquer authenticated lê/sobe; só criador da tarefa ou socio/adm deleta
create policy "task-attachments read"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments');

create policy "task-attachments insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments');

create policy "task-attachments delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-attachments' and (
    owner = auth.uid() or current_user_role() in ('adm', 'socio')
  ));
```

Path convention: `task-attachments/{taskId}/{uuid}.{ext}` (tarefa nova → upload primeiro com taskId temporário do client e move depois? Não — upload acontece depois de criar a task, no detalhe).

Decisão: **upload separado, pós-criação**. Form de criar não permite anexar. Anexos são feitos na página de detalhe da tarefa via dropzone. Simpler. (Ou: form de criação permite via state local, e no submit final faz upload + insert. Mas isso é mais complexo. Vou com o pós-criação.)

Hmm, isso quebra a UX desejada de "anexar na criação". Solução alternativa: usar uuid do client (gerado no client-side) como pré-id, fazer upload com esse uuid, e no insert da task usar o mesmo uuid como `tasks.id`. Cliente gera UUIDv4 → upload → insert.

Vou com essa abordagem: client gera id da task antes do submit, faz uploads pro bucket com path `{id}/...`, e ao submeter o form passa o id pré-gerado pra action que usa ele no insert.

## Form de Nova Tarefa

### Layout

```
Nova tarefa
─────────────────
Título *
[ _____________ ]

Descrição (opcional)
[ ___________________ ]

Cliente (opcional)
[ Sem cliente ▼ ]
  ↓ ao selecionar:
  💡 Equipe do cliente: [Yasmin ✓] [Vinicios ✓] [Designer ✓]

Responsável principal *
[ Yasmin ▼ ]    ← default = assessor do cliente

Atribuídos adicionais (opcional)
[ Vinicios ✕ ] [Designer ✕ ] [+ adicionar]

Prioridade        Prazo
[ Média ▼ ]      [ __/__/____ ]

Links de referência (opcional)
[ Label ___ ] [ https://... ___ ] [✕]
[+ adicionar link]

Anexos (opcional)
[ Drag & drop ou clique pra selecionar imagens ]
🖼 print1.png 145KB ✕   🖼 brief.jpg 89KB ✕

[Criar tarefa]
```

### Comportamentos

**Cliente seleciona:**
- Busca `client.assessor_id`, `client.coordenador_id`, `client.designer_id`
- Default `atribuido_a` = assessor (se existe; senão coord; senão criador)
- Default `participantes_ids` = [coord, designer] (filtra null/duplicado com atribuido_a)
- Usuário pode editar tudo manualmente depois

**Responsável principal:**
- Sempre obrigatório (recebe notificação `task_assigned`)
- Pode ser qualquer profile ativo

**Atribuídos adicionais:**
- Pode adicionar/remover qualquer profile ativo
- Recebem notificação `task_assigned_extra` (nova) — leve, sem prioridade alta

**Links:**
- Componente: array de `{label, url}` em React state
- Validação client-side: url começa com `http://` ou `https://`
- Server: schema valida cada item (url obrigatório, label opcional max 80 chars)

**Anexos:**
- Aceita: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- Tamanho máx por arquivo: 5MB
- Pré-gera `task.id` (UUID) no client antes de qualquer upload
- Upload concorrente; mostra spinner por arquivo; erro inline
- URL final = pública do Storage
- No submit do form, passa `taskId` (pré-gerado) + `attachment_urls` (array) + `links` (json) pra action

## Server action

`createTaskAction` ganha:
- `id` opcional do form (usa o pré-gerado se vier; senão gera novo)
- `participantes_ids` array de UUIDs (split de string serializada)
- `links` JSON string (parseado em server)
- `attachment_urls` array de URLs

Validação:
- `participantes_ids`: array de UUIDs, max 10 itens, sem duplicar atribuido_a
- `links`: array max 10 itens; cada um: label string max 80, url string regex http(s)
- `attachment_urls`: max 10 itens; cada URL deve começar com URL do Storage do projeto

### Notificações

- `atribuido_a` (principal): `task_assigned` (existente)
- `participantes_ids`: novo evento `task_assigned_extra` — mensagem + link, severidade igual

## Detalhe da tarefa

`/tarefas/[id]` mostra:
- Título, status, prioridade, prazo (existente)
- **Equipe**: avatares do principal + adicionais
- **Links**: lista clicável (target=_blank, rel=noopener)
- **Anexos**: galeria 3-col com preview thumb (object-cover) + click pra abrir em fullscreen
- Botão de adicionar anexo pós-criação (mesmo bucket, mesmo path `{id}/...`)
- Permitido remover anexo / link individualmente (criador + adm/socio)

## TaskCard (kanban + lista)

Adiciona:
- Avatares stack (max 3 + "+N") pra atribuídos adicionais ao lado do avatar principal
- Ícone 📎 (Paperclip) se `attachment_urls.length > 0`
- Ícone 🔗 (Link) se `links.length > 0`

## Permissão

Sem mudança nas regras. RLS atual de tasks (creator/assignee podem update) mantém. `participantes_ids` não dá permissão de editar a task em si (só recebem notificação e veem a task na aba "Atribuídas a mim" se quisermos). Decisão: aba "Atribuídas a mim" passa a incluir tasks onde `auth.uid() = atribuido_a OR auth.uid() = ANY(participantes_ids)`.

## Migrations

1. ALTER TABLE tasks ADD COLUMNs
2. CREATE BUCKET + 3 policies de storage

Aplicar via SQL Editor (mesmo fluxo dos PRs anteriores).

## Test plan

- [ ] Selecionar cliente → preenche responsável principal com assessor + adicionais com coord/designer
- [ ] Cliente sem designer → adicionais ficam só com coord
- [ ] Adicionar link → salva e exibe no detalhe
- [ ] Remover anexo → some da lista e do storage
- [ ] Anexo > 5MB → erro inline
- [ ] Aba "Atribuídas a mim" mostra tasks onde sou principal OU adicional
- [ ] Notificação dispara pro principal e pros adicionais
- [ ] Card no kanban mostra ícone 📎 quando tem anexo

## Plano de implementação

Detalhe vai pra plan na próxima skill.
