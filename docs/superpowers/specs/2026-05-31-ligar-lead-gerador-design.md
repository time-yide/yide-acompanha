# Botão "Ligar" no Gerador de Leads (registra + metrifica)

**Data:** 2026-05-31
**Branch:** `feat/ligar-lead-gerador` (base `origin/main`)

## Objetivo

No Gerador de Leads, um botão **"Ligar"** por lead que: (1) abre o discador do aparelho (`tel:`), (2) **registra a ligação** vinculada ao lead na tabela `ligacoes` (entra no dashboard/métricas), e (3) pergunta o **resultado** na hora (Atendida / Não atendeu / Ocupado / Caixa postal) com 1 toque. Funciona **sem Zenvia** e **sem migration** (a tabela `ligacoes` já tem tudo, inclusive `lead_gerado_id` e `origem='manual'`).

## Decisões (alinhadas)
- Número discado: `telefone`, caindo pro `whatsapp` se não houver telefone.
- **Não** muda o status do lead automaticamente.
- Resultado com 4 opções (mapeadas pro enum de status: Atendida→`atendida`, Não atendeu→`perdida`, Ocupado→`ocupada`, Caixa postal→`caixa_postal`).
- Botão só pra quem gerencia (mesmos papéis do módulo ligações: adm/socio/comercial/coordenador/assessor) — é ele que escreve no banco.

## Componentes

1. **`src/components/gerador-leads/LigarLeadButton.tsx`** (client)
   - Props: `leadGeradoId`, `numero` (string), `contatoNome`.
   - Click → `registrarLigacaoLeadAction` (cria a ligação, retorna id) → `window.location.href = tel:<numero sanitizado>` → exibe o seletor de resultado.
   - Seletor (4 botões) → `registrarResultadoLigacaoAction(id, status)` → fecha + `router.refresh()`.
   - Em erro de registro, mostra mensagem e não disca.

2. **`src/lib/ligacoes/actions.ts`** — 2 actions novas:
   - `registrarLigacaoLeadAction(formData)`: auth + canManage; orgId do profile; insert `ligacoes` (`origem='manual'`, `tipo='telefone'`, `direcao='saida'`, `lead_gerado_id`, `numero`, `contato_nome`, `colaborador_id=actor`, `iniciada_em=now`, `status='em_andamento'`); retorna `{ success:true, id } | { error }`.
   - `registrarResultadoLigacaoAction(formData)`: auth + canManage; parse `id`+`status`; update `ligacoes` set `status` + `finalizada_em=now` where `id` e `colaborador_id=actor.id` (só edita a própria); `revalidatePath('/ligacoes')`.

3. **`src/lib/ligacoes/schema.ts`** — 2 schemas:
   - `registrarLigacaoLeadSchema` (numero min8/max40, lead_gerado_id uuid, contato_nome opcional).
   - `resultadoLigacaoSchema` (id uuid, status `z.enum(STATUS_LIGACAO)`).

4. **`src/components/gerador-leads/LeadActions.tsx`** — renderiza `<LigarLeadButton>` quando `canManage` e há número (`telefone ?? whatsapp`).

## Métricas
A ligação entra em `ligacoes` com colaborador + status + `lead_gerado_id` → aparece automaticamente no dashboard `/ligacoes` (total, por colaborador, donut de status, heatmap). Nada novo de métrica a construir.

## Testes
- Unit: `resultadoLigacaoSchema` (aceita status válido, rejeita inválido) e `registrarLigacaoLeadSchema` (aceita número+lead válidos, rejeita número curto).

## Fora de escopo (YAGNI)
- Duração da ligação (tel: não reporta; fica 0). Duração real só com Zenvia.
- Mudar status do lead ao ligar (pode ligar depois com 1 linha).
- Editar resultado de ligação de outro colaborador (usa o /ligacoes existente).

## Sem migration / sem passo manual
Nenhuma mudança de schema. Deploya 100% no merge.
