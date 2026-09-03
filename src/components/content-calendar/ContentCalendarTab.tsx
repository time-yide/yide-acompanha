"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPostCard } from "./CalendarPostCard";
import { ApproveCalendarButton } from "./ApproveCalendarButton";
import { updateCalendarPostsAction } from "@/lib/content-calendar/actions";
import type {
  ContentCalendarRow,
  CalendarMode,
  GeneratedPost,
} from "@/lib/content-calendar/types";

const STATUS_CONFIG = {
  pendente_geracao: {
    label: "Pendente",
    variant: "outline" as const,
  },
  gerando: {
    label: "Gerando...",
    variant: "secondary" as const,
  },
  gerado: {
    label: "Gerado",
    variant: "default" as const,
  },
  aprovado: {
    label: "Aprovado",
    variant: "default" as const,
  },
  erro: {
    label: "Erro",
    variant: "destructive" as const,
  },
};

interface Props {
  clientId: string;
  calendarData: ContentCalendarRow | null;
  modo: CalendarMode;
}

export function ContentCalendarTab({ clientId, calendarData, modo }: Props) {
  const [calendar, setCalendar] = useState(calendarData);
  const [posts, setPosts] = useState<GeneratedPost[]>(
    calendarData?.posts_json ?? [],
  );
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (calendarData?.mes_referencia) return calendarData.mes_referencia;
    const now = new Date();
    const day = now.getDate();
    if (day > 3) {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingMonth, setLoadingMonth] = useState(false);

  const handleUpdate = useCallback(
    (index: number, field: string, value: string) => {
      setPosts((prev) => {
        const updated = [...prev];
        if (field === "hashtags") {
          updated[index] = {
            ...updated[index],
            hashtags: value.split(/\s+/).filter(Boolean),
          };
        } else {
          updated[index] = { ...updated[index], [field]: value };
        }
        return updated;
      });
      setDirty(true);
    },
    [],
  );

  function handleSave() {
    if (!calendar) return;
    startSaving(async () => {
      const result = await updateCalendarPostsAction(calendar.id, posts);
      if ("error" in result) {
        alert(result.error);
      } else {
        setDirty(false);
      }
    });
  }

  async function navigateMonth(direction: -1 | 1) {
    const [year, month] = currentMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCurrentMonth(newMonth);
    setLoadingMonth(true);

    try {
      const res = await fetch(
        `/api/content-calendar?clientId=${clientId}&mes=${newMonth}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCalendar(data as ContentCalendarRow | null);
        setPosts((data as ContentCalendarRow | null)?.posts_json ?? []);
        setDirty(false);
      } else {
        setCalendar(null);
        setPosts([]);
        setDirty(false);
      }
    } catch {
      setCalendar(null);
      setPosts([]);
    } finally {
      setLoadingMonth(false);
    }
  }

  const monthLabel = (() => {
    const [year, month] = currentMonth.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  const isReadOnly = calendar?.status === "aprovado";

  // -- No calendar --
  if (!calendar) {
    return (
      <div className="space-y-4">
        <MonthNav
          monthLabel={monthLabel}
          onPrev={() => navigateMonth(-1)}
          onNext={() => navigateMonth(1)}
          loading={loadingMonth}
        />
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p className="text-sm">
            Nenhum cronograma gerado para este mes
          </p>
        </div>
      </div>
    );
  }

  // -- Generating --
  if (calendar.status === "gerando") {
    return (
      <div className="space-y-4">
        <MonthNav
          monthLabel={monthLabel}
          onPrev={() => navigateMonth(-1)}
          onNext={() => navigateMonth(1)}
          loading={loadingMonth}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Gerando cronograma...
          </p>
        </div>
      </div>
    );
  }

  // -- Error --
  if (calendar.status === "erro") {
    return (
      <div className="space-y-4">
        <MonthNav
          monthLabel={monthLabel}
          onPrev={() => navigateMonth(-1)}
          onNext={() => navigateMonth(1)}
          loading={loadingMonth}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">
            Erro ao gerar cronograma
          </p>
          {calendar.erro_msg && (
            <p className="max-w-md text-center text-xs text-muted-foreground">
              {calendar.erro_msg}
            </p>
          )}
        </div>
      </div>
    );
  }

  // -- Generated or Approved --
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthNav
          monthLabel={monthLabel}
          onPrev={() => navigateMonth(-1)}
          onNext={() => navigateMonth(1)}
          loading={loadingMonth}
        />
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_CONFIG[calendar.status].variant}>
            {calendar.status === "aprovado" && (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {STATUS_CONFIG[calendar.status].label}
          </Badge>
          <Badge variant="outline">
            {modo === "completo" ? "Completo" : "Leve"}
          </Badge>
        </div>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        {posts.map((post, i) => (
          <CalendarPostCard
            key={`${post.ordem}-${i}`}
            post={post}
            index={i}
            calendarId={calendar.id}
            modo={modo}
            onUpdate={handleUpdate}
            readOnly={isReadOnly}
          />
        ))}
      </div>

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
          <ApproveCalendarButton calendarId={calendar.id} />
        </div>
      )}
    </div>
  );
}

function MonthNav({
  monthLabel,
  onPrev,
  onNext,
  loading,
}: {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button size="icon-xs" variant="ghost" onClick={onPrev} disabled={loading}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium capitalize">
        {loading ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          monthLabel
        )}
      </span>
      <Button size="icon-xs" variant="ghost" onClick={onNext} disabled={loading}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
