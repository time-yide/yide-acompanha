# FreelaYide — Conquistas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Conquistas desbloqueáveis no FreelaYide (medalhas monotônicas + notificação + coleção).

**Spec:** `docs/superpowers/specs/2026-07-18-freela-conquistas-design.md` (código completo lá).

**Tech:** Next.js App Router, Supabase (service-role), lucide-react, vitest. 3 migrations MANUAIS.

---

## Ordem de execução

1. **Migrations** (arquivos .sql; aplicadas à mão pela Yasmin depois do merge):
   `20260718200000_freela_conquistas.sql`, `20260718200100_notification_event_conquista.sql`,
   `20260718200200_notification_rules_conquista_seed.sql` (SQL no spec).
2. **`src/types/database.ts`**: adicionar `"conquista_desbloqueada"` no enum `notification_event`
   nos DOIS lugares (union + array const), após `freela_reservada`.
3. **`src/lib/freela-yide/conquistas.ts`** (puro) + **`tests/unit/freelayide-conquistas.test.ts`** (TDD).
4. **`src/lib/freela-yide/queries.ts`**: `getConquistaStats(userId)` + `getConquistasDesbloqueadas(userId)`.
5. **`src/lib/freela-yide/verificar-conquistas.ts`**: `verificarConquistas(userId)` (best-effort, upsert ignoreDuplicates + notifica só as novas).
6. **`src/lib/freela-yide/actions.ts`**: chamar `verificarConquistas(actor.id)` no `pegarOportunidadeAction` e `verificarConquistas(op.pego_por)` (se houver) no `moverStatusAction`.
7. **`src/components/freela-yide/ConquistasGrid.tsx`** (presentacional, mapa string→ícone lucide).
8. **`src/app/(authed)/freela-yide/conquistas/page.tsx`** (subpágina).
9. **`src/app/(authed)/freela-yide/page.tsx`**: link "Conquistas →" no cabeçalho do Ranking.
10. **Verificação**: `npx tsc --noEmit`, `npx eslint <arquivos>`, `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-conquistas.test.ts`.

Todo o código exato (CONQUISTAS, progressoDe, verificarConquistas, grid, páginas) está no spec.

## Self-review
- Cobre spec: banco, tipos, puro+teste, queries, verificador, gatilhos, UI, link. ✔
- Crédito ao `op.pego_por` no moverStatus (não ao ator). ✔
- Sem quebrar TS: enum adicionado nos tipos gerados. ✔
