# Entrega de vídeo sobe pro Frame direto no modal de conclusão — Design

**Data:** 2026-07-23
**Status:** aprovado pela Yasmin (desenho)
**Depende de:** **Frame na Tarefa** (`review_video`/`review_versao`/`review_comentario` + Bunny + player + trava de assistir) já mergeado — ver [2026-07-22-frame-na-tarefa-design.md](2026-07-22-frame-na-tarefa-design.md).

Fecha o elo que ficou aberto no Frame na Tarefa: hoje o vídeo só entra no Frame por um botão separado ("Adicionar vídeo") na página da tarefa. O **modal de conclusão de entrega** — que dispara quando o editor/videomaker move o card pra "Concluído Operacional" ou "Aprovação" — ainda pede **link do Drive**. Este design faz esse modal, **para tarefas de vídeo**, subir o(s) arquivo(s) direto pro Frame em vez de pedir link.

---

## 1. Objetivo

Quando o responsável move uma tarefa de **vídeo** pra "Concluído Operacional" **ou** "Aprovação", o modal de entrega:
1. Pede pra **escolher o(s) arquivo(s) de vídeo** daquela tarefa (1 ou vários).
2. Sobe cada arquivo pro **Frame** (Bunny) — cada arquivo vira um frame da tarefa (Vídeo 1, Vídeo 2…).
3. Move a tarefa pro status alvo com a **quantidade = nº de vídeos**.
4. Daí pra frente roda a estrutura de Frame que já existe: player, comentários por frame, trava de assistir ≥90%, aprovar / pedir ajuste.

**Não-objetivos:** mudar o fluxo de aprovação/comentários/trava (já existe); mexer na entrega de **arte** (designer) ou de tarefa **geral** — essas continuam com o modal de link do Drive de hoje.

---

## 2. Escopo: só tarefas de vídeo

O comportamento novo vale quando a tarefa é de vídeo, mesma regra que o modal já usa pra decidir o label de quantidade (`resolveQtdLabel` em `ConcludeOperationalModal.tsx`):
- `taskTipo === "video"`, **ou**
- `taskTipo === "geral"` com responsável de vídeo (editor / videomaker / videomaker_mobile / audiovisual_chefe).

Tarefa de **arte** (`arte` / designer) e **geral comum** → **nenhuma mudança**, seguem pedindo link do Drive.

Vale para **os dois** status alvo do modal: `concluida` (Concluído Operacional) **e** `em_aprovacao` (Aprovação).

---

## 3. O modal, para vídeo

Reaproveita o `ConcludeOperationalModal.tsx`, ramificando o corpo quando a tarefa é de vídeo **e o Bunny está configurado**:

| Campo hoje | Vira |
|---|---|
| Link do Drive * (input url) | **Some.** Entra um **seletor de arquivos de vídeo** (`accept="video/*"`, múltiplo) com lista dos arquivos escolhidos + barra de progresso por vídeo durante o upload. |
| Quantos vídeos foram entregues? * (number) | **Some.** A contagem passa a ser **automática** = nº de arquivos escolhidos. |
| Observações da entrega (opcional) | Mantém igual. |
| Botão "Confirmar entrega" / "Enviar pra aprovação" | Só habilita com **≥1 arquivo** escolhido. Durante o upload, vira "Enviando… (n/N)". |

**Sempre pede upload no modal** (decisão da Yasmin): o modal não tenta reaproveitar frames que já existam na tarefa — cada conclusão pede os arquivos e cria frames novos. (Trade-off aceito: se a pessoa refizer a conclusão, pode duplicar frames; simplicidade vence.)

**Rede de segurança:** se o **Bunny não estiver configurado** (env ausente), o modal **cai no formato antigo** (link do Drive + quantidade) em vez de quebrar a entrega.

---

## 4. Fluxo ao confirmar (cliente → servidor)

Para cada arquivo escolhido, na ordem:
1. **Cria o frame** chamando `adicionarVideoAction(taskId)` (`src/lib/review/tarefa-actions.ts`) → cria `review_video` (com `task_id`) + `review_versao` v1 e devolve a assinatura de upload TUS do Bunny.
2. **Sobe os bytes** direto pro Bunny via TUS (mesma lógica de `UploadVersao.tsx` / `tus-js-client`), mostrando progresso.

Terminado o **envio dos arquivos** de todos os vídeos:
3. Chama `concludeOperationalAction` com `to_status`, `artes_entregues = nº de vídeos`, `entrega_observacoes` (sem `drive_link`) → move a tarefa pro status alvo.

**Não travar esperando o Bunny "processar"** (decisão da Yasmin): o modal fecha assim que os *uploads dos arquivos* terminam; a confirmação de "pronto" (processamento no Bunny) acontece depois, ao abrir o Frame, pelo mecanismo que já existe (`confirmarProntoAction` / polling em `UploadVersao`). Evita deixar o editor esperando ~1-2 min por vídeo.

**Falha parcial:** se algum upload falhar, mostra erro e **não** conclui a tarefa; os frames já enviados ficam visíveis na página da tarefa (podem ser removidos/reusados manualmente). A tarefa só move quando todos os arquivos subiram.

---

## 5. Mudanças no servidor

- **`concludeOperationalAction`** (`src/lib/tarefas/actions.ts`) + **`concludeOperationalSchema`** (`src/lib/tarefas/schema.ts`): tornar `drive_link` **opcional** quando a tarefa é de vídeo (o "material entregue" passa a ser o Frame, não um link). `artes_entregues` continua vindo (agora = nº de vídeos). Para arte/geral, `drive_link` segue **obrigatório** como hoje.
  - Regra robusta para relaxar: aceitar `drive_link` vazio quando a tarefa tem `tipo` de vídeo **ou** já possui ≥1 `review_video` com aquele `task_id`.
- **Nenhuma migration nova.** Reusa `review_video.task_id`, `review_versao`, e as colunas `artes_entregues` / `entrega_observacoes` que já existem em `tasks`.
- **Permissão:** quem conclui vídeo (editor / videomaker / audiovisual_chefe) já tem `manage:review` (necessária para `adicionarVideoAction`). Nada a mudar.

---

## 6. Flag de "Bunny configurado" na UI

O modal precisa saber, no cliente, se o Bunny está configurado pra decidir entre o fluxo de upload e o fallback de link do Drive. Em vez de passar um prop por toda a árvore (o modal é usado em vários pontos via `CompleteTaskButton`), o modal chama uma **server action leve `bunnyDisponivelAction()`** ao abrir (só quando a tarefa é de vídeo), reusando o helper `bunnyConfigurado()` que já existe em `src/lib/bunny/client.ts`. Assim `TasksBoard` e `CompleteTaskButton` ficam **intocados**.

---

## 7. Arquivos afetados (mapa)

| Arquivo | Mudança |
|---|---|
| `src/components/tarefas/ConcludeOperationalModal.tsx` | Ramifica corpo pra vídeo: seletor de arquivos + upload TUS + progresso; remove Drive/quantidade nesse caminho; fallback pro formato antigo sem Bunny. |
| `src/components/tarefas/TasksBoard.tsx` / `CompleteTaskButton.tsx` | Passam `bunnyConfigured` (e o `taskTipo`/`atribuidoRole` já passados) pro modal. |
| `src/lib/tarefas/actions.ts` (`concludeOperationalAction`) | `drive_link` opcional pra vídeo. |
| `src/lib/tarefas/schema.ts` (`concludeOperationalSchema`) | idem no schema de validação. |
| `src/lib/review/tarefa-actions.ts` (`adicionarVideoAction`) | reusada como está pra criar frame + devolver TUS. |
| helper de upload TUS | extrair/reusar a lógica de `UploadVersao.tsx` pra o modal (evitar duplicar `tus-js-client`). |

---

## 8. Pré-requisito

**Bunny Stream configurado em produção** (`BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_CDN_HOSTNAME`). Sem isso, o fluxo novo fica inativo e o modal usa o formato antigo (link do Drive) — nada quebra, mas o objetivo do design não acontece até o Bunny estar ligado.

---

## 9. Testes

- **Unit (resolve de fluxo):** dado (`taskTipo`, `atribuidoRole`, `bunnyConfigured`) → decide "upload de vídeo" vs "link do Drive". Cobrir vídeo+bunny=on → upload; vídeo+bunny=off → drive; arte → drive; geral sem role de vídeo → drive.
- **Unit (schema):** `concludeOperationalSchema` aceita ausência de `drive_link` no caminho de vídeo e ainda exige pra arte/geral.
- **Contagem:** `artes_entregues` = nº de arquivos enviados.
