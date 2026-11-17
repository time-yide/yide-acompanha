import { describe, it, expect } from "vitest";
import { montarAvisoIndexNow, INDEXNOW_ARQUIVO } from "@/lib/blog/indexnow";

describe("montarAvisoIndexNow", () => {
  it("monta host, local da chave e URLs dos posts", () => {
    const r = montarAvisoIndexNow(["post-a"], "https://blog.exemplo.com.br");
    expect(r.host).toBe("blog.exemplo.com.br");
    expect(r.keyLocation).toBe(`https://blog.exemplo.com.br${INDEXNOW_ARQUIVO}`);
    expect(r.urlList).toEqual(["https://blog.exemplo.com.br/blog/post-a"]);
    expect(INDEXNOW_ARQUIVO).toBe(`/${r.key}.txt`);
  });
});
