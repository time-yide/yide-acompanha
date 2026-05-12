# Reuniões — Fase 2: upload de áudio + transcrição via Whisper

Esta fase entrega: **subir áudio de qualquer reunião → IA transcreve com timestamps + diarização heurística**. Funciona standalone — você nem precisa ter completado a Fase 1 (Google OAuth) pra usar; basta criar reuniões manualmente com o botão "Nova reunião" e fazer upload.

> Tempo estimado de setup: **10 minutos**.

## O que entrou no código

### Storage
- Migration `20260514000000_reunioes_storage.sql`: bucket privado `meeting-recordings` (limite 100MB por arquivo, MIMEs whitelist), policies de RLS pra authenticated.
- `src/lib/reunioes/storage.ts`: helpers de signed upload URL (upload direto cliente → Supabase, bypass do limite de 4.5MB do Vercel route handler), signed read URL (TTL 1h pro Whisper baixar), validação de MIME e tamanho.

### Whisper API real
- `src/lib/reunioes/transcription/whisper.ts`: implementação completa do POST /v1/audio/transcriptions com `verbose_json` + `timestamp_granularities[]=segment`. Inferência heurística de speaker (Speaker 1/2 por gap >1.5s) — diarização real virá com Claude na Fase 3.

### Server actions
- `criarReuniaoManualAction`: cria reunião sem precisar do Google Calendar (source = `manual_upload`)
- `gerarUploadUrlAction`: valida permissão + MIME + tamanho, retorna signed URL pro Storage
- `registrarUploadConcluidoAction`: registra em `meeting_recordings`, marca meeting como `processing`, cria job `transcription` em `meeting_processing_jobs`

### Worker
- `/api/cron/process-meeting-jobs` (every minute): pega até 3 jobs `pending`, marca como `running`, processa, marca `done`/`failed`. Retry policy: 5 tentativas, depois `failed` (e marca meeting como failed também). Idempotente — reprocessar mesmo job sobrescreve transcrição.

### UI
- **Lista**: novo botão **"Nova reunião"** no header. Abre modal com título + datetime + descrição + tags, cria meeting com `source=manual_upload`.
- **Detalhe**: se não tem gravação ainda, mostra **componente de upload** premium com drag de progresso. Validação client-side de 25MB. Quando termina, refresh automático.

## Passos manuais pra ativar em produção

### Passo 1 — Aplicar 2 migrations SQL (3 min)

Você tem 2 migrations pendentes:
- `20260513000000_reunioes_fase1.sql` (da Fase 0 — cria todas as tabelas)
- `20260514000000_reunioes_storage.sql` (desta Fase — cria bucket + policies)

Aplicar via Supabase MCP comigo numa próxima mensagem **OU**:

```bash
npm run db:push
npm run db:types
```

### Passo 2 — Adicionar `OPENAI_API_KEY` no Vercel (3 min)

1. Pegar key em https://platform.openai.com/api-keys
2. No Vercel: Settings → Environment Variables → adicionar `OPENAI_API_KEY` (Production + Preview + Development)
3. Redeploy

### Passo 3 — Validar end-to-end (4 min)

1. Acesse `/reunioes` → clique **"Nova reunião"** → preencha título + data → "Criar e abrir"
2. Detalhe abre — componente de upload aparece (sem gravação ainda)
3. Clique **"Escolher arquivo"** → seleciona MP3/M4A/WAV de até 25MB
4. Barra de progresso anda: gerando link → upload → registrando
5. Status muda pra **"Processando"** (amber + spin)
6. Em até 1 minuto (próximo tick do cron), reabra o detalhe — aba **"Transcrição"** mostra todos os segmentos com timestamps e "Speaker 1" / "Speaker 2"
7. Status muda pra **"Concluída"**

Pra forçar o cron manualmente:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sistemaacompanha.yidedigital.com.br/api/cron/process-meeting-jobs
```

## Limites importantes

| Limite | Valor | Onde vem |
|---|---|---|
| Tamanho máximo do áudio | **25 MB** | Whisper API |
| Reunião máxima sem comprimir | ~1h @ 64kbps mono | Whisper 25MB |
| Tamanho no Storage | 100 MB | bucket policy |
| Jobs processados por tick (1min) | 3 | timeout Vercel |
| Tentativas antes de marcar failed | 5 | retry policy |
| TTL signed read URL | 1h | suficiente pro Whisper |

### Pra reuniões >1h

Whisper não aceita >25MB. Opções:

1. **Comprimir antes do upload** (recomendado): converter pra MP3 64kbps mono via ffmpeg:
   ```bash
   ffmpeg -i reuniao.mp4 -vn -ar 16000 -ac 1 -b:a 64k reuniao.mp3
   ```
   1h de áudio comprimido assim fica ~28MB; pra reunião exata de 1h cabe.

2. **Chunking server-side** (Fase 2.5, não implementado): dividir áudio em pedaços de 20MB, transcrever cada um, juntar.

3. **Trocar provider pra AssemblyAI** (Fase 4): aceita arquivos maiores, mas requer mudança de stack.

## Custos estimados

| Item | Custo |
|---|---|
| Whisper (1h reunião) | $0.36 |
| Supabase Storage (1h MP3 ~25MB) | $0.0005 |
| Vercel cron (60×24 ticks/dia) | $0 (incluso no plano) |
| **Total por reunião** | **~$0.36** |

50 reuniões/mês = **~$18/mês** (só transcrição). Quando a Fase 3 (Claude) entrar, adiciona ~$3/mês.

## Troubleshooting

### "Schema do módulo Reuniões não foi aplicado"
Você não rodou o Passo 1 das migrations.

### Upload trava em "Enviando áudio…" no 0%
Bucket não existe. Confira que a migration `20260514000000_reunioes_storage.sql` rodou (em Supabase Dashboard → Storage deve aparecer `meeting-recordings`).

### "Arquivo tem XYMB. Whisper API limita 25MB"
Comprima o áudio. Sugestão: MP3 64kbps mono (ver "Pra reuniões >1h" acima).

### Job fica "running" pra sempre
Worker travou no meio. Após 5 minutos sem update, pode marcar manualmente como `failed` via Supabase Dashboard ou aguardar próximo cron pegar (eles têm `attempts` limit).

### Transcrição vem com "Speaker 1 / Speaker 2" misturado
Heurística de gap não acertou. A Fase 3 (Claude) faz attribution muito melhor olhando contexto + lista de participantes da reunião.

## Próximas fases

- **Fase 3** (2 dias): Claude gera resumo + tópicos + insights + tarefas a partir da transcrição
- **Fase 4** (opcional, 3-5d): Bot Recall.ai entra no Meet automaticamente
- **Fase 5** (1-2d): Realtime + observabilidade + retenção 90 dias (cron de cleanup)
