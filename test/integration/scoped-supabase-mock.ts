import { afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Makes `createClient` from @/lib/supabase return a chosen test user's REAL
// scoped client, so a directly-driven route runs against real RLS as that user.
// This reuses the test-plan §6.2 sanctioned factory-mock exception — but, unlike
// the hermetic suite, the returned client is a real supabase-js client (not a
// recording fake).
//
// Usage (in an *.integration.test.ts): statically import this module so the
// vi.mock registration runs, then call `setActingUser(user.scopedClient())`
// before invoking the route under test. The handle resets after each test.
//
// vi.hoisted is required: vi.mock is hoisted above imports, and its factory may
// only close over hoisted values — so the mutable holder must be hoisted too.
const holder = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => holder.client),
}));

/** Point the mocked factory at a specific user's real scoped client. */
export function setActingUser(client: SupabaseClient): void {
  holder.client = client;
}

afterEach(() => {
  holder.client = null;
});
