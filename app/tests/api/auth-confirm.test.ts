import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/auth/confirm/route";

const confirm = (query: string) => GET(new NextRequest(`https://example.com/auth/confirm${query}`));

describe("GET /auth/confirm", () => {
  it("sends a link without a code back to sign-in", async () => {
    const response = await confirm("?next=%2Ffavorites");
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("link");
    expect(location.searchParams.get("next")).toBe("/favorites");
  });

  it("never redirects to another site", async () => {
    const response = await confirm("?next=%2F%2Fevil.example");
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://example.com");
    expect(location.searchParams.get("next")).toBe("/account");
  });
});
