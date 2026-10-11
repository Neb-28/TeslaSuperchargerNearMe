import { describe, expect, it } from "vitest";
import { loginHref, safeNext } from "@/lib/authRedirect";
import { planFavoritesSync, type FavoriteStation } from "@/lib/favorites";
import { hasAuthCookie } from "@/lib/supabase/env";

const station = (id: string): FavoriteStation => ({ id, name: `Station ${id}`, address: "", href: `/supercharger/va/city/${id}` });
const ids = (list: FavoriteStation[]) => list.map((item) => item.id);

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/favorites")).toBe("/favorites");
    expect(safeNext("/business/dashboard?x=1")).toBe("/business/dashboard?x=1");
  });

  it("falls back for other sites and junk", () => {
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
    expect(safeNext(["/favorites"])).toBe("/account");
  });

  it("builds a login link that comes back", () => {
    expect(loginHref("/business/dashboard")).toBe("/login?next=%2Fbusiness%2Fdashboard");
  });
});

describe("hasAuthCookie", () => {
  it("spots Supabase session cookies, whole or split", () => {
    expect(hasAuthCookie("sb-abcd-auth-token=base64-xyz")).toBe(true);
    expect(hasAuthCookie("theme=dark; sb-abcd-auth-token.0=part")).toBe(true);
  });

  it("ignores other cookies", () => {
    expect(hasAuthCookie("")).toBe(false);
    expect(hasAuthCookie("admin_session=1; sb-abcd-auth-token-code-verifier=x")).toBe(false);
  });
});

describe("planFavoritesSync", () => {
  it("first sync on a device keeps everything from both sides", () => {
    const plan = planFavoritesSync([station("a"), station("b")], [station("b"), station("c")], new Set());
    expect(ids(plan.merged)).toEqual(["a", "b", "c"]);
    expect(ids(plan.upload)).toEqual(["a"]);
    expect(plan.remove).toEqual([]);
  });

  it("uploads stations saved here since the last sync", () => {
    const plan = planFavoritesSync([station("a"), station("d")], [station("a")], new Set(["a"]));
    expect(ids(plan.merged)).toEqual(["a", "d"]);
    expect(ids(plan.upload)).toEqual(["d"]);
  });

  it("removes from the account what was removed here", () => {
    const plan = planFavoritesSync([station("a")], [station("a"), station("b")], new Set(["a", "b"]));
    expect(ids(plan.merged)).toEqual(["a"]);
    expect(plan.remove).toEqual(["b"]);
    expect(plan.upload).toEqual([]);
  });

  it("removes here what was removed on another device", () => {
    const plan = planFavoritesSync([station("a"), station("b")], [station("a")], new Set(["a", "b"]));
    expect(ids(plan.merged)).toEqual(["a"]);
    expect(plan.upload).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("adds here what was saved on another device", () => {
    const plan = planFavoritesSync([station("a")], [station("a"), station("e")], new Set(["a"]));
    expect(ids(plan.merged)).toEqual(["a", "e"]);
  });

  it("does nothing when already in sync", () => {
    const plan = planFavoritesSync([station("a"), station("b")], [station("a"), station("b")], new Set(["a", "b"]));
    expect(ids(plan.merged)).toEqual(["a", "b"]);
    expect(plan.upload).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
});
