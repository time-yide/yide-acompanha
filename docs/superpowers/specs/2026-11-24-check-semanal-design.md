# Check semanal (check-in segunda / check-out quinta) — Design

**Data:** 2026-11-24 · **Status:** aprovado pela Yasmin

## Objetivo
Toda segunda Yasmin/Lucas fazem check-in (Google Meet) com cada assessor sobre o que fazer na carteira até quinta; na quinta, check-out confere o que foi feito. A reunião de check-in é gravada, transcrita, e a IA sugere um checklist que é revisado e liberado pro assessor.

## Decisões
- Itens vivem só na página Check (não viram `tasks`).
- IA sugere → sócio/adm revisam (editar, trocar cliente, apagar, incluir) → "Liberar para o assessor".
- Check-out sem gravação: cada item Feito / Não feito (motivo obrigatório). "Fechar semana" leva os não feitos pro check-in seguinte.
- Quem vê: `socio`/`adm` todos os assessores (conduzem); `assessor` só o próprio check, e só depois de liberado. Coordenador fora.

## Dados (migration manual `20261125000000_check_semanal.sql`)
- `check_semanais`: `assessor_id`, `semana_inicio` (segunda, date), `status` (`aberto` → `processando` → `em_revisao` → `liberado` → `fechado`), `meeting_id` (gravação do check-in), `liberado_em/por`, `fechado_em/por`. Único por (assessor, semana).
- `check_itens`: `check_id`, `cliente_id` (nullable), `texto`, `origem` (`ia`|`manual`|`semana_anterior`), `item_origem_id`, `citacao`, `ordem`, `feito_assessor_em`, `resultado` (`feito`|`nao_feito`|null), `motivo`.
- RLS ligada sem policies (nega tudo pro client); todo acesso via server com service-role + checagem de permissão em `src/lib/check/permissions.ts`.

## Fluxo
1. `/check?semana=` — cards por assessor ativo (status, X de Y feitos). Assessor é redirecionado pro próprio.
2. `/check/[assessorId]?semana=` — abas Check-in / Check-out.
3. "Começar check-in" cria o check da semana e copia os itens `nao_feito` do último check fechado (origem `semana_anterior`).
4. Gravador existente (`GravadorReuniao`) ganha `checkSemanalId`: liga `meeting_id` e marca `processando`.
5. Worker `reunioes-worker`: no passo de resumo, se a reunião é de um check, NÃO grava `meeting_extracted_tasks` (fica fora do auto-tarefas) e chama `extrairItensCheck` (Claude Haiku, recebe a carteira do assessor) → insere `check_itens` origem `ia` com `cliente_id` casado por nome → status `em_revisao`.
6. Liberar → notifica o assessor (`task_assigned`).
7. Assessor marca feito durante a semana (`feito_assessor_em`).
8. Check-out: resultado por item; fechar exige todos decididos e motivo nos não feitos.

## Fora do escopo
Bot que entra no Meet, aviso automático na quinta, converter item em tarefa.
