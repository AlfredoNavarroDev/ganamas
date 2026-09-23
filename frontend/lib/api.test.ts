import { describe, it, expect, beforeEach, vi } from "vitest";
import { authFetch } from "./api";
import { setToken } from "./auth";

describe("authFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
  });

  it("sends the stored token as a bearer header", async () => {
    setToken("abc.def.ghi");

    await authFetch("/businesses");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:3001/businesses");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc.def.ghi");
  });

  it("merges caller-provided headers with the bearer header", async () => {
    setToken("abc.def.ghi");

    await authFetch("/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc.def.ghi");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("omits the Authorization header when there is no token", async () => {
    await authFetch("/businesses");

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Headers).has("Authorization")).toBe(false);
  });
});
