import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_PACOTE, tipoPacoteBadge } from "@/lib/painel/pacote-matrix";
import { CADENCIAS_REUNIAO } from "@/lib/clientes/schema";

interface ProfileOption {
  id: string;
  nome: string;
  role: string;
}

interface Props {
  action: (formData: FormData) => any;
  defaults?: Partial<{
    id: string;
    nome: string;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    valor_mensal: number | string;
    servico_contratado: string | null;
    data_entrada: string | null;
    assessor_id: string | null;
    coordenador_id: string | null;
    data_aniversario_socio_cliente: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
    instagram_url: string | null;
    gmn_url: string | null;
    drive_url: string | null;
    pacote_post_padrao: number | null;
    tipo_pacote: string | null;
    cadencia_reuniao: string | null;
    numero_unidades: number | null;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    tipo_pacote_revisado: boolean;
  }>;
  assessores: ProfileOption[];
  coordenadores: ProfileOption[];
  designers: Array<{ id: string; nome: string }>;
  videomakers: Array<{ id: string; nome: string }>;
  editors: Array<{ id: string; nome: string }>;
  canEditAlocacao: boolean;
  submitLabel?: string;
}

export function ClienteForm({ action, defaults = {}, assessores, coordenadores, designers, videomakers, editors, canEditAlocacao, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome do cliente</Label>
          <Input id="nome" name="nome" defaultValue={defaults.nome ?? ""} required minLength={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contato_principal">Contato principal</Label>
          <Input id="contato_principal" name="contato_principal" defaultValue={defaults.contato_principal ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={defaults.telefone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor_mensal">Valor mensal (R$)</Label>
          <Input id="valor_mensal" name="valor_mensal" type="number" step="0.01" min="0" defaultValue={String(defaults.valor_mensal ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="servico_contratado">Serviço contratado</Label>
          <Input id="servico_contratado" name="servico_contratado" defaultValue={defaults.servico_contratado ?? ""} placeholder="Ex.: Social media + Tráfego pago" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_entrada">Data de entrada</Label>
          <Input id="data_entrada" name="data_entrada" type="date" defaultValue={defaults.data_entrada ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_aniversario_socio_cliente">Aniversário do sócio do cliente</Label>
          <Input id="data_aniversario_socio_cliente" name="data_aniversario_socio_cliente" type="date" defaultValue={defaults.data_aniversario_socio_cliente ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assessor_id">Assessor</Label>
          <Select name="assessor_id" defaultValue={defaults.assessor_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem assessor</SelectItem>
              {assessores.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coordenador_id">Coordenador</Label>
          <Select name="coordenador_id" defaultValue={defaults.coordenador_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem coordenador</SelectItem>
              {coordenadores.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
        <h4 className="text-sm font-semibold">Equipe e links (Painel mensal)</h4>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Designer responsável</label>
            <select
              name="designer_id"
              defaultValue={defaults.designer_id ?? ""}
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">— Sem designer —</option>
              {designers.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Videomaker responsável</label>
            <select
              name="videomaker_id"
              defaultValue={defaults.videomaker_id ?? ""}
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">— Sem videomaker —</option>
              {videomakers.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Editor responsável</label>
            <select
              name="editor_id"
              defaultValue={defaults.editor_id ?? ""}
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">— Sem editor —</option>
              {editors.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Instagram URL</label>
            <input
              type="url"
              name="instagram_url"
              defaultValue={defaults.instagram_url ?? ""}
              placeholder="https://instagram.com/cliente"
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Google Meu Negócio</label>
            <input
              type="url"
              name="gmn_url"
              defaultValue={defaults.gmn_url ?? ""}
              placeholder="https://g.page/cliente"
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Drive (pasta principal)</label>
            <input
              type="url"
              name="drive_url"
              defaultValue={defaults.drive_url ?? ""}
              placeholder="https://drive.google.com/..."
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Pacote padrão de posts/mês</label>
            <input
              type="number"
              name="pacote_post_padrao"
              defaultValue={defaults.pacote_post_padrao ?? ""}
              min={0}
              placeholder="12"
              className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
        <h4 className="text-sm font-semibold">Pacote e operação</h4>

        {/* Always send tipo_pacote_revisado=true when this form is submitted */}
        <input type="hidden" name="tipo_pacote_revisado" value="true" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo de pacote</label>
            <Select name="tipo_pacote" defaultValue={defaults.tipo_pacote ?? ""}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="— Selecione —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Inferir automaticamente —</SelectItem>
                {TIPOS_PACOTE.map((p) => (
                  <SelectItem key={p} value={p}>{tipoPacoteBadge(p).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cadência de reunião</label>
            <Select name="cadencia_reuniao" defaultValue={defaults.cadencia_reuniao ?? ""}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="— Selecione —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Não definido —</SelectItem>
                {CADENCIAS_REUNIAO.map((c) => (
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nº de unidades</label>
            <input
              type="number"
              name="numero_unidades"
              defaultValue={defaults.numero_unidades ?? 1}
              min={1}
              step={1}
              className="mt-0.5 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Valor tráfego Google (R$)</label>
            <input
              type="number"
              name="valor_trafego_google"
              defaultValue={defaults.valor_trafego_google ?? ""}
              min={0}
              step={0.01}
              placeholder="0,00"
              className="mt-0.5 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Valor tráfego Meta (R$)</label>
            <input
              type="number"
              name="valor_trafego_meta"
              defaultValue={defaults.valor_trafego_meta ?? ""}
              min={0}
              step={0.01}
              placeholder="0,00"
              className="mt-0.5 block w-full h-9 rounded-md border bg-card px-2 text-sm"
            />
          </div>
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
