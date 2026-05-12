"use client";

import { useState, type ReactNode } from "react";
import { FileText, Sparkles, ListChecks, Layers, AlertCircle } from "lucide-react";

type TabId = "resumo" | "topicos" | "transcricao" | "insights" | "tarefas";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface Props {
  tabs: Array<TabConfig & { content: ReactNode }>;
  initial?: TabId;
}

const ICONS_FALLBACK: Record<TabId, React.ComponentType<{ className?: string }>> = {
  resumo: Sparkles,
  topicos: Layers,
  transcricao: FileText,
  insights: AlertCircle,
  tarefas: ListChecks,
};

/**
 * Tabs do detalhe da reunião. Client component pra tab switching local
 * (sem mexer em URL nem layout pesado).
 */
export function MeetingDetailTabs({ tabs, initial }: Props) {
  const [active, setActive] = useState<TabId>(initial ?? tabs[0]?.id ?? "resumo");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b pb-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon ?? ICONS_FALLBACK[tab.id];
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`relative inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[200px]">{activeTab?.content}</div>
    </div>
  );
}
