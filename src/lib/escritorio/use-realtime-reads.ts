"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authenticateRealtime } from "@/lib/supabase/realtime-auth";
import type { ChannelRead } from "./types";

interface ReadPayload {
  new: { user_id: string; channel_id: string; last_read_at: string } | null;
}

/**
 * Subscribe às leituras (chat_reads) de um canal em tempo real. Quando alguém
 * abre/relê o canal, o last_read_at dele atualiza e o ✓✓ ("quem leu") reage na
 * hora. Devolve um Map user_id → ChannelRead.
 *
 * `profilesById` resolve nome/avatar de quem aparece via realtime (o payload da
 * chat_reads só traz user_id + last_read_at).
 *
 * Auth do Realtime: idem use-realtime-messages — precisa do setAuth (ver
 * realtime-auth.ts), senão o RLS dropa os eventos.
 */
export function useRealtimeReads(
  channelId: string,
  initialReads: ChannelRead[],
  profilesById: Record<string, { nome: string; avatar_url: string | null }>,
) {
  const [reads, setReads] = useState<Map<string, ChannelRead>>(
    () => new Map(initialReads.map((r) => [r.user_id, r])),
  );
  const profilesRef = useRef(profilesById);
  useEffect(() => {
    profilesRef.current = profilesById;
  }, [profilesById]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null;
    let unsubAuth: (() => void) | null = null;

    async function start() {
      unsubAuth = await authenticateRealtime(supabase);
      if (cancelled) return;

      function handle(payload: ReadPayload) {
        const row = payload.new;
        if (!row?.user_id) return;
        setReads((prev) => {
          const next = new Map(prev);
          const existing = next.get(row.user_id);
          const prof = existing ?? profilesRef.current[row.user_id] ?? { nome: "Alguém", avatar_url: null };
          next.set(row.user_id, {
            user_id: row.user_id,
            last_read_at: row.last_read_at,
            nome: prof.nome,
            avatar_url: prof.avatar_url,
          });
          return next;
        });
      }

      // Cast pra any: a tipagem de .on("postgres_changes") do supabase-js briga
      // com o event "*"/INSERT/UPDATE — mesmo padrão usado no resto do projeto.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder = supabase.channel(`reads:${channelId}`) as any;
      const filter = { schema: "public", table: "chat_reads", filter: `channel_id=eq.${channelId}` };
      channelRef = builder
        .on("postgres_changes", { event: "INSERT", ...filter }, handle)
        .on("postgres_changes", { event: "UPDATE", ...filter }, handle)
        .subscribe();
    }

    void start();
    return () => {
      cancelled = true;
      unsubAuth?.();
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [channelId]);

  return reads;
}
