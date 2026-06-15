# Escritório — Realtime confiável (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o bug "mensagem recebida nunca aparece sem recarregar" no Escritório, tornando o hook de mensagens robusto: polling independente do realtime, reconexão do websocket e logs de diagnóstico.

**Architecture:** Mudança cirúrgica num único arquivo client (`use-realtime-messages.ts`). O hook já tem realtime (`postgres_changes`) + polling 5s + refetch on visibility; o problema é que o polling só inicia DEPOIS de `await authenticateRealtime()` — se esse await falha/trava, nada inicia. Reordenamos pra o polling começar incondicionalmente, adicionamos reconexão no `.subscribe(status⇒…)` e logs.

**Tech Stack:** Next.js (client component), Supabase Realtime (`@supabase/supabase-js`), React hooks.

**Branch:** criar a partir de `origin/main` (ex.: `fix/escritorio-realtime`).

**Spec:** `docs/superpowers/specs/2026-06-15-escritorio-excluir-e-realtime-design.md` (Parte C).

---

## File Structure

**Modificar:**
- `src/lib/escritorio/use-realtime-messages.ts` — reordenar start(), extrair `subscribe()` com reconexão, logs, polling incondicional.

Sem migration, sem mudança de schema, sem mudança de outros arquivos.

---

## Task 1: Hardening do hook de realtime

**Files:**
- Modify: `src/lib/escritorio/use-realtime-messages.ts`

- [ ] **Step 1: Ler o arquivo atual inteiro**

Leia `src/lib/escritorio/use-realtime-messages.ts` por completo antes de editar. Confirme que existe: `POLL_INTERVAL_MS = 5000`, funções internas `fetchMessage`, `appendIfNew`, `pollNew`, `onVisibilityChange`, `start()`, e o cleanup no `return` do `useEffect`. As edições abaixo substituem o miolo do `useEffect` (de `async function start()` até o fim do `return cleanup`), mantendo as funções `fetchMessage`/`appendIfNew`/`pollNew`/`onVisibilityChange` e as refs/states existentes.

- [ ] **Step 2: Adicionar `try/catch` + log no `pollNew`**

No corpo de `pollNew`, envolva a query num try/catch pra não morrer silenciosamente. Substitua o trecho que faz a query do poll por:

```ts
    async function pollNew() {
      if (cancelled || document.hidden) return;
      try {
        const last = messagesRef.current[messagesRef.current.length - 1];
        const since = last?.created_at;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        let q = sb
          .from("chat_messages")
          .select("id, created_at")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: true })
          .limit(50);
        if (since) q = q.gt("created_at", since);
        const { data, error } = await q;
        if (error) {
          console.warn("[escritorio realtime] pollNew error:", error.message);
          return;
        }
        const rows = (data ?? []) as Array<{ id: string; created_at: string }>;
        if (rows.length === 0) return;
        const enriched = await Promise.all(rows.map((r) => fetchMessage(r.id)));
        for (const m of enriched) {
          if (m) appendIfNew(m);
        }
      } catch (e) {
        console.warn("[escritorio realtime] pollNew exception:", e);
      }
    }
```

- [ ] **Step 3: Declarar timer de reconexão e extrair `subscribe()`**

Logo após a declaração `let pollTimer ...` no início do `useEffect`, adicione:

```ts
    let resubTimer: ReturnType<typeof setTimeout> | null = null;
```

E **substitua** a função `async function start() { ... }` inteira por esta dupla (`subscribe()` + `start()`):

```ts
    function subscribe() {
      if (cancelled) return;
      const ch = supabase
        .channel(`chat:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `channel_id=eq.${channelId}`,
          },
          async (payload: RealtimePayload) => {
            const enriched = await fetchMessage(payload.new.id);
            if (enriched) appendIfNew(enriched);
          },
        )
        .subscribe((status: string) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            console.warn(
              `[escritorio realtime] status "${status}" no canal ${channelId}; re-subscrevendo em 3s`,
            );
            // Cobre o gap enquanto reconecta.
            void pollNew();
            if (channelRef) {
              supabase.removeChannel(channelRef);
              channelRef = null;
            }
            if (!cancelled && !resubTimer) {
              resubTimer = setTimeout(() => {
                resubTimer = null;
                subscribe();
              }, 3000);
            }
          }
        });
      channelRef = ch;
    }

    async function start() {
      // Polling + visibility começam JÁ, independente do realtime auth.
      // Se authenticateRealtime falhar/travar, o polling (5s) garante que
      // mensagens novas apareçam mesmo assim — esse era o bug do "nunca atualiza".
      void pollNew();
      pollTimer = setInterval(() => void pollNew(), POLL_INTERVAL_MS);
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Realtime é best-effort por cima do polling.
      try {
        unsubAuth = await authenticateRealtime(supabase);
      } catch (e) {
        console.warn(
          "[escritorio realtime] authenticateRealtime falhou; seguindo só com polling:",
          e,
        );
      }
      if (cancelled) return;
      subscribe();
    }
```

- [ ] **Step 4: Limpar o `resubTimer` no cleanup**

No `return () => { ... }` do `useEffect`, adicione o clear do `resubTimer` junto dos outros cleanups:

```ts
    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
      if (pollTimer) clearInterval(pollTimer);
      if (resubTimer) clearTimeout(resubTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "use-realtime-messages" || echo "no realtime type errors"`
Expected: `no realtime type errors`

Run: `npx eslint src/lib/escritorio/use-realtime-messages.ts`
Expected: sem erros. (Se reclamar de `RealtimePayload` ou tipo de `status`, mantenha as anotações `: string` mostradas acima.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/escritorio/use-realtime-messages.ts
git commit -m "fix(escritorio): realtime confiavel — polling independente + reconexao + logs"
```

---

## Verificação manual (pós-deploy)

Automatizar é inviável (websocket + Next). Verificar em produção depois do deploy:
1. Abrir o Escritório em 2 usuários (ou 2 abas com contas diferentes).
2. Enviar mensagem de um → deve aparecer no outro **sem recarregar**, em ≤5s (polling) ou instantâneo (realtime).
3. Abrir o console do navegador: não deve haver erro vermelho. Se aparecer `[escritorio realtime] ...`, anotar a mensagem — ela diz exatamente o que está falhando (RLS, websocket, auth) pro próximo passo.
4. Verificar no Supabase que `chat_messages` está na publication `supabase_realtime` (Database → Replication). Se não estiver, rodar: `alter publication supabase_realtime add table public.chat_messages;` (o polling já cobre a UX de qualquer jeito).

---

## Self-Review (cobertura do spec — Parte C)

- "Polling independente do realtime auth" → Task 1, Step 3 (start reordenado).
- "Reconecta quando o websocket cai" → Task 1, Step 3 (subscribe + status callback).
- "Loga status e erros do poll" → Task 1, Steps 2 e 3.
- "Poll imediato ao abrir" → Task 1, Step 3 (`void pollNew()` no início do start).
- "Verificar publication em prod" → seção Verificação manual.
