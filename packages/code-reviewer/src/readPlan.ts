import { promises as fs } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { tool } from "ai";
import { z } from "zod";

/**
 * Read-only plan-access primitive for the reviewer's first tool-loop capability.
 * The model can only ever read `plan.md` under a validated
 * `context/changes/<changeId>/` directory: two independent guardrails (a
 * kebab-case charset regex and a resolved-prefix containment check) must both
 * pass, and a `realpath` re-check defends against a symlinked `plan.md` escaping
 * the root. Failures never surface an absolute path back to the model.
 */

/** A change id is kebab-case: lowercase alphanumerics separated by single hyphens. */
export const CHANGE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Default context root holding `changes/<id>/plan.md`, two levels above cwd. */
export function defaultContextRoot(): string {
  return resolve(process.cwd(), "../../context");
}

/** A reference to a change's plan: a validated `changeId` plus an optional root. */
export interface PlanRef {
  /** Kebab-case change id under review. */
  changeId: string;
  /** Override for the context root; defaults to {@link defaultContextRoot}. */
  contextRoot?: string;
}

/** Resolved, guardrail-checked plan location. `relativePath` is repo-relative. */
export interface ResolvedPlanPath {
  /** Absolute path to `plan.md` — never returned to the model. */
  absolutePath: string;
  /** Repo-relative path, always `context/changes/<changeId>/plan.md`. */
  relativePath: string;
}

/** Result the tool hands the model: either the plan content or a terse reason. */
export type ReadPlanResult = { found: true; path: string; content: string } | { found: false; reason: string };

/** Raised when a change id or its resolved path violates a guardrail. */
export class PlanAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanAccessError";
  }
}

/**
 * Pure resolver: validate `changeId`, build the plan path, and assert it stays
 * within `<contextRoot>/changes`. Throws {@link PlanAccessError} on any
 * violation (invalid id, traversal, absolute escape). Never touches the disk.
 */
export function resolvePlanPath(ref: PlanRef): ResolvedPlanPath {
  const contextRoot = ref.contextRoot ?? defaultContextRoot();
  const { changeId } = ref;

  if (!CHANGE_ID_PATTERN.test(changeId)) {
    throw new PlanAccessError("Invalid change id: must be kebab-case (lowercase letters, digits, hyphens).");
  }

  const allowedRoot = resolve(contextRoot, "changes");
  const absolutePath = resolve(join(contextRoot, "changes", changeId, "plan.md"));

  // Two independent layers must both pass. The regex alone rejects "..", "/", "\",
  // leading dots and ".env"; the resolved-prefix check is defense-in-depth against
  // any future path-construction change. Never surface an absolute path to the model.
  const rel = relative(allowedRoot, absolutePath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new PlanAccessError("Resolved plan path escapes the allowed changes root.");
  }

  return { absolutePath, relativePath: `context/changes/${changeId}/plan.md` };
}

/**
 * Read a change's `plan.md`, guardrails first. Returns `{ found: false, reason }`
 * (never throws, never leaks an absolute path) on an invalid id, a guardrail
 * failure, a symlink escape, or a missing file; `{ found: true, path, content }`
 * on success. `path` is the repo-relative plan path.
 */
export async function readPlan(ref: PlanRef): Promise<ReadPlanResult> {
  const contextRoot = ref.contextRoot ?? defaultContextRoot();

  let resolved: ResolvedPlanPath;
  try {
    resolved = resolvePlanPath({ changeId: ref.changeId, contextRoot });
  } catch (error) {
    if (error instanceof PlanAccessError) return { found: false, reason: error.message };
    throw error;
  }

  const allowedRoot = resolve(contextRoot, "changes");

  // F4: resolve symlinks and re-assert the real path is still inside the root
  // before reading — a symlinked plan.md must not escape `context/changes/`.
  // The root is realpath'd too so a symlinked root (e.g. macOS /var → /private/var)
  // doesn't falsely trip the containment check.
  let realPath: string;
  let allowedRootReal: string;
  try {
    realPath = await fs.realpath(resolved.absolutePath);
    allowedRootReal = await fs.realpath(allowedRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { found: false, reason: `No plan.md at ${resolved.relativePath}` };
    }
    throw error;
  }

  const realRel = relative(allowedRootReal, realPath);
  if (realRel === "" || realRel.startsWith("..") || isAbsolute(realRel)) {
    return { found: false, reason: `Plan path for ${ref.changeId} resolves outside the allowed changes root.` };
  }

  try {
    const content = await fs.readFile(realPath, "utf8");
    return { found: true, path: resolved.relativePath, content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { found: false, reason: `No plan.md at ${resolved.relativePath}` };
    }
    throw error;
  }
}

/**
 * Build the bounded `ai` tool the reviewer attaches when a change is under
 * review. The model may pass an optional `changeId`, but the tool falls back to
 * the bound change under review and reads only through {@link readPlan}, so the
 * guardrails hold regardless of model input.
 */
export function createReadPlanTool(bound: PlanRef) {
  return tool({
    description:
      "Read the implementation plan (plan.md) for the change under review, from " +
      "context/changes/<changeId>/. Returns { found: true, path, content } or " +
      "{ found: false, reason }. Read-only; only plan.md under a validated kebab-case change id.",
    inputSchema: z.object({
      changeId: z.string().optional().describe("kebab-case change id; defaults to the change under review"),
    }),
    execute: (input) => readPlan({ changeId: input.changeId ?? bound.changeId, contextRoot: bound.contextRoot }),
  });
}
