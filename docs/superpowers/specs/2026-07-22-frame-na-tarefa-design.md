# Frame na Tarefa (entrega ao assessor) — Design

**Data:** 2026-07-22
**Status:** aprovado pela Yasmin
**Depende de:** **Fase A do Frame** (review_video/versao/comentario + Bunny + player) já mergeada.

Traz o Frame **pra dentro da tarefa de vídeo**: o time sobe/revisa o vídeo ali, e o **assessor precisa assistir até o fim antes de baixar** e mandar pro cliente. Fim do vídeo no grupo do WhatsApp interno.

---

## 1. Objetivo

Todo o processo do vídeo de um cliente acontece **na tarefa**:
1. Editor/videomaker **sobe o vídeo no Frame** direto da tarefa (no lugar de colar link do Drive).
2. Time audiovisual comenta no tempo / pede ajuste → nova versão.
3. Tarefa vai pro **assessor** (fluxo de aprovação que já existe).
4. 🔒 **Trava:** o assessor só libera **Baixar / Aprovar / Pedir alteração** depois de **assistir ≥90%** da versão atual.
5. Assistiu → **baixa o MP4** → envia pro cliente por fora → marca postada.
6. Pediu alteração → volta pro editor → nova versão → **a trava rearma** (assistir de novo).

**Não-objetivos (por ora):** portal/link do cliente (Fase futura); tipos que não sejam vídeo.

---

## 2. Como se liga às Tarefas (reuso, não duplica)

- **`review_video` ganha `task_id`** (FK → `tasks`, nullable). Um vídeo-review pertence a uma tarefa de vídeo.
- **A fonte da verdade do status continua sendo a TAREFA** (o fluxo `em_aprovacao → aprovada`/`alteracao → postada` já existe). O Frame **não** cria um segundo sistema de aprovação — ele é o **host do vídeo + player + comentários + trava**.
- O "material entregue" da tarefa de vídeo passa a ser **o vídeo do Frame** (o `drive_link` deixa de ser obrigatório pra tarefa de vídeo que usa o Frame).

**Mapa de ações (reusa as actions de tarefa existentes):**
| Ação | Quem | Efeito |
|---|---|---|
| Subir vídeo no Frame | editor/videomaker (atribuído) | cria/atualiza `review_video` da tarefa + nova `review_versao` (upload Bunny) |
| Comentar no tempo | time | `review_comentario` |
| Enviar pra aprovação | executor | `submitForApprovalAction` (já existe) |
| **Aprovar** | assessor (criador) | `approveTaskAction` (já existe) — **destravado só após assistir** |
| **Pedir alteração** | assessor | `requestAdjustmentsAction` (já existe) — **destravado só após assistir** → editor sobe nova versão |
| **Baixar vídeo** | assessor | **destravado só após assistir** — baixa o MP4 do Bunny |
| Marcar postada | assessor | `markAsPostedAction` (já existe) |

---

## 3. A trava de "assistir até o fim"

- **Tabela nova `review_assistido`**: `(user_id, versao_id)` PK, `pct_max int` (0–100), `updated_at`.
- O **Player** reporta o progresso (a cada X segundos manda o `pct` máximo assistido da versão atual).
- **Destrava** (Baixar / Aprovar / Pedir alteração) quando `pct_max ≥ 90` da **versão ATUAL** do review.
- **Rearma:** versão nova = novo `versao_id` sem registro → volta a travar até assistir a nova.
- Só se aplica ao **assessor** (quem vai baixar/aprovar). O time audiovisual comenta livremente sem trava.
- UI: enquanto travado, os botões aparecem desabilitados com "Assista o vídeo até o fim pra liberar" + a barrinha do quanto já assistiu.

---

## 4. Download (MP4 do Bunny)

- Habilitar **MP4 fallback** na biblioteca Bunny (config única no painel).
- Uma server action `linkDownloadAction(versaoId)` valida a trava (assistiu?) + permissão, e devolve a **URL do MP4** do Bunny (`https://{cdn}/{guid}/play_720p.mp4` ou a melhor resolução disponível).
- O botão "Baixar vídeo" só chama isso quando destravado.

---

## 5. Onde aparece (UI)

- **Página da tarefa** `/tarefas/[id]` (tarefa `tipo=video`): nova seção **"Vídeo (Frame)"** — logo após o `ApprovalCard`:
  - Se ainda não tem vídeo: botão **"Subir vídeo"** (pro executor).
  - Se tem: **player + versões + comentários no tempo**; pro assessor, os botões **Baixar / Aprovar / Pedir alteração** com a trava.
- Reusa os componentes da Fase A (`Player`, `Comentarios`, `UploadVersao`) num wrapper `VideoDaTarefa`.
- A tela standalone `/audiovisual/review` da Fase A continua existindo (entrada alternativa), mas o fluxo principal passa a ser dentro da tarefa.

---

## 6. Permissões
- Subir vídeo / comentar interno: quem já mexe na tarefa (executor + time audiovisual + gestão) — via `manage:review` + ser membro da tarefa.
- Baixar / aprovar / pedir alteração: o **assessor** da tarefa (criador) + adm/sócio (como no fluxo de tarefa atual). A trava de assistir vale pra todos que forem baixar.

---

## 7. Dados (migration manual)
- `alter table review_video add column task_id uuid references tasks(id) on delete set null;` + índice.
- `create table review_assistido (user_id uuid, versao_id uuid references review_versao(id) on delete cascade, pct_max int not null default 0, updated_at timestamptz default now(), primary key (user_id, versao_id));` + RLS read authenticated.

---

## 8. Erros e bordas
- Tarefa sem vídeo ainda → mostra só o botão "Subir vídeo".
- Vídeo processando no Bunny → player mostra "processando"; trava não libera até tocar.
- Nova versão subida → botões do assessor voltam a travar automaticamente.
- Bunny não configurado → seção mostra aviso (herda o comportamento da Fase A).

---

## 9. Testes
- Lógica da trava (`destravado(pctMax, versaoAtualId, registros)`) — pura, testável.
- Watch tracking / download / Bunny — camada fina + teste manual.

---

## 10. Critérios de aceite
- [ ] Tarefa de vídeo mostra o Frame (player + versões + comentários) embutido.
- [ ] Editor sobe o vídeo pela tarefa (vira o "material entregue").
- [ ] Assessor só baixa/aprova/pede-alteração **após assistir ≥90%** da versão atual.
- [ ] Nova versão rearma a trava.
- [ ] Baixar entrega o MP4 do Bunny.
- [ ] Reusa o fluxo de status da tarefa (não duplica aprovação).
- [ ] Migration (task_id + review_assistido) documentada pra aplicação manual.
