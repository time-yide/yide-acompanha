"use client";

import { useRealtimeRefresh } from "@/lib/supabase/use-realtime-refresh";

/**
 * Headless: ouve qualquer mudança na tabela leads e dispara
 * router.refresh() pra atualizar o kanban quando alguém move card,
 * cria lead, marca como perdido, etc.
 */
export function OnboardingRealtimeWatcher() {
  useRealtimeRefresh("onboarding-kanban", "leads");
  return null;
}
