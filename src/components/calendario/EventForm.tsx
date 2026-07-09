"use client";

import { useActionState, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Video, MapPin, Link as LinkIcon, Users as UsersIcon } from "lucide-react";
import { RoteiroToggle } from "./RoteiroToggle";
import { SELECTABLE_SUBS, type SelectableSub } from "@/lib/calendario/schema";
import { cn } from "@/lib/utils";

interface ProfileOption { id: string; nome: string; }
interface ClientOption { id: string; nome: string; }

type ActionResult = { error?: string; blockWarning?: string } | undefined;

interface Props {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    inicio: string | null;
    fim: string | null;
    participantes_ids: string[];
    sub_calendar: SelectableSub;
    client_id: string | null;
    localizacao_endereco: string | null;
    localizacao_maps_url: string | null;
    link_roteiro: string | null;
    roteiro_tipo: "link" | "pdf" | null;
    roteiro_pdf_path: string | null;
    observacoes_gravacao: string | null;
    videomaker_assigned_id: string | null;
  }>;
  profiles: ProfileOption[];
  clientes: ClientOption[];
  videomakers: ProfileOption[];
  canCreateVideomaker: boolean;
  /** Pode delegar/escolher o videomaker direto na criação (audiovisual_chefe, socio, adm). */
  canDelegateVideomaker: boolean;
  /** Escolher o videomaker é obrigatório (só o coordenador audiovisual). */
  videomakerRequired: boolean;
  submitLabel?: string;
}

const SUB_LABELS: Record<SelectableSub, string> = {
  agencia: "Agência (geral)",
  videomakers: "Videomaker (gravação)",
  assessores: "Assessores",
  coordenadores: "Coordenadores",
};

const SUB_DESC: Record<SelectableSub, string> = {
  agencia: "Reunião interna, daily, geral.",
  videomakers: "Gravação. Todos os campos extras são opcionais, preenche o que tiver.",
  assessores: "Reunião de assessoria.",
  coordenadores: "Reunião de coordenação.",
};

export function EventForm({ action, defaults = {}, profiles, clientes, videomakers, canCreateVideomaker, canDelegateVideomaker, videomakerRequired, submitLabel = "Salvar" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [ignorar, setIgnorar] = useState(false);
  const selected = new Set(defaults.participantes_ids ?? []);
  const [sub, setSub] = useState<SelectableSub>(defaults.sub_calendar ?? "agencia");
  const [clientId, setClientId] = useState<string | null>(defaults.client_id ?? null);
  const [videomakerId, setVideomakerId] = useState<string | null>(defaults.videomaker_assigned_id ?? null);
  const isVideomaker = sub === "videomakers";

  const subOptions = SELECTABLE_SUBS.filter((s) => s !== "videomakers" || canCreateVideomaker);

  // "Confirmar mesmo assim": não é submit nativo. Monta o FormData atual e força
  // ignorar_bloqueio=true na hora, sem depender do re-render do state (evita o bug
  // de o submit nativo usar o valor antigo do input escondido).
  function confirmarMesmoAssim() {
    const formEl = formRef.current;
    if (!formEl) return;
    const data = new FormData(formEl);
    data.set("ignorar_bloqueio", "true");
    setIgnorar(true);
    formAction(data);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="ignorar_bloqueio" value={ignorar ? "true" : "false"} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <Label>Tipo de evento</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {subOptions.map((s) => {
            const isVm = s === "videomakers";
            const active = sub === s;
            return (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 text-sm transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  isVm && active && "border-fuchsia-500 bg-fuchsia-500/10",
                  isVm && !active && "border-fuchsia-500/40",
                )}
              >
                <input
                  type="radio"
                  name="sub_calendar"
                  value={s}
                  checked={active}
                  onChange={() => setSub(s)}
                  className="sr-only"
                />
                <span className={cn("flex items-center gap-1.5 font-medium", isVm && "text-fuchsia-600 dark:text-fuchsia-400")}>
                  {isVm && <Video className="h-3.5 w-3.5" />}
                  {SUB_LABELS[s]}
                </span>
                <span className="text-[11px] text-muted-foreground">{SUB_DESC[s]}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={2} placeholder={isVideomaker ? "Ex.: Gravação reels Padaria Doce Vida" : "Ex.: Daily da equipe"} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={3} defaultValue={defaults.descricao ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inicio">Início</Label>
          <Input id="inicio" name="inicio" type="datetime-local" required defaultValue={defaults.inicio ?? ""} onChange={() => setIgnorar(false)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fim">Fim</Label>
          <Input id="fim" name="fim" type="datetime-local" required defaultValue={defaults.fim ?? ""} onChange={() => setIgnorar(false)} />
        </div>
      </div>

      {isVideomaker && (
        <div className="space-y-4 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">
            <Video className="h-4 w-4" />
            Detalhes da gravação
          </div>

          {canDelegateVideomaker && (
            <div className="space-y-2">
              <Label htmlFor="videomaker_assigned_id" className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" /> Videomaker responsável{" "}
                <span className="text-xs text-muted-foreground">
                  ({videomakerRequired ? "obrigatório" : "opcional"})
                </span>
              </Label>
              <input type="hidden" name="videomaker_assigned_id" value={videomakerId ?? ""} />
              <SearchableSelect
                options={videomakers.map((v) => ({ value: v.id, label: v.nome }))}
                value={videomakerId}
                onChange={(v) => {
                  setVideomakerId(v ?? null);
                  // Trocou o videomaker → o bloqueio pode não valer mais; volta a
                  // checar no próximo submit normal ao invés de bypassar silencioso.
                  setIgnorar(false);
                }}
                placeholder="Escolha o videomaker"
                emptyText="Nenhum videomaker ativo"
                clearLabel={videomakerRequired ? undefined : "Deixar pro coordenador delegar"}
              />
              <p className="text-[11px] text-muted-foreground">
                {videomakerRequired
                  ? "Escolha quem vai gravar — a captação já entra agendada direto pra esse videomaker."
                  : "Se escolher, a captação já entra agendada pra esse videomaker. Se deixar em branco, cai na fila do coordenador do audiovisual delegar."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="client_id" className="flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" /> Cliente <span className="text-xs text-muted-foreground">(recomendado)</span>
            </Label>
            <input type="hidden" name="client_id" value={clientId ?? ""} />
            <SearchableSelect
              options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
              value={clientId}
              onChange={(v) => setClientId(v ?? null)}
              placeholder="Sem cliente"
              emptyText="Nenhum cliente encontrado"
              clearLabel="Sem cliente"
            />
            <p className="text-[11px] text-muted-foreground">
              Vinculando o cliente, a captação é interligada ao histórico (Audiovisual, ranking de satisfação, painel mensal).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao_endereco" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Localização (endereço) <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="localizacao_endereco"
              name="localizacao_endereco"
              defaultValue={defaults.localizacao_endereco ?? ""}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="localizacao_maps_url" className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Link do Google Maps <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="localizacao_maps_url"
              name="localizacao_maps_url"
              type="url"
              defaultValue={defaults.localizacao_maps_url ?? ""}
              placeholder="https://maps.google.com/..."
            />
          </div>

          <RoteiroToggle
            eventoId={defaults.id ?? null}
            defaultTipo={defaults.roteiro_tipo ?? null}
            defaultLink={defaults.link_roteiro ?? null}
            defaultPdfPath={defaults.roteiro_pdf_path ?? null}
          />

          <div className="space-y-2">
            <Label htmlFor="observacoes_gravacao">Observações pro coordenador (opcional)</Label>
            <Textarea
              id="observacoes_gravacao"
              name="observacoes_gravacao"
              rows={3}
              defaultValue={defaults.observacoes_gravacao ?? ""}
              placeholder="Ex.: sugiro a Fulana pra essa; chegar 30min antes; contato no local é o João"
            />
            <p className="text-[11px] text-muted-foreground">
              O coordenador do audiovisual lê isso ao escolher quem grava. Use pra sugerir
              um videomaker, ou dar contexto: equipamentos, horário de chegada, contato no local, etc.
            </p>
          </div>
        </div>
      )}

      {/* Em gravação quem grava é definido pelo coordenador na delegação, então
          a lista de participantes não aparece pra quem agenda. */}
      {!isVideomaker && (
        <div className="space-y-2">
          <Label>Participantes <span className="text-xs text-muted-foreground">(opcional)</span></Label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40">
                <input
                  type="checkbox" name="participantes_ids" value={p.id}
                  defaultChecked={selected.has(p.id)}
                />
                {p.nome}
              </label>
            ))}
          </div>
        </div>
      )}

      {state?.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state?.blockWarning && !state?.error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">⚠️ {state.blockWarning}</p>
          <p className="mt-1 text-muted-foreground">
            O videomaker tem um bloqueio aprovado nesse horário. Você pode confirmar assim mesmo.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            disabled={pending}
            onClick={confirmarMesmoAssim}
          >
            Confirmar mesmo assim
          </Button>
        </div>
      )}

      <Button type="submit" disabled={pending}>{pending ? "Salvando..." : submitLabel}</Button>
    </form>
  );
}
