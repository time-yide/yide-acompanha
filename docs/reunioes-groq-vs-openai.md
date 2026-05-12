# Transcrição: Groq vs OpenAI Whisper

Este sistema agora suporta **2 providers** de transcrição. A escolha é automática baseada em quais env vars estão setadas, com Groq como padrão (mais barato).

## Comparativo

| | Groq Whisper Large v3 Turbo | OpenAI Whisper-1 |
|---|---|---|
| **Custo por hora** | $0.04 = **R$ 0,22** | $0.36 = R$ 2,00 |
| Custo por minuto | $0.00067 | $0.006 |
| Latência | **~5-10s pra 1h** ⚡ | ~30-60s pra 1h |
| Qualidade pt-BR | Equivalente | Equivalente |
| Limite por arquivo | 25 MB | 25 MB |
| Endpoint compatível | ✅ OpenAI-compatible | ✅ |

## Recomendação

**Use Groq.** Mesma qualidade, **9× mais barato + 5× mais rápido**. Sem trade-offs práticos pra reuniões em português.

50 reuniões de 1h por mês:
- Groq: ~**R$ 11/mês**
- OpenAI: ~R$ 100/mês

## Como configurar

### Opção 1 — Só Groq (recomendado)

No Vercel env vars, defina apenas:

```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
```

Pega em https://console.groq.com/keys (precisa criar conta — free tier inclui ~30 dias de uso pra começar, depois pré-pago).

### Opção 2 — Groq + OpenAI fallback

```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

Groq é usado por padrão. Se um dia der down, dá pra trocar pra OpenAI sem deploy:

```bash
REUNIOES_TRANSCRIPTION_PROVIDER=openai
```

### Opção 3 — Só OpenAI (legacy)

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

Sistema detecta que Groq não tá disponível e usa OpenAI.

## Lógica de seleção

```ts
function selectProvider() {
  const forced = process.env.REUNIOES_TRANSCRIPTION_PROVIDER;

  if (forced === "groq" && GROQ_API_KEY)  return "groq";
  if (forced === "openai" && OPENAI_API_KEY) return "openai";

  // Default: prefere Groq se tem key
  if (GROQ_API_KEY)   return "groq";
  if (OPENAI_API_KEY) return "openai";

  return null; // erro descritivo
}
```

## Modelos do Groq

Por padrão usamos `whisper-large-v3-turbo` (mais rápido + mais barato). Pra trocar:

```bash
GROQ_WHISPER_MODEL=whisper-large-v3
```

| Modelo | Custo/h | Notas |
|---|---|---|
| `whisper-large-v3-turbo` (default) | $0.04 | Mais rápido, qualidade quase idêntica |
| `whisper-large-v3` | $0.111 | Mais preciso em situações difíceis (ruído, sotaque forte) |
| `distil-whisper-large-v3-en` | $0.02 | **Só inglês** — não usar pra pt-BR |

Pra reuniões comerciais em pt-BR padrão, `turbo` é suficiente.

## Verificar provider ativo

A função `getActiveTranscriptionProvider()` em `src/lib/reunioes/transcription/whisper.ts` retorna qual provider está sendo usado + custo estimado. Pode usar em uma página de admin no futuro:

```ts
import { getActiveTranscriptionProvider } from "@/lib/reunioes/transcription/whisper";
const p = getActiveTranscriptionProvider();
// { name: "groq", model: "whisper-large-v3-turbo", costPerHourBrl: 0.22 }
```

## Quando faz sentido voltar pra OpenAI

Praticamente nunca. Mas se:
- **Groq tá fora do ar**: setar `REUNIOES_TRANSCRIPTION_PROVIDER=openai` (sem deploy)
- **Reunião muito ruidosa e Groq Turbo não tá acertando**: trocar `GROQ_WHISPER_MODEL=whisper-large-v3` antes de pular pra OpenAI
- **Conformidade exige usar OpenAI** (não é o caso da Yide)
