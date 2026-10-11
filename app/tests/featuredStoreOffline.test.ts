import { describe, expect, it, vi } from "vitest";

// A database that can't be reached (wrong host, outage) must not take station pages down.
describe("featured listings with the database unreachable", () => {
  it("shows no featured listing instead of failing", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@db.does-not-exist.invalid:6543/postgres";
    delete process.env.FEATURED_STORE_PATH;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { liveFeaturedForStation } = await import("@/lib/featuredStore");

    expect(await liveFeaturedForStation("n123")).toEqual([]);
    expect(logged).toHaveBeenCalled();
  });
});
