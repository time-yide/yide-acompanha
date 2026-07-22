# Conquistas (Fase 2 do Card do Jogador) — Design

**Data:** 2026-07-21
**Status:** aprovado pela Yasmin
**Depende de:** Fase 1 (`perfil_jogador`, `/perfil/[id]`, `CardJogador`).

Troca a área "Conquistas — em breve" do card por conquistas **automáticas**, desbloqueadas pelo que a pessoa faz no sistema. Só ícones (lucide), sem emoji.

---

## 1. Como funciona

1. **Catálogo no código** (`src/lib/conquistas/catalogo.ts`) — lista fixa de conquistas. Cada uma tem `key`, `categoria`, `titulo`, `descricao`, `icone` (nome lucide), a **fonte** (qual stat), o **alvo** (número pra desbloquear) e um predicado `aplicavel(role)` opcional (pra conquistas de área).
2. **Coletor de stats** (`src/lib/conquistas/stats.ts`) — `getStatsDoUsuario(userId)` lê os números reais (poucas queries, só na página do card): meses de casa, tarefas concluídas, pesquisas respondidas, entregas audiovisual, ligações de saída, meta comercial batida no mês, e se o card está completo.
3. **Avaliação** (`src/lib/conquistas/avaliar.ts`, pura/testável) — dado o catálogo + stats, devolve para cada conquista: `desbloqueada` (bool) e `progresso` (atual/alvo).
4. **Persistência** — tabela `conquista_desbloqueada` (`user_id`, `conquista_key`, `unlocked_at`). `sincronizarConquistas(userId)` grava as novas (as que ficaram desbloqueadas e ainda não estavam na tabela) e devolve a lista das **recém-desbloqueadas**.
5. **Surpresa** — quando a pessoa abre o **próprio** card, o sistema sincroniza e, se houver conquista nova, o card mostra um **toast comemorativo** ("Você desbloqueou: 1 ano de casa!"). (Notificação no sino fica pra evolução futura — evita mexer no enum de eventos agora.)
6. **No card** — a seção Conquistas vira uma **grade de medalhas**: desbloqueadas coloridas (com data), bloqueadas em cinza **com barra de progresso** ("70/100"). Conquistas de área só aparecem pra quem se aplica (um designer não vê "500 ligações").

---

## 2. Catálogo (v1)

**Tempo de casa** (fonte: meses desde `data_admissao`) — ícone `CalendarClock`:
| key | título | alvo |
|---|---|---|
| casa_novato | Novato | entrou (0m) |
| casa_3m | 3 meses de casa | 3 |
| casa_6m | 6 meses de casa | 6 |
| casa_1a | 1 ano de casa | 12 |
| casa_2a | 2 anos de casa | 24 |
| casa_3a | 3 anos de casa | 36 |

**Produtividade** (fonte: tarefas `status='concluida'`, `atribuido_a`) — ícone `ListChecks`:
| key | título | alvo |
|---|---|---|
| tarefa_1 | Primeira entrega | 1 |
| tarefa_10 | 10 tarefas | 10 |
| tarefa_50 | 50 tarefas | 50 |
| tarefa_100 | 100 tarefas | 100 |
| tarefa_250 | 250 tarefas | 250 |
| tarefa_500 | 500 tarefas | 500 |

**Engajamento** — ícone `Sparkles`:
| key | título | regra |
|---|---|---|
| disc_feito | Se conhece | respondeu o DISC (tem temperamento) |
| pesquisa_3 | Participativo | 3 pesquisas respondidas |
| pesquisa_10 | Voz ativa | 10 pesquisas respondidas |
| card_completo | Perfil completo | username + bio + como_trabalho + ≥1 hobby + frase + capa preenchidos |

**Metas & área** (só aparecem pra quem se aplica):
| key | título | fonte | alvo | aplicável a |
|---|---|---|---|---|
| meta_mes | Meta do mês | `getMetaComercial` pctMeta ≥ 100 | — | comercial |
| av_10 | 10 entregas | `audiovisual_capturas` (`videomaker_id`) | 10 | videomaker, editor, fast_midia, designer, audiovisual_chefe |
| av_50 | 50 entregas | idem | 50 | idem |
| av_100 | 100 entregas | idem | 100 | idem |
| lig_50 | 50 ligações | `ligacoes` saída (`colaborador_id`) | 50 | comercial, assessor, coordenador, socio, adm |
| lig_200 | 200 ligações | idem | 200 | idem |
| lig_500 | 500 ligações | idem | 500 | idem |

> Contagens ignoram registros soft-deleted (`deleted_at`/`arquivado_em`). "Meta 3 meses seguidos" fica pra evolução (precisa de histórico).

---

## 3. Modelo de dados

Tabela nova **`conquista_desbloqueada`** (espelha `freela_conquistas`):
```
conquista_desbloqueada
  user_id       uuid   FK → profiles.id (on delete cascade)
  conquista_key text
  unlocked_at   timestamptz not null default now()
  primary key (user_id, conquista_key)
```
- RLS: SELECT pra `authenticated` (padrão do app). Escrita via service-role em `sincronizarConquistas`.
- **Migration manual** (aplicar no SQL Editor após o merge).

---

## 4. Fontes de dado (confirmadas no código)

| Stat | Tabela | FK usuário | Condição |
|---|---|---|---|
| tarefasConcluidas | `tasks` | `atribuido_a` | `status='concluida'` e `deleted_at is null` |
| pesquisasRespondidas | `pesquisa_destinatarios` | `user_id` | `respondeu_em not null` |
| entregasAudiovisual | `audiovisual_capturas` | `videomaker_id` | linha existe |
| ligacoesSaida | `ligacoes` | `colaborador_id` | `direcao='saida'`, `status not in ('cancelada','em_andamento')`, `arquivado_em is null` |
| metaBatida | via `getMetaComercial(userId, now)` (`src/lib/dashboard/comercial-queries.ts`) | — | `pctMeta ≥ 100` |
| mesesDeCasa | `profiles.data_admissao` | — | meses até hoje |
| cardCompleto | `perfil_jogador` | `user_id` | todos os campos preenchidos |
| discFeito | reusa `getTemperamentoDaPessoa` (Fase 1) | — | ≠ null |

---

## 5. Componentização

- `src/lib/conquistas/catalogo.ts` — catálogo (dados puros) + tipos.
- `src/lib/conquistas/avaliar.ts` (+ `.test.ts`) — pura: `avaliarConquistas(catalogo, stats, role)` → lista com `desbloqueada`/`progresso`, filtrando as de área não-aplicáveis.
- `src/lib/conquistas/stats.ts` — `getStatsDoUsuario(userId)` (I/O, service-role).
- `src/lib/conquistas/queries.ts` — `getConquistasDoUsuario(userId, role)` (junta avaliação + já-desbloqueadas da tabela).
- `src/lib/conquistas/actions.ts` — `sincronizarConquistasAction(userId)` (grava novas, devolve recém-desbloqueadas).
- `src/components/perfil/ConquistasSecao.tsx` — grade de medalhas (apresentação).
- `src/components/perfil/ConquistaToast.tsx` — client, dispara toast das recém-desbloqueadas.
- **Integração:** `CardJogador` passa a receber `conquistas` e renderiza a seção no lugar do placeholder; a página `/perfil/[id]` chama `sincronizarConquistas` quando é o dono e passa as recém-desbloqueadas pro toast.

---

## 6. Permissões / privacidade
- Ver conquistas de qualquer card: todo colaborador (é público, faz parte do "conhecer o time").
- Sincronizar (gravar) só acontece pro **próprio** usuário ao abrir o próprio card.
- Nada sensível exposto (são marcos de trabalho/tempo).

---

## 7. Critérios de aceite
- [ ] Seção Conquistas no card mostra medalhas desbloqueadas + bloqueadas com progresso.
- [ ] Conquistas de área só aparecem pra quem se aplica.
- [ ] Abrir o próprio card grava novas conquistas e mostra toast das recém-desbloqueadas.
- [ ] Avaliação pura testada (thresholds, aplicabilidade, progresso).
- [ ] Migration `conquista_desbloqueada` documentada pra aplicação manual.
- [ ] Só ícones, sem emoji.
