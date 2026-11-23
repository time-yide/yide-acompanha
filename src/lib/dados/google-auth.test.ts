import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { getGoogleToken, montarAssertion, lerServiceAccount, SCOPES_ADMIN, SCOPES_DADOS } from "./google-auth";

describe("dados/google-auth", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("lê a env JSON", () => {
    expect(lerServiceAccount(undefined)).toBeNull();
    expect(lerServiceAccount("{}")).toBeNull();
    expect(lerServiceAccount(JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: pem })))
      .toEqual({ clientEmail: "a@b.iam.gserviceaccount.com", privateKey: pem });
  });

  it("assina RS256 com escopo e audiência certos", () => {
    const jwt = montarAssertion({ clientEmail: "a@b", privateKey: pem }, ["s1", "s2"], 1_700_000_000);
    const [h, p, s] = jwt.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toEqual({ iss: "a@b", scope: "s1 s2", aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  describe("cache por escopo", () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

    it("escopos diferentes = tokens diferentes; mesmo escopo usa cache e 1 troca por vez", async () => {
      vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: pem }));
      let n = 0;
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: `tok${++n}`, expires_in: 3600 }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const [a1, a2] = await Promise.all([getGoogleToken(["teste/ler"]), getGoogleToken(["teste/ler"])]);
      expect(a1).toBe("tok1");
      expect(a2).toBe("tok1");
      expect(await getGoogleToken(["teste/escrever"])).toBe("tok2");
      expect(await getGoogleToken(["teste/ler"])).toBe("tok1");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("escopos de leitura e de admin não se misturam", () => {
      expect(SCOPES_DADOS.join(" ")).not.toBe(SCOPES_ADMIN.join(" "));
      expect(SCOPES_ADMIN).toContain("https://www.googleapis.com/auth/analytics.edit");
    });
  });
});
