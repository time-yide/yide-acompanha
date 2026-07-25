"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  KeyRound, Plus, Eye, EyeOff, Pencil, Trash2, Loader2, Copy, X, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adicionarCredencialPortalAction,
  editarCredencialPortalAction,
  apagarCredencialPortalAction,
  revelarSenhaPortalAction,
} from "@/lib/credenciais/portal-actions";
import type { PortalCredential } from "@/lib/credenciais/queries";

type FormState = { id?: string; service_name: string; username: string; password: string; notes: string };
const EMPTY: FormState = { service_name: "", username: "", password: "", notes: "" };

export function CredenciaisPortalSection({
  credenciais,
  previewMode = false,
}: {
  credenciais: PortalCredential[];
  previewMode?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState | null>(null); // null = formulário fechado
  const [revelada, setRevelada] = useState<Record<string, string>>({});

  function salvar() {
    if (!form) return;
    if (!form.service_name.trim()) { toast.error("Informe o serviço."); return; }
    if (!form.id && !form.password.trim()) { toast.error("Informe a senha."); return; }
    const fd = new FormData();
    if (form.id) fd.set("id", form.id);
    fd.set("service_name", form.service_name.trim());
    fd.set("username", form.username.trim());
    if (form.password.trim()) fd.set("password", form.password.trim());
    fd.set("notes", form.notes.trim());
    start(async () => {
      const r = form.id
        ? await editarCredencialPortalAction(undefined, fd)
        : await adicionarCredencialPortalAction(undefined, fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(form.id ? "Acesso atualizado" : "Acesso salvo");
      setForm(null);
      router.refresh();
    });
  }

  function apagar(id: string, nome: string) {
    if (!window.confirm(`Apagar o acesso "${nome}"?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const r = await apagarCredencialPortalAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Acesso apagado");
      setRevelada((m) => { const c = { ...m }; delete c[id]; return c; });
      router.refresh();
    });
  }

  function revelar(id: string) {
    if (revelada[id] !== undefined) {
      setRevelada((m) => { const c = { ...m }; delete c[id]; return c; });
      return;
    }
    start(async () => {
      const r = await revelarSenhaPortalAction(id);
      if ("error" in r) { toast.error(r.error); return; }
      setRevelada((m) => ({ ...m, [id]: r.password }));
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Acessos e senhas</h2>
            <p className="text-xs text-muted-foreground">Guarde aqui os logins que a Yide precisa. Ficam criptografados.</p>
          </div>
        </div>
        {!previewMode && form === null && (
          <Button type="button" size="sm" onClick={() => setForm({ ...EMPTY })} disabled={pending}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar acesso
          </Button>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {previewMode && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            No modo preview os acessos não aparecem nem podem ser editados — só o cliente logado gerencia.
          </p>
        )}

        {!previewMode && form && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{form.id ? "Editar acesso" : "Novo acesso"}</p>
              <button type="button" onClick={() => setForm(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Campo label="Serviço *" value={form.service_name} onChange={(v) => setForm({ ...form, service_name: v })} placeholder="Instagram, Google Ads…" />
            <Campo label="Usuário / e-mail" value={form.username} onChange={(v) => setForm({ ...form, username: v })} placeholder="opcional" />
            <Campo label={form.id ? "Senha (deixe em branco pra manter)" : "Senha *"} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={form.id ? "••••••••" : ""} />
            <Campo label="Observação" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="opcional" />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="button" size="sm" onClick={salvar} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        )}

        {previewMode ? null : credenciais.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Nenhum acesso guardado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {credenciais.map((c) => (
              <li key={c.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.service_name}</p>
                    {c.username && <p className="truncate text-xs text-muted-foreground">{c.username}</p>}
                    {c.notes && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn title={revelada[c.id] !== undefined ? "Esconder senha" : "Ver senha"} onClick={() => revelar(c.id)} disabled={pending}>
                      {revelada[c.id] !== undefined ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconBtn>
                    <IconBtn title="Editar" onClick={() => setForm({ id: c.id, service_name: c.service_name, username: c.username ?? "", password: "", notes: c.notes ?? "" })} disabled={pending}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Apagar" danger onClick={() => apagar(c.id, c.service_name)} disabled={pending}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
                {revelada[c.id] !== undefined && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <code className="min-w-0 break-all text-xs">{revelada[c.id]}</code>
                    <button
                      type="button"
                      title="Copiar senha"
                      onClick={() => { navigator.clipboard.writeText(revelada[c.id]).then(() => toast.success("Senha copiada")).catch(() => {}); }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!previewMode && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Guardadas com criptografia. Só você e a equipe da Yide têm acesso.
          </p>
        )}
      </div>
    </section>
  );
}

function Campo({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function IconBtn({
  children, title, onClick, disabled, danger,
}: { children: ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 text-muted-foreground disabled:opacity-50 ${danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
