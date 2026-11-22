import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { montarAssertion, lerServiceAccount } from "./google-auth";

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
});
