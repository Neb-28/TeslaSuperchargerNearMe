import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/suggest/route";
import { correction, exactPlace, fold, suggest } from "@/lib/suggest";

const labels = (text: string, country: string | null = null) => suggest(text, country).map((item) => item.label);

describe("search suggestions", () => {
  it("suggest places that start with what was typed", () => {
    expect(labels("woodbridge")[0]).toBe("Woodbridge, VA");
    expect(labels("dale cit")[0]).toBe("Dale City, VA");
    expect(labels("virgin")[0]).toBe("Virginia");
  });

  it("forgive typos, also across words", () => {
    expect(labels("woodbrige")[0]).toBe("Woodbridge, VA");
    expect(labels("pflugervile")[0]).toBe("Pflugerville, TX");
    expect(labels("san fransisco")[0]).toBe("San Francisco, CA");
    expect(labels("califronia")[0]).toBe("California");
  });

  it("know English names and nicknames", () => {
    expect(labels("munich")[0]).toBe("München, Germany");
    expect(labels("nyc")[0]).toBe("New York, NY");
  });

  it("find stations by street, at most two at a time", () => {
    expect(labels("minnieville")[0]).toBe("Woodbridge, VA – 13355 Minnieville Rd");
    expect(suggest("woodbridge va").filter((item) => item.kind === "station").length).toBeLessThanOrEqual(2);
  });

  it("let famous places abroad outrank small ones at home", () => {
    expect(labels("toronto")[0]).toBe("Toronto, ON");
    expect(labels("germ")[0]).toBe("Germany");
  });

  it("give each place a position and each station a slug", () => {
    for (const item of suggest("wood")) expect(item.position ?? item.slug).toBeTruthy();
    expect(suggest("minnieville")[0].slug).toBeTruthy();
  });

  it("stay quiet for one letter or nothing", () => {
    expect(suggest("w")).toEqual([]);
    expect(suggest("   ")).toEqual([]);
  });
});

describe("place lookups without the geocoder", () => {
  it("find a place by its exact label, in the right country", () => {
    expect(exactPlace("Dale City, VA", null)?.label).toBe("Dale City, VA");
    expect(exactPlace("Toronto, ON", "canada")?.label).toBe("Toronto, ON");
    expect(exactPlace("Toronto, ON", null)).toBeNull();
  });

  it("correct a misspelled place name, but not an address or a real name", () => {
    expect(correction("woodbrige", null)?.label).toBe("Woodbridge, VA");
    expect(correction("123 Main St", null)).toBeNull();
    expect(correction("Woodbridge", null)).toBeNull();
  });

  it("fold accents, case and punctuation", () => {
    expect(fold("Montréal, QC")).toBe("montreal qc");
  });
});

describe("GET /api/suggest", () => {
  const call = (query: string, country?: string) => {
    const url = new URL("http://localhost/api/suggest");
    url.searchParams.set("q", query);
    if (country) url.searchParams.set("country", country);
    return GET(new Request(url));
  };

  it("returns suggestions, cacheable", async () => {
    const response = await call("woodbrige");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
    const { suggestions } = await response.json();
    expect(suggestions[0]).toMatchObject({ kind: "city", label: "Woodbridge, VA", country: null });
  });

  it("puts the map's country first and ignores unknown countries", async () => {
    const { suggestions } = await (await call("london", "united-kingdom")).json();
    expect(suggestions[0].label).toBe("London, United Kingdom");
    expect((await call("wood", "atlantis")).status).toBe(200);
  });

  it("rejects overlong text", async () => {
    expect((await call("x".repeat(81))).status).toBe(400);
  });
});
