import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { canonicalizeTag, listSavedTags, parseTag } from "./card-tag";

describe("parseTag", () => {
  it("treats undefined, null, empty and whitespace as no tag", () => {
    for (const raw of [undefined, null, "", "   ", "\t\n"]) {
      expect(parseTag(raw)).toEqual({ ok: true, tag: null });
    }
  });

  it("trims surrounding whitespace and keeps internal spacing", () => {
    expect(parseTag("  Lesson  5 ")).toEqual({ ok: true, tag: "Lesson  5" });
  });

  it("rejects non-strings", () => {
    expect(parseTag(5)).toEqual({ ok: false });
    expect(parseTag({})).toEqual({ ok: false });
  });

  it("accepts 40 characters and rejects 41", () => {
    expect(parseTag("a".repeat(40))).toEqual({ ok: true, tag: "a".repeat(40) });
    expect(parseTag("a".repeat(41))).toEqual({ ok: false });
  });

  it("counts code points, not UTF-16 units", () => {
    // "😀" is 2 UTF-16 units but 1 code point: 40 of them is valid.
    expect(parseTag("😀".repeat(40))).toEqual({ ok: true, tag: "😀".repeat(40) });
    expect(parseTag("😀".repeat(41))).toEqual({ ok: false });
  });
});

function rpcClient(result: { data?: string[] | null; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("canonicalizeTag", () => {
  it("returns the existing spelling on a case-insensitive match", async () => {
    const { client, rpc } = rpcClient({ data: ["Lesson 5", "Other"] });
    expect(await canonicalizeTag(client, "lesson 5")).toBe("Lesson 5");
    expect(rpc).toHaveBeenCalledWith("card_tags");
  });

  it("first-used spelling wins when variants exist (RPC order)", async () => {
    const { client } = rpcClient({ data: ["LESSON 5", "Lesson 5"] });
    expect(await canonicalizeTag(client, "lesson 5")).toBe("LESSON 5");
  });

  it("returns the input when nothing matches", async () => {
    const { client } = rpcClient({ data: ["Other"] });
    expect(await canonicalizeTag(client, "New")).toBe("New");
    const empty = rpcClient({ data: null });
    expect(await canonicalizeTag(empty.client, "New")).toBe("New");
  });

  it("propagates an RPC error", async () => {
    const { client } = rpcClient({ error: { message: "boom" } });
    await expect(canonicalizeTag(client, "x")).rejects.toThrow();
  });
});

describe("listSavedTags", () => {
  function savedClient(result: { data?: { tag: string | null }[]; error?: unknown }) {
    const calls: unknown[][] = [];
    const chain = {
      select: (...a: unknown[]) => (calls.push(["select", ...a]), chain),
      eq: (...a: unknown[]) => (calls.push(["eq", ...a]), chain),
      not: (...a: unknown[]) => (calls.push(["not", ...a]), chain),
      order: (...a: unknown[]) => (
        calls.push(["order", ...a]),
        Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
      ),
    };
    return { client: { from: (t: string) => (calls.push(["from", t]), chain) } as unknown as SupabaseClient, calls };
  }

  it("queries saved cards only (never drafts) and dedupes in first-used order", async () => {
    const { client, calls } = savedClient({ data: [{ tag: "B" }, { tag: "A" }, { tag: "B" }] });
    await expect(listSavedTags(client)).resolves.toEqual(["B", "A"]);
    expect(calls).toContainEqual(["eq", "status", "saved"]);
    expect(calls).toContainEqual(["not", "tag", "is", null]);
  });

  it("throws on query error", async () => {
    const { client } = savedClient({ error: { message: "x" } });
    await expect(listSavedTags(client)).rejects.toThrow();
  });
});
