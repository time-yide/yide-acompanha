import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listClientesComUltimoSnapshotMock = vi.hoisted(() => vi.fn());
const dispatchNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/instagram-snapshots/queries", () => ({
  listClientesComUltimoSnapshot: listClientesComUltimoSnapshotMock,
}));
vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchNotificationMock,
}));

import { GET } from "@/app/api/cron/instagram-meta-alerts/route";

beforeEach(() => {
  // Fixa a data no meio do mês pra o cálculo de "posts esperados até hoje"
  // (proporcional ao dia do mês) ser determinístico. Sem isso, no dia 1º o
  // esperado é ~0 e ninguém fica "crítico" — o teste quebrava todo dia 1.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));
  listClientesComUltimoSnapshotMock.mockReset();
  dispatchNotificationMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://test.local/api/cron/instagram-meta-alerts", { headers });
}

function makeCliente(over: Partial<{
  cliente_id: string;
  cliente_nome: string;
  assessor_id: string | null;
  meta_posts_mes: number | null;
  posts_mes_count: number;
}> = {}) {
  const {
    cliente_id = "c1",
    cliente_nome = "Cliente",
    assessor_id = "a1",
    meta_posts_mes = 20,
    posts_mes_count = 2,
  } = over;
  // Gera N timestamps recentes pra simular posts no mês
  const now = new Date();
  const recent_posts = Array.from({ length: posts_mes_count }, (_, i) => ({
    url: `https://instagram.com/p/${cliente_id}-${i}/`,
    timestamp: new Date(now.getFullYear(), now.getMonth(), 1, 12, i).toISOString(),
    type: "feed" as const,
  }));
  return {
    cliente_id,
    cliente_nome,
    tipo_pacote: "yide_360",
    instagram_url: "https://instagram.com/x",
    assessor_id,
    assessor_nome: "Assessor",
    unit_id: null,
    meta_posts_mes,
    ultimo_snapshot: {
      id: "s",
      client_id: cliente_id,
      organization_id: "o",
      scraped_at: now.toISOString(),
      total_posts: null,
      recent_posts,
      scrape_status: "ok",
      erro: null,
      triggered_by: "cron",
      created_at: now.toISOString(),
    },
  };
}

describe("cron /api/cron/instagram-meta-alerts", () => {
  it("retorna 401 se CRON_SECRET configurado e auth não bate", async () => {
    const original = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "secret-abc";
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("pula clientes sem meta configurada", async () => {
    listClientesComUltimoSnapshotMock.mockResolvedValue([
      makeCliente({ meta_posts_mes: null }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.sem_meta).toBe(1);
    expect(dispatchNotificationMock).not.toHaveBeenCalled();
  });

  it("pula clientes sem assessor", async () => {
    listClientesComUltimoSnapshotMock.mockResolvedValue([
      makeCliente({ assessor_id: null, meta_posts_mes: 20, posts_mes_count: 0 }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.sem_assessor).toBe(1);
    expect(dispatchNotificationMock).not.toHaveBeenCalled();
  });

  it("agrupa críticos do mesmo assessor numa notificação única", async () => {
    listClientesComUltimoSnapshotMock.mockResolvedValue([
      makeCliente({ cliente_id: "c1", cliente_nome: "Alfa", assessor_id: "a1", meta_posts_mes: 20, posts_mes_count: 0 }),
      makeCliente({ cliente_id: "c2", cliente_nome: "Beta", assessor_id: "a1", meta_posts_mes: 20, posts_mes_count: 0 }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.criticos_total).toBe(2);
    expect(body.assessores_notificados).toBe(1);
    expect(dispatchNotificationMock).toHaveBeenCalledTimes(1);
    const call = dispatchNotificationMock.mock.calls[0][0];
    expect(call.user_ids_extras).toEqual(["a1"]);
    expect(call.mensagem).toContain("Alfa");
    expect(call.mensagem).toContain("Beta");
  });

  it("não notifica quando todos estão no ritmo (status=ok)", async () => {
    // Pra "ok", precisa fazer posts proporcional ao dia/mês. Como o teste
    // roda com data real, usa meta=1 + 1 post = >= 100% da meta.
    listClientesComUltimoSnapshotMock.mockResolvedValue([
      makeCliente({ assessor_id: "a1", meta_posts_mes: 1, posts_mes_count: 5 }),
    ]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.criticos_total).toBe(0);
    expect(dispatchNotificationMock).not.toHaveBeenCalled();
  });
});
