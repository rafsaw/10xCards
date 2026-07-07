import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CHANGE_ID_PATTERN, PlanAccessError, readPlan, resolvePlanPath } from "./readPlan.js";

/**
 * Pure guardrail suite for `resolvePlanPath` / `readPlan`. No API calls, no
 * network — only path validation and local file reads under a temp fixture.
 */

/** Change ids that must be rejected before any path is built. */
const INVALID_IDS = [
  "../../.env",
  "../secrets",
  "/etc/passwd",
  "C:\\Windows\\System32",
  "foo/bar",
  "..",
  ".env",
  "",
  "Foo",
  "foo bar",
  "foo_bar",
  "-leading",
  "trailing-",
];

describe("CHANGE_ID_PATTERN", () => {
  it("accepts kebab-case ids and rejects everything else", () => {
    expect(CHANGE_ID_PATTERN.test("m5l3-agent-read-plan-tool")).toBe(true);
    expect(CHANGE_ID_PATTERN.test("a")).toBe(true);
    expect(CHANGE_ID_PATTERN.test("a1-b2-c3")).toBe(true);
    for (const id of INVALID_IDS) {
      expect(CHANGE_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe("resolvePlanPath", () => {
  const contextRoot = "/repo/context";

  it("resolves a valid kebab id to the expected repo-relative plan path", () => {
    const { relativePath } = resolvePlanPath({ changeId: "m5l3-agent-read-plan-tool", contextRoot });
    expect(relativePath).toBe("context/changes/m5l3-agent-read-plan-tool/plan.md");
  });

  it("throws PlanAccessError for every invalid id (traversal, absolute, dotfile, casing, spaces)", () => {
    for (const id of INVALID_IDS) {
      expect(() => resolvePlanPath({ changeId: id, contextRoot }), id).toThrow(PlanAccessError);
    }
  });

  it("never leaks an absolute path in the thrown error message", () => {
    for (const id of INVALID_IDS) {
      try {
        resolvePlanPath({ changeId: id, contextRoot });
        expect.unreachable(`expected ${id} to be rejected`);
      } catch (error) {
        expect(error).toBeInstanceOf(PlanAccessError);
        expect((error as Error).message).not.toContain(contextRoot);
      }
    }
  });
});

describe("readPlan (temp fixture)", () => {
  let contextRoot: string;
  let tmpRoot: string;
  let symlinkSupported = false;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(join(tmpdir(), "readplan-"));
    contextRoot = join(tmpRoot, "context");

    // A real, in-root plan for the happy path.
    const validDir = join(contextRoot, "changes", "valid-change");
    await fs.mkdir(validDir, { recursive: true });
    await fs.writeFile(join(validDir, "plan.md"), "# The Plan\n\nContents.\n", "utf8");

    // A secret file OUTSIDE the allowed root, plus a symlinked plan.md pointing at
    // it — the F4 realpath re-check must reject this.
    await fs.writeFile(join(tmpRoot, "secret.txt"), "TOP SECRET", "utf8");
    const evilDir = join(contextRoot, "changes", "evil-change");
    await fs.mkdir(evilDir, { recursive: true });
    try {
      await fs.symlink(join(tmpRoot, "secret.txt"), join(evilDir, "plan.md"), "file");
      symlinkSupported = true;
    } catch {
      // Windows without Developer Mode / elevation can't create symlinks — skip F4.
      symlinkSupported = false;
    }
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("reads an in-root plan and returns repo-relative path + content", async () => {
    const result = await readPlan({ changeId: "valid-change", contextRoot });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.path).toBe("context/changes/valid-change/plan.md");
      expect(result.content).toContain("The Plan");
    }
  });

  it("returns { found: false } with a repo-relative reason for a missing plan", async () => {
    const result = await readPlan({ changeId: "no-such-change-xyz", contextRoot });
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toBe("No plan.md at context/changes/no-such-change-xyz/plan.md");
      expect(result.reason).not.toContain(contextRoot);
    }
  });

  it("returns { found: false } (no throw) for an invalid id, without leaking an absolute path", async () => {
    for (const id of INVALID_IDS) {
      const result = await readPlan({ changeId: id, contextRoot });
      expect(result.found, id).toBe(false);
      if (!result.found) {
        expect(result.reason).not.toContain(contextRoot);
        expect(result.reason).not.toContain(tmpRoot);
      }
    }
  });

  it("rejects a symlinked plan.md escaping the allowed root (F4 realpath re-check)", async (ctx) => {
    if (!symlinkSupported) ctx.skip();
    const result = await readPlan({ changeId: "evil-change", contextRoot });
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toContain("outside the allowed changes root");
      expect(result.reason).not.toContain(tmpRoot);
    }
  });
});
