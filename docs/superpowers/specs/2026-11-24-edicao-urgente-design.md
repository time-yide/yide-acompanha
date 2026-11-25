# Edição urgente + prazo fixo de 3 dias úteis — Design

**Data:** 2026-11-24
**Status:** aprovado pela Yasmin

## Problema

Não existe forma de sinalizar que uma gravação tem vídeo que precisa sair antes do prazo normal de edição. Hoje o prazo da tarefa de edição é 5 dias úteis contados da **subida da captação** (`addBusinessDays(now, 5)` em `src/lib/audiovisual/auto-delegate.ts:265`), e na delegação manual vale o `due_date` digitado.

## Regras de negócio

1. **Prazo padrão de edição = data da gravação + 3 dias úteis** (pula sáb/dom; feriados fora do escopo). Calculado pelo sistema, não editável — vale para delegação automática e manual.
   - Data da gravação = `calendar_events.inicio` (data em BRT) do evento ligado à captação; se a captação não tiver evento, usa `audiovisual_capturas.data_captacao`.
2. **Agendamento (assessor/quem cria evento Videomaker):** pergunta obrigatória "Tem edição que precisa sair antes do prazo (3 dias úteis)?" Sim/Não.
   - Se Sim: obrigatórios **data urgente** (≥ data da gravação e < prazo padrão) e **quantidade de vídeos urgentes** (inteiro ≥ 1).
   - Vale só para `sub_calendar = "videomakers"`.
   - Séries recorrentes: na criação só aceitam "Não" (uma data urgente não faz sentido para várias datas). A urgência é marcada depois, editando a ocorrência ou na captação.
   - Eventos antigos com valor `null`: ao editar, a pergunta passa a ser obrigatória.
3. **Subida da captação (videomaker):** a mesma pergunta aparece **pré-preenchida** com o valor do evento; videomaker pode mudar. **Vale o valor da captação.** Obrigatória.
   - Se Sim: mesmas validações de data; `qtd_urgente ≤ qtd_videos`.
4. **Tarefas de edição geradas:**
   - Sem urgência: 1 tarefa como hoje, prazo = regra 1.
   - Com urgência: 2 tarefas para o **mesmo editor**:
     - `"URGENTE – Editar: <cliente> (<data>)"`, `prioridade: "alta"`, `due_date` = data urgente, descrição com "N vídeo(s) urgente(s)".
     - `"Editar: <cliente> (<data>)"`, `prioridade: "media"`, `due_date` = regra 1, com os vídeos restantes.
     - Se `qtd_urgente = qtd_videos`, só a tarefa urgente é criada.
   - Escolha do editor (`escolherEditor`) não muda: menos tarefas abertas primeiro.
   - Ao criar tarefa urgente: notificação (`prioridade: "urgente"`) para o assessor do cliente e coordenadores audiovisuais.
5. **Calendário:** evento Videomaker com urgência mostra selo laranja (mesmo padrão de `freela.urgente` em `EventCell.tsx`).

## Dados (migration manual)

`calendar_events` e `audiovisual_capturas`, mesmas 3 colunas:
- `edicao_urgente boolean null` (null = não respondido, só legado)
- `edicao_urgente_data date null`
- `edicao_urgente_qtd int null`
- check: `edicao_urgente is not true or (edicao_urgente_data is not null and edicao_urgente_qtd >= 1)`

`audiovisual_capturas.task_urgente_id uuid null references tasks(id) on delete set null` — liga a tarefa urgente (a normal continua em `task_id`). Quando só existe a urgente, ela vai em `task_id` e `task_urgente_id` fica null.

**Cuidado (memória do projeto):** o SELECT do calendário tem fallback de colunas — adicionar as colunas novas à whitelist do catch no mesmo PR, e bumpar a key do `unstable_cache` do calendário, senão o calendário esvazia entre deploy e migration.

## Código

- **Novo** `src/lib/datas/dias-uteis.ts`: `addDiasUteis(dataYmd: string, n: number): string` em BRT (sem `toISOString` UTC) + `prazoEdicaoPadrao(dataGravacaoYmd)`. Testes unitários (sexta → quarta, segunda → quinta). Remove o `addBusinessDays` privado do `auto-delegate.ts`.
- **Novo** componente `EdicaoUrgenteField` (radio Sim/Não + data + qtd), usado em `EventForm.tsx` e `CapturaForm.tsx`. Cliente: importar só de `constants`, nunca `schema.ts` (bundle zod).
- `src/lib/calendario/schema.ts` + `actions.ts` (create/update): validar e gravar os 3 campos quando `sub_calendar = videomakers`.
- `src/lib/audiovisual/schema.ts` + `createCapturaAction`: validar e gravar; o form recebe os valores do evento para pré-preencher.
- `auto-delegate.ts` (`_autoAssignEditorImpl`) e `delegateCapturaAction`: prazo pela regra 1, criação de 1 ou 2 tarefas, gravar `task_urgente_id`, notificação. Guarda de corrida existente vale para as duas.
- `delegateCapturaAction`: ignora `due_date` do form; campo vira só leitura na UI.
- Cron `audiovisual-auto-delegar-edicao`: sem mudança (já reusa `autoAssignEditor`).
- `EventCell.tsx`: selo laranja.

## Erros / bordas

- Data urgente ≥ prazo padrão → erro "isso já está dentro do prazo normal, marque Não".
- Captação subida depois da data urgente → aceita, tarefa urgente nasce já atrasada (aparece como atrasada, normal).
- Falha ao criar a segunda tarefa → apaga a(s) criada(s) e deixa o cron tentar de novo (mesmo padrão do link atual).

## Fora do escopo

Feriados; urgência por vídeo específico (só quantidade); mudar urgência depois que a tarefa já existe.
