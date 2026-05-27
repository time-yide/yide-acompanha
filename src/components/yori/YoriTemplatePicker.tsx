"use client";

import type { YoriTemplate } from "@/lib/yori/tipos";

interface Props {
  templates: YoriTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function YoriTemplatePicker({ templates, selectedId, onSelect }: Props) {
  const system = templates.filter((t) => t.is_system);
  const custom = templates.filter((t) => !t.is_system);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Templates do sistema
        </p>
        <div className="grid grid-cols-3 gap-2">
          {system.map((t) => (
            <TemplateCard key={t.id} template={t} selected={selectedId === t.id} onSelect={onSelect} />
          ))}
        </div>
      </div>
      {custom.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Meus templates
          </p>
          <div className="grid grid-cols-3 gap-2">
            {custom.map((t) => (
              <TemplateCard key={t.id} template={t} selected={selectedId === t.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template, selected, onSelect,
}: {
  template: YoriTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <div
        className="mb-2 flex h-10 items-center justify-center rounded text-xs font-bold"
        style={{
          backgroundColor: template.has_shadow ? "rgba(0,0,0,0.2)" : "transparent",
          color: template.primary_color,
        }}
      >
        Preview
        {template.highlight_color && (
          <span style={{ color: template.highlight_color, marginLeft: 4 }}>★</span>
        )}
      </div>
      <p className="text-xs font-medium truncate">{template.nome}</p>
      <p className="text-[10px] text-muted-foreground">{template.base_template}</p>
    </button>
  );
}
