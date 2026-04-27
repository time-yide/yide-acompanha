import { describe, it, expect, vi } from "vitest";

// Stub server-side modules so env validation doesn't run at import time
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));

import { shouldNotify } from "@/lib/notificacoes/trigger";

describe("shouldNotify", () => {
  it("retorna false quando recipiente == origem (idempotência)", () => {
    expect(shouldNotify("user-1", "user-1")).toBe(false);
  });

  it("retorna true quando recipiente != origem", () => {
    expect(shouldNotify("user-1", "user-2")).toBe(true);
  });
});
