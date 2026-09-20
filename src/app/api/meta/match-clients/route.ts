import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listAvailableAccounts } from "@/lib/social-media/meta-publish";

const ALLOWED_ROLES = ["adm", "socio"];

export async function GET() {
  const actor = await requireAuth();
  if (!ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const [metaResult, clientsResult] = await Promise.all([
    listAvailableAccounts(),
    fetchActiveClients(),
  ]);

  if (metaResult.error) {
    return NextResponse.json({ error: metaResult.error }, { status: 500 });
  }

  const accounts = metaResult.accounts ?? [];
  const clients = clientsResult;

  const matches = matchAccountsToClients(accounts, clients);

  return new NextResponse(renderPage(matches, accounts.length, clients.length), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const actor = await requireAuth();
  if (!ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json() as {
    updates: { clientId: string; pageId: string; igId: string | null }[];
  };

  const sb = createServiceRoleClient();
  let success = 0;
  let fail = 0;

  for (const u of body.updates) {
    const { error } = await sb
      .from("clients")
      .update({
        facebook_page_id: u.pageId,
        instagram_business_id: u.igId,
      })
      .eq("id", u.clientId);

    if (error) {
      fail++;
      console.error("Meta match update error:", u.clientId, error.message);
    } else {
      success++;
    }
  }

  return NextResponse.json({ success, fail });
}

interface Client {
  id: string;
  nome: string;
  instagram_url: string | null;
  facebook_page_id: string | null;
  instagram_business_id: string | null;
}

async function fetchActiveClients(): Promise<Client[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("clients")
    .select("id, nome, instagram_url, facebook_page_id, instagram_business_id")
    .eq("status", "ativo")
    .order("nome");
  return data ?? [];
}

interface MetaAccount {
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
}

interface Match {
  clientId: string;
  clientNome: string;
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
  method: string;
  alreadyConnected: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractHandle(url: string | null): string {
  if (!url) return "";
  return url.replace(/\/$/, "").split("/").pop()?.split("?")[0]?.replace(/^@/, "").toLowerCase() ?? "";
}

function matchAccountsToClients(accounts: MetaAccount[], clients: Client[]): {
  matched: Match[];
  unmatched: Client[];
} {
  const matched: Match[] = [];
  const usedClients = new Set<string>();

  for (const client of clients) {
    const handle = extractHandle(client.instagram_url);
    let bestMatch: MetaAccount | null = null;
    let method = "";

    // 1) Exact IG username match
    if (handle) {
      const found = accounts.find(
        (a) => a.igUsername?.toLowerCase() === handle,
      );
      if (found) {
        bestMatch = found;
        method = "Instagram handle";
      }
    }

    // 2) Page name contains client name (or vice versa)
    if (!bestMatch) {
      const normClient = normalize(client.nome);
      if (normClient.length >= 4) {
        const found = accounts.find((a) => {
          const normPage = normalize(a.pageName);
          return normPage.includes(normClient) || normClient.includes(normPage);
        });
        if (found) {
          bestMatch = found;
          method = "Nome";
        }
      }
    }

    // 3) IG username contains client handle fragment
    if (!bestMatch && handle && handle.length >= 4) {
      const found = accounts.find(
        (a) =>
          a.igUsername &&
          (a.igUsername.toLowerCase().includes(handle) ||
            handle.includes(a.igUsername.toLowerCase())),
      );
      if (found) {
        bestMatch = found;
        method = "Handle parcial";
      }
    }

    if (bestMatch) {
      const alreadyConnected =
        client.facebook_page_id === bestMatch.pageId &&
        (!bestMatch.igId || client.instagram_business_id === bestMatch.igId);

      matched.push({
        clientId: client.id,
        clientNome: client.nome,
        pageId: bestMatch.pageId,
        pageName: bestMatch.pageName,
        igId: bestMatch.igId,
        igUsername: bestMatch.igUsername,
        method,
        alreadyConnected,
      });
      usedClients.add(client.id);
    }
  }

  const unmatched = clients.filter((c) => !usedClients.has(c.id));
  return { matched, unmatched };
}

function renderPage(
  result: { matched: Match[]; unmatched: Client[] },
  totalAccounts: number,
  totalClients: number,
): string {
  const { matched, unmatched } = result;
  const newMatches = matched.filter((m) => !m.alreadyConnected);
  const already = matched.filter((m) => m.alreadyConnected);

  const matchRows = newMatches
    .map(
      (m, i) => `
    <tr>
      <td><input type="checkbox" checked data-idx="${i}"></td>
      <td><strong>${esc(m.clientNome)}</strong></td>
      <td>${esc(m.pageName)}</td>
      <td>${m.igUsername ? "@" + esc(m.igUsername) : "-"}</td>
      <td><span class="tag ${m.method === "Instagram handle" ? "auto" : "manual"}">${esc(m.method)}</span></td>
    </tr>`,
    )
    .join("");

  const alreadyRows = already
    .map(
      (m) => `
    <tr class="dim">
      <td>✅</td>
      <td>${esc(m.clientNome)}</td>
      <td>${esc(m.pageName)}</td>
      <td>${m.igUsername ? "@" + esc(m.igUsername) : "-"}</td>
      <td>Já conectado</td>
    </tr>`,
    )
    .join("");

  const unmatchedRows = unmatched
    .filter((c) => !c.nome.toLowerCase().startsWith("ecommerce"))
    .map((c) => `<tr><td colspan="5">${esc(c.nome)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Meta</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; padding: 1rem; max-width: 900px; margin: 0 auto; background: #fafaf9; color: #1a1916; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .sub { color: #6b6860; font-size: .875rem; margin-bottom: 1rem; }
  .stats { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .stat { background: #fff; border: 1px solid #e5e2dd; border-radius: 8px; padding: .5rem .75rem; font-size: .8rem; flex: 1; min-width: 100px; text-align: center; }
  .stat strong { display: block; font-size: 1.3rem; }
  .green strong { color: #1da851; }
  .blue strong { color: #1877f2; }
  table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin-bottom: 1rem; }
  th { text-align: left; padding: .5rem; border-bottom: 2px solid #e5e2dd; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #6b6860; }
  td { padding: .5rem; border-bottom: 1px solid #eee; }
  tr:hover { background: #f5f3f0; }
  tr.dim { opacity: .5; }
  input[type=checkbox] { width: 16px; height: 16px; accent-color: #1877f2; }
  .tag { font-size: .625rem; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
  .tag.auto { background: #dbeafe; color: #1d4ed8; }
  .tag.manual { background: #fef3c7; color: #92400e; }
  .section { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6b6860; margin: 1.5rem 0 .5rem; padding-bottom: .25rem; border-bottom: 1px solid #e5e2dd; }
  .btn { display: block; width: 100%; padding: .75rem; background: #1877f2; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1rem; }
  .btn:hover { background: #1565d8; }
  .btn:disabled { background: #ccc; cursor: not-allowed; }
  .result { padding: 1rem; background: #e8faf0; border-radius: 8px; margin-top: 1rem; font-weight: 600; }
  .result.error { background: #fef2f2; color: #dc3545; }
  @media (max-width: 600px) { table { font-size: .75rem; } td, th { padding: .375rem .25rem; } }
</style>
</head><body>
<h1>Conectar Meta</h1>
<p class="sub">${totalAccounts} páginas no Meta × ${totalClients} clientes ativos</p>
<div class="stats">
  <div class="stat green"><strong>${newMatches.length}</strong>Novos matches</div>
  <div class="stat blue"><strong>${already.length}</strong>Já conectados</div>
  <div class="stat"><strong>${unmatched.length}</strong>Sem match</div>
</div>

${newMatches.length > 0 ? `
<div class="section">Novos matches (confirme e salve)</div>
<div style="overflow-x:auto">
<table id="matchTable">
  <thead><tr><th></th><th>Cliente</th><th>Página FB</th><th>Instagram</th><th>Como</th></tr></thead>
  <tbody>${matchRows}</tbody>
</table>
</div>
<button class="btn" id="saveBtn" onclick="save()">Salvar ${newMatches.length} matches selecionados</button>
<div id="result" hidden></div>
` : "<p>Nenhum match novo encontrado!</p>"}

${already.length > 0 ? `
<div class="section">Já conectados</div>
<div style="overflow-x:auto">
<table>
  <thead><tr><th></th><th>Cliente</th><th>Página FB</th><th>Instagram</th><th>Status</th></tr></thead>
  <tbody>${alreadyRows}</tbody>
</table>
</div>` : ""}

${unmatchedRows ? `
<div class="section">Sem match</div>
<div style="overflow-x:auto">
<table><tbody>${unmatchedRows}</tbody></table>
</div>` : ""}

<script>
const NEW_MATCHES = ${JSON.stringify(newMatches.map((m) => ({ clientId: m.clientId, pageId: m.pageId, igId: m.igId })))};

async function save() {
  const checks = document.querySelectorAll('#matchTable input[type=checkbox]');
  const updates = [];
  checks.forEach((c, i) => { if (c.checked) updates.push(NEW_MATCHES[i]); });
  if (!updates.length) { alert('Nenhum selecionado'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const res = await fetch('/api/meta/match-clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    const el = document.getElementById('result');
    el.hidden = false;
    if (data.success > 0) {
      el.className = 'result';
      el.textContent = data.success + ' clientes atualizados!' + (data.fail ? ' (' + data.fail + ' erros)' : '');
    } else {
      el.className = 'result error';
      el.textContent = 'Erro ao salvar';
    }
    btn.textContent = 'Salvo!';
  } catch (e) {
    const el = document.getElementById('result');
    el.hidden = false;
    el.className = 'result error';
    el.textContent = 'Erro: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Tentar novamente';
  }
}
</script>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
