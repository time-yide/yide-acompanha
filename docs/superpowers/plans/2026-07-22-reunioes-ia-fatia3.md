# Reuniões — Fatia 3A (IA: resumo + insights + tarefas sugeridas) Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Depois da transcrição (Fatia 2), a IA (Claude Haiku) gera resumo + decisões + próximos passos + insights comerciais + tarefas sugeridas, que aparecem na tela de detalhe da reunião. (Aceitar/descartar tarefa → tarefa real = Fatia 3B.)

**Architecture:** O worker `reunioes-worker` ganha o step `summarization`: a transcrição, ao terminar, enfileira um job `summarization` (em vez de fechar). O worker pega esse job, chama `summarizeMeeting` (Claude Haiku, reusa `getAnthropicClient`), grava `meeting_summaries` + `meeting_extracted_tasks`, marca `summary_ready`/`insights_ready` e fecha `completed`. `getMeetingById` carrega summary + extracted_tasks pros painéis já existentes.

**Tech:** Anthropic SDK via `@/lib/ai/client` (`getAnthropicClient`, modelo `claude-haiku-4-5`), Supabase service-role, vitest.

---

### Task 1: `summarizer.ts` + parse (TDD)
- Create `src/lib/reunioes/ai/summarizer.test.ts` testando `parseSummaryResponse`.
- Implement `src/lib/reunioes/ai/summarizer.ts` (`summarizeMeeting`, `parseSummaryResponse`). Código completo no prompt de implementação.
- Commit: `feat(reunioes): summarizer Claude Haiku (resumo/insights/tarefas)`

### Task 2: Worker step `summarization`
- Modify `src/app/api/cron/reunioes-worker/route.ts`: query pega `.in("step",["transcription","summarization"])`; dispatch por step; transcrição ao fim enfileira job `summarization` (mantém `processing`) em vez de `completed`; novo `processarResumo` gera e grava.
- Commit: `feat(reunioes): worker gera resumo/insights/tarefas via IA`

### Task 3: `getMeetingById` carrega summary + tarefas
- Modify `src/lib/reunioes/queries.ts`: carregar `meeting_summaries` + `meeting_extracted_tasks`, mapear pros tipos `MeetingSummary`/`MeetingExtractedTask`.
- Commit: `feat(reunioes): detalhe carrega resumo/insights/tarefas`

### Task 4: Verificação + PR
- vitest + tsc + eslint limpos. PR com nota: exige `ANTHROPIC_API_KEY` (já na stack) e migrations da Fatia 1 aplicadas.

## Self-review
- Cobertura: gerar (T1/T2) + exibir (T3). Aceitar/descartar → tarefa real fica na 3B.
- Sem placeholders. Tipos: `summarizeMeeting`/`parseSummaryResponse` consistentes; enums de insight batem com `INSIGHT_TIPO_LABEL`.
- Risco: transcrição muito longa é truncada em ~24k chars no prompt (Haiku). Aceitável pro MVP.
