# Reuniões — Fase 3: IA gera resumo + insights + tarefas

Esta fase fecha o pipeline. Quando uma transcrição entra no sistema (vinda da Fase 2 ou de qualquer fonte), o worker da Fase 3 detecta e gera automaticamente:

- **Resumo executivo** (3-5 parágrafos)
- **Decisões tomadas** (bullet list)
- **Próximos passos** (bullet list)
- **Tópicos com timestamps** (timeline visual)
- **Insights**: objeção / sinal de compra / risco / oportunidade / dúvida / decisão
- **Tarefas extraídas** com responsável + prazo + citação da transcrição
- **Sentimento geral** (-1 a +1)
- **Atribuição real de speakers** (Speaker 1 / 2 → nomes reais via contexto)

E você pode **aceitar tarefas com 1 clique** — vira `public.tasks` atribuída ao sugerido.

> Tempo de setup: **3 minutos** (só configurar `ANTHROPIC_API_KEY` se ainda não tiver).

## Por que Haiku 4.5 e não Sonnet 4.5?

| | Haiku 4.5 | Sonnet 4.5 |
|---|---|---|
| Custo input | $1/1M tokens | $3/1M tokens |
| Custo output | $5/1M tokens | $15/1M tokens |
| Custo por reunião | **~R$ 0,17** | ~R$ 0,55 |
| Qualidade pra tarefas estruturadas | ✅ ótima | ✅ ótima |
| Latência | ~10s | ~25s |

Pra extração de informação estruturada (tool_use com schema JSON), Haiku tem qualidade essencialmente igual a Sonnet — sem precisar do reasoning longo. **3x mais barato + 2.5x mais rápido.**

## Arquitetura

```
1. Cron every minute            /api/cron/process-summarization-jobs
   ↓
2. Detecta meeting_transcripts sem summary correspondente
   ↓
3. Pra cada uma (max 2 por tick):
   ├─ Carrega transcrição + participantes + lead/cliente vinculado
   ├─ Chama Claude Haiku com tool_use estruturado
   │   (1 call retorna TUDO: resumo, decisões, tópicos, insights, tasks,
   │    speaker_attribution, sentimento)
   ├─ INSERT meeting_summaries
   ├─ UPDATE meeting_transcripts.segments com speakers reais
   ├─ INSERT meeting_extracted_tasks (resolve email → profile_id)
   └─ UPDATE meetings SET summary_ready, insights_ready, status='completed'
4. router.refresh() → UI mostra tudo
5. User clica "Aceitar" numa task sugerida → cria public.tasks real
```

**Independente da Fase 2**: o worker funciona com qualquer transcrição que existir no banco, vinha do upload manual da Fase 2 ou de qualquer outra fonte (incluindo dados manualmente seedados).

## Tool schema pro Claude

A IA recebe **1 tool definida via JSON schema** (`save_meeting_analysis`) com 8 campos obrigatórios. Isso garante:

- **Output sempre válido** (JSON schema enforcement do Anthropic)
- **Custo previsível** (1 call só)
- **Latência baixa** (Haiku pra ferramentas estruturadas é rápido)

System prompt enfatiza:
- Português BR coloquial-profissional
- Citações literais da transcrição quando relevante
- Não inventar prazos/responsáveis não mencionados
- Usar timestamps reais dos segments

## Speaker attribution

Whisper retorna "Speaker 1" / "Speaker 2" (heurística baseada em gap). Claude lê transcrição + lista de participantes e mapeia: `{"Speaker 1": "Yasmin Monteiro", "Speaker 2": "Maria Helena Costa"}`. O worker reescreve os segments da transcrição com os nomes reais.

Pra reuniões 2 pessoas: acerta >95%. Pra 3+ pessoas: ainda funciona mas pode confundir em trocas rápidas.

## Server actions de tarefas

`aceitarTaskSugeridaAction(extracted_task_id)`:
1. Cria `public.tasks` com `titulo`, `descricao`, `atribuido_a` (sugestão IA ou user atual), `due_date`, `client_id` (do meeting)
2. Marca `meeting_extracted_tasks.estado = 'aceita'`, linka `task_id`
3. Audit log
4. Revalida `/reunioes/[id]` + `/tarefas`

`descartarTaskSugeridaAction(extracted_task_id)`:
1. Marca `estado = 'descartada'` (não cria task)
2. Audit log

UI: `ExtractedTaskActions` (client) com 2 botões (Check/X) + loading state + error inline.

## Pra colocar em produção (3 min)

### Passo 1 — `ANTHROPIC_API_KEY` no Vercel

Provavelmente já tá setado (módulo de Gerador de Leads + Satisfação usam). Confira em
https://vercel.com/[seu-time]/yide-acompanha/settings/environment-variables.

Se não tiver: pegar em https://console.anthropic.com/settings/keys e adicionar.

### Passo 2 — Migrations (se ainda não rodou as anteriores)

Esta fase NÃO adiciona migration nova. Reusa `meeting_summaries` + `meeting_extracted_tasks` + `meeting_transcripts` da migration `20260513000000_reunioes_fase1.sql` (Fase 0).

### Passo 3 — Redeploy + validar

Próximo cron tick (max 1 min) começa a processar transcrições pendentes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sistemaacompanha.yidedigital.com.br/api/cron/process-summarization-jobs
```

Retorna `{"processed": N, "resultados": [...]}`.

## Custos

| Item | Por reunião 1h |
|---|---|
| Claude Haiku 4.5 (input ~10k tokens) | $0.01 |
| Claude Haiku 4.5 (output ~3k tokens) | $0.015 |
| **Subtotal IA** | **~$0.03 = R$ 0,17** |

50 reuniões/mês = **~$1.50 = R$ 8,25**.

Combinado com Fase 2 (Whisper $0.36/reunião): total pipeline **~$0.39/reunião = R$ 2,15** ou **R$ 107/mês a 50 reuniões**.

**Trocando Whisper API por Groq Whisper Turbo** (próximo PR): cai pra **~$0.07/reunião = R$ 0,39** ou **R$ 19/mês a 50 reuniões** — economia de **R$ 88/mês**.

## Troubleshooting

### Job fica esperando, summary nunca aparece
Confira `ANTHROPIC_API_KEY` no Vercel + redeploy. Sem ela, o cron retorna `{"skipped": "no_anthropic_key"}` sem erro.

### "Schema do módulo Reuniões não foi aplicado"
Migration da Fase 0 (`20260513000000_reunioes_fase1.sql`) não rodou. Aplicar via Supabase MCP ou `npm run db:push`.

### Tarefas extraídas sem responsável (atribuido_a_nome = null)
Acontece quando a IA detectou tarefa mas não conseguiu identificar responsável explícito na conversa. Quando você clica "Aceitar", task é criada atribuída a VOCÊ (criador). Pra ajustar, edita em `/tarefas/[id]`.

### Speaker attribution errada (Speaker 1/2 misturados)
Acontece em reuniões com 3+ pessoas onde IA não tem contexto suficiente. Você pode editar manualmente — ou pra Fase 4, integrar Recall.ai que dá speaker diarization real via video tracks.

### Insights vazios
Pode ser reunião curta demais (5-10 min) ou conteúdo muito raso pra extrair sinais. Normal.

## Próximas fases

- **PR adicional (perf/cost)**: trocar Whisper API por **Groq Whisper Large v3 Turbo** ($0.04/h em vez de $0.36/h — economia de 9× na transcrição)
- **Fase 4** (opcional, 3-5d): Bot Recall.ai entra no Meet automaticamente (gravação + diarização nativa)
- **Fase 5** (1-2d): Realtime updates na página + retenção 90 dias (cron de cleanup)
