"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import type { YoriTemplate } from "@/lib/yori/tipos";
import { deleteYoriTemplateAction } from "@/lib/yori/actions";
import { YoriTemplateForm } from "@/components/yori/YoriTemplateForm";

interface Props {
  templates: YoriTemplate[];
  currentUserId: string;
}

export function YoriTemplatesClient({ templates, currentUserId }: Props) {
  const [editing, setEditing] = useState<YoriTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Deletar este template?")) return;
    startTransition(async () => {
      await deleteYoriTemplateAction(id);
    });
  }

  const system = templates.filter((t) => t.is_system);
  const myCustom = templates.filter((t) => !t.is_system && t.user_id === currentUserId);
  const orgCustom = templates.filter((t) => !t.is_system && t.user_id !== currentUserId);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" /> Novo template
      </button>

      <Section title="Sistema (não editáveis)">
        {system.map((t) => <TemplateRow key={t.id} template={t} canEdit={false} />)}
      </Section>

      <Section title="Meus templates">
        {myCustom.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum template próprio ainda.</p>
        ) : (
          myCustom.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              canEdit={true}
              onEdit={() => setEditing(t)}
              onDelete={() => handleDelete(t.id)}
            />
          ))
        )}
      </Section>

      {orgCustom.length > 0 && (
        <Section title="Templates da equipe">
          {orgCustom.map((t) => <TemplateRow key={t.id} template={t} canEdit={false} />)}
        </Section>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">{editing ? "Editar template" : "Novo template"}</h2>
            <YoriTemplateForm
              initial={editing ?? undefined}
              onClose={() => { setCreating(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TemplateRow({
  template, canEdit, onEdit, onDelete,
}: {
  template: YoriTemplate;
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-2 text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-6 w-10 rounded flex-shrink-0 border"
          style={{ backgroundColor: template.primary_color }}
        />
        <div className="min-w-0">
          <p className="font-medium truncate">{template.nome}</p>
          <p className="text-[10px] text-muted-foreground">
            {template.base_template} · {template.font_family} · {template.font_size}px
          </p>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1">
          <button type="button" onClick={onEdit} className="rounded p-1 hover:bg-muted">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
