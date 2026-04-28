import { describe, it, expect, vi } from "vitest";

// Mock supabase/server and env-touching modules so importing the actions module
// doesn't try to read NEXT_PUBLIC_* env vars at import time.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));

import { changePasswordSchema } from "@/lib/auth/actions";

describe("changePasswordSchema", () => {
  it("rejeita quando newPassword não bate com confirmPassword", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "novaSenha123",
      confirmPassword: "outraSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "confirmPassword")?.message;
      expect(msg).toBe("Confirmação não bate com a nova senha");
    }
  });

  it("rejeita quando newPassword é igual à currentPassword", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "mesmaSenha123",
      newPassword: "mesmaSenha123",
      confirmPassword: "mesmaSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "newPassword")?.message;
      expect(msg).toBe("Nova senha precisa ser diferente da atual");
    }
  });

  it("rejeita newPassword com menos de 8 caracteres", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "curta",
      confirmPassword: "curta",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "newPassword")?.message;
      expect(msg).toBe("Nova senha precisa ter ao menos 8 caracteres");
    }
  });

  it("rejeita currentPassword vazia", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "novaSenha123",
      confirmPassword: "novaSenha123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === "currentPassword")?.message;
      expect(msg).toBe("Senha atual obrigatória");
    }
  });

  it("aceita um caso válido", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "senhaAtual123",
      newPassword: "novaSenha123",
      confirmPassword: "novaSenha123",
    });
    expect(r.success).toBe(true);
  });
});
