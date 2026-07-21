# Módulo "Pesquisas" — Design

**Data:** 2026-07-21
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Um módulo `/pesquisas` onde gestores criam pesquisas internas (formulários) e as
disparam pro time quando quiserem. O time recebe uma notificação, responde no
sistema, e o criador acompanha os resultados ao vivo.

Não confundir com o módulo `/satisfacao` (avaliação semanal entre pares) — é
outra coisa.

## Decisões (brainstorming)

| Tema | Decisão |
|---|---|
| Formato | Formulário com N perguntas, tipos variados |
| Tipos de pergunta | Múltipla escolha · Escala/nota · Sim-não · Texto aberto |
| Anonimato | Configurável **por pesquisa** (anônima ou identificada) |
| Público | Escolhido **ao disparar** (time todo / cargos / unidade / pessoas) |
| Quem cria/dispara | adm, sócio, coordenador, coord audiovisual (`audiovisual_chefe`) |
| Prazo | Opcional ao disparar + fecho manual a qualquer momento |

## Ciclo de vida

```
Rascunho ──(disparar: público + prazo opcional)──▶ Aberta ──▶ Encerrada
                                                      │           ▲
                                                      └─ fecho manual / prazo ┘
```

- **Rascunho**: criador monta as perguntas, edita à vontade. Não visível pro time.
- **Aberta**: disparada. Destinatários definidos e notificados. Coletando respostas.
  Não dá mais pra editar perguntas (integridade das respostas).
- **Encerrada**: criador encerra na mão, ou fecha sozinha ao bater o prazo (via cron
  já existente ou checagem on-read). Não aceita mais resposta.

## Modelo de dados (4 tabelas novas)

### `pesquisas`
- `id` uuid pk
- `organization_id` uuid (NOT NULL)
- `titulo` text (NOT NULL)
- `descricao` text null
- `anonima` boolean NOT NULL default false
- `status` enum `pesquisa_status` (`rascunho` | `aberta` | `encerrada`) default `rascunho`
- `criado_por` uuid (profiles)
- `disparada_em` timestamptz null
- `prazo` timestamptz null
- `encerrada_em` timestamptz null
- `created_at` / `updated_at` timestamptz
- `deleted_at` timestamptz null (soft-delete, padrão do repo)

### `pesquisa_perguntas`
- `id` uuid pk
- `pesquisa_id` uuid fk → pesquisas
- `ordem` int NOT NULL
- `tipo` enum `pesquisa_pergunta_tipo` (`multipla_escolha` | `escala` | `sim_nao` | `texto`)
- `enunciado` text NOT NULL
- `opcoes` jsonb null — lista de strings (só múltipla escolha)
- `escala_min` int null / `escala_max` int null (só escala; default 1..5)
- `obrigatoria` boolean NOT NULL default true

### `pesquisa_destinatarios`
- `id` uuid pk
- `pesquisa_id` uuid fk
- `user_id` uuid fk → profiles
- `respondeu_em` timestamptz null — rastreia quem já respondeu (evita 2x, vale pra anônima)
- unique (`pesquisa_id`, `user_id`)

### `pesquisa_respostas`
- `id` uuid pk
- `pesquisa_id` uuid fk
- `pergunta_id` uuid fk
- `user_id` uuid null — preenchido só em pesquisa **identificada**; null em anônima
- `valor` jsonb — `{ escolha: "..." }` | `{ nota: 4 }` | `{ sim_nao: true }` | `{ texto: "..." }`
- `created_at` timestamptz

**Anonimato na prática:** `pesquisa_destinatarios.respondeu_em` sempre marca quem
respondeu (pra você ver o progresso e evitar duplicata). As respostas em si só
carregam `user_id` quando a pesquisa é identificada. Em anônima, `respostas.user_id`
fica null → impossível ligar conteúdo à pessoa, nem na query.

## Telas / componentes

1. **Lista `/pesquisas`** — 2 abas:
   - *Minhas pesquisas* (quem cria): cards com status, nº de respostas / destinatários.
   - *Responder*: pesquisas abertas em que sou destinatário e ainda não respondi.
2. **Construtor** (`/pesquisas/nova` e edição do rascunho): título, descrição, toggle
   anônima, e o builder de perguntas (adicionar/remover/reordenar, escolher tipo,
   opções, obrigatória).
3. **Disparar** (modal na tela do rascunho): seletor de público (time todo / cargos /
   unidade / pessoas específicas) + prazo opcional → grava `destinatarios` e dispara
   notificação.
4. **Responder** (`/pesquisas/[id]/responder`): renderiza o formulário conforme os
   tipos; salva `respostas` + marca `respondeu_em`.
5. **Resultados** (`/pesquisas/[id]`): agregado ao vivo por pergunta — barras pra
   escolha/escala/sim-não, lista pra texto. Identificada mostra por pessoa; anônima só
   agregado. Botão **Encerrar** + indicador de progresso (X de N responderam).

## Permissão

- Nova `Action` **`manage:pesquisas`** em `src/lib/auth/permissions.ts`.
- Concedida a: `adm`, `socio`, `coordenador`, `audiovisual_chefe`.
- Criar/editar/disparar/encerrar/ver-resultados exigem `manage:pesquisas`.
- Responder: qualquer destinatário (checado por `pesquisa_destinatarios`).

## Notificações

- Novo `evento_tipo` **`pesquisa_disparada`** no sistema de notificações.
- Ao disparar, `dispatchNotification` pros `user_ids` dos destinatários (sino + push),
  link `/pesquisas/[id]/responder`.

## Infra / migration

- **1 migration manual** (padrão do repo — Vercel não roda migration no deploy):
  - `create type pesquisa_status`, `pesquisa_pergunta_tipo`.
  - 4 tabelas + FKs + índices (`pesquisa_id`, `user_id`, `status`).
  - RLS: leitura/escrita conforme `manage:pesquisas` (criador) e destinatário (resposta).
  - Adicionar `pesquisa_disparada` ao enum/lista de eventos de notificação.
- Nav: item "Pesquisas" em `nav-config.ts`. Regra explícita: **sempre visível pra
  quem tem `manage:pesquisas`**; pros demais cargos, visível **apenas quando têm
  pesquisa pendente de resposta** (gate especial em `isLinkVisible`, com badge de
  contagem de pendentes).
- Cache: `unstable_cache` com tag própria (`pesquisas`), revalidada nas mutations.

## Fases

- **Fase 1 (este spec):** criar rascunho → disparar (público + prazo) → responder →
  resultados ao vivo → encerrar. Anonimato por pesquisa. Notificação in-app.
- **Futuro (fora deste spec):** duplicar pesquisa/templates, exportar resultados (CSV),
  recorrência/agendamento, lembrete de quem não respondeu, respostas por WhatsApp.

## Fora de escopo

- Pesquisas com clientes externos (só time interno).
- Lógica condicional entre perguntas (pular pergunta conforme resposta).
- Edição de perguntas depois de disparada.
