import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTwoUsers, type TwoUserFixture } from "./two-user-fixture";

// Phase-1 smoke test: prove the two-user real-DB harness is wired correctly
// before any per-endpoint isolation test (Phase 2) builds on it.
//
// Behavior proven: user B genuinely CANNOT read user A's seeded row through a
// real RLS-scoped client, and user A CAN read their own. If this fails, the
// harness (admin user creation, sign-in token, client wiring, or RLS itself) is
// broken — fix it before writing isolation tests on top.

describe("two-user integration harness (real RLS)", () => {
  let fx: TwoUserFixture;

  beforeAll(async () => {
    fx = await setupTwoUsers();
  });

  afterAll(async () => {
    await fx.teardown();
  });

  it("denies B reading A's seeded card (cross-user isolation)", async () => {
    const { data, error } = await fx.b.scopedClient().from("cards").select("id").eq("id", fx.a.seededCardId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("allows A reading A's own seeded card (positive control)", async () => {
    const { data, error } = await fx.a.scopedClient().from("cards").select("id").eq("id", fx.a.seededCardId);
    expect(error).toBeNull();
    const rows = (data ?? []) as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(fx.a.seededCardId);
  });
});
