# OM Skills Learning Lab -- Findings

## Finding 001 (Lesson 1-2)

### Question

What is the first Open Mercato skill?

### Evidence

`om-setup-agent-pipeline` states:

> "It is the first skill to run in a fresh repository."

### Observation

The setup created:

-   .ai/
-   AGENTS.md
-   SDLC.md
-   CODE_REVIEW.md
-   BACKWARD_COMPATIBILITY.md

### Conclusion

The engineering pipeline is bootstrapped before any implementation
skills are used.

------------------------------------------------------------------------

## Finding 002 (Lesson 1-2)

### Question

What is the central configuration?

### Evidence

SKILL.md:

> "Every skill reads `.ai/agentic.config.json`."

### Observation

The config contains:

-   validation
-   labels
-   tracker
-   paths
-   engine

It contains no application framework configuration.

### Conclusion

Open Mercato centralizes engineering-process configuration rather than
application-stack configuration.

------------------------------------------------------------------------

## Finding 003

### Question

Why does `AGENTS.md` exist if `.ai/agentic.config.json` already exists?

### Evidence

`AGENTS.md` contains a **Task routing** section that maps task types to
the documents an agent should read first (for example, pipeline changes
→ `.ai/agentic.config.json` + `SDLC.md`, skill editing → `SKILL.md` +
`references/`).

`.ai/agentic.config.json` contains only structured pipeline
configuration such as validation commands, labels, engine settings and
artifact paths.

### Observation

The two files have different responsibilities.

-   `agentic.config.json` configures the engineering pipeline.
-   `AGENTS.md` explains how an agent should navigate the repository and
    which documents become authoritative for a given task.

### Conclusion

Open Mercato separates **configuration** from **repository guidance**.

`agentic.config.json` defines **how the pipeline is configured**, while
`AGENTS.md` acts as a **knowledge router**, directing agents to the
correct documentation before making changes.

------------------------------------------------------------------------

## Finding 004 --- Lesson 4: Pipeline execution through skills

### Question

What does running a change through the pipeline reveal about how the
skills relate to each other?

### Evidence

Issue #2 and PR #3 --- the issue-driven run: the issue was assigned and
claimed by comment before work started.

PR #4 --- the branch-driven run: label transitions from `review` to
`changes-requested` to `merge-queue`, the claim and release around the
review stage, the rejected same-account approval, and the merge.

### Observation

A real repository change was taken through the Open Mercato workflow
using pipeline skills. GitHub labels represented workflow states, and
dedicated skills handled review, autofix, re-review, merge queue, and
merge. Claiming is not uniform across the skills: `om-auto-review-pr`
claimed the PR with an assignee, the `in-progress` label, and a claim
comment, and released the claim when its stage finished, while
`om-open-pr` and `om-approve-merge-pr` acted on the PR without taking
the lock at all. The claim is the mechanism intended to keep concurrent
agents off the same PR, although no contention actually occurred during
these runs.

### Conclusion

The Open Mercato pipeline is not one monolithic agent workflow. It is
composed of specialized skills that perform individual SDLC stages and
coordinate through shared repository state, primarily GitHub issues,
PRs, claims, and labels.

This allows work to move between agents and skills while the repository
and tracker remain the shared source of workflow state.

## Finding 005 --- Issue orchestration is explicit and resumable

`om-auto-fix-issue` acts as a high-level flow runner for a single
issue-driven session. It does not implement every SDLC stage itself;
instead, it orchestrates specialized companion skills and controls
routing, sequencing, worktree lifecycle, concurrency, handoffs, failure
cleanup, and reporting.

Skills communicate through explicit contracts such as machine-readable
reference lines, control markers, structured previous-step outputs, and
tracker state. The process can stop cleanly and later resume from
durable repository/tracker state rather than depending on one continuous
agent session.

This creates a layered model:

`flow runner → specialized skills → repo/tracker state`

The orchestration layer coordinates the workflow while individual skills
retain narrow responsibilities and remain independently runnable.

------------------------------------------------------------------------

## Finding 006 --- Feature design is a separate autonomous lifecycle

### Question

After autonomous issue orchestration, does Open Mercato treat feature
design as just another implementation step, or as its own lifecycle?

### Evidence

Lesson 6 used `om-auto-write-spec` with a plain feature brief for a
Learning Lab Status capability.

The skill created an isolated `spec/lab-status-check` branch, wrote
`.ai/specs/2026-08-13-lab-status-check.md`, and opened PR #9 as a
design-only PR. No feature code was implemented in that PR.

`om-spec-writing` produced the specification in autonomous mode,
including resolved assumptions, architecture, edge cases, phasing, and
an implementation plan.

### Observation

The feature moved through a complete design lifecycle before
implementation began:

`feature brief → autonomous spec → spec PR → review → human decisions → spec amendment → approved spec on main`

The spec PR remained explicitly design-only, and the implementation was
left for a separate follow-on lifecycle.

### Conclusion

Open Mercato treats feature specification as a first-class,
independently reviewable engineering artifact rather than as hidden
reasoning inside an implementation run.

The lifecycle separates **design state** from **implementation state**,
allowing the design to be reviewed, amended, merged, and referenced
before any code is written.

------------------------------------------------------------------------

## Finding 007 --- Autonomous design is reversible and human-overridable

### Question

What happens when an autonomous spec is technically valid but the human
disagrees with its product or implementation decisions?

### Evidence

The first autonomous version of the Lab Status spec selected a POSIX
shell script and a broader diagnostic scope.

An architectural review found several correctness issues, but it did not
reject those product decisions.

Human review then explicitly changed two decisions:

-   use Windows PowerShell 5.1 instead of POSIX `sh`,
-   reduce Phase 1 to the smallest useful Learning Lab Status
    capability.

`om-spec-writing` amended the existing spec in place and regenerated the
affected architecture, contracts, risks, phasing, and implementation
plan.

### Observation

Autonomous defaults were not treated as final authority.

The design could be narrowed and redirected after review without
discarding the spec lifecycle or starting over. The revised spec
preserved an audit trail of the original autonomous decisions and the
later human overrides.

### Conclusion

Open Mercato autonomy is designed around **documented, reversible
assumptions**, not irreversible agent decisions.

A useful mental model is:

`autonomous proposal → explicit assumptions → review → human override → amended durable artifact`

Human judgement remains a first-class control point, especially for
scope and environment-specific decisions that architectural review alone
may not identify.

------------------------------------------------------------------------

## Finding 008 --- Runtime repository state can correct documented assumptions

### Question

When repository documentation and the actual checkout disagree, which
one should drive the design?

### Evidence

During the Lab Status spec amendment, repository probing showed that the
13 discovery entries under `.claude/skills/` were NTFS `Junction`
entries in the Windows checkout, even though the repository
documentation consistently described them as symlinks.

A design that accepted only `SymbolicLink` would therefore have reported
a healthy lab as broken.

The final spec was changed to accept both `SymbolicLink` and `Junction`
and to verify that each discovery entry resolves to the matching
`.agents/skills/<name>` directory in the current repository.

### Observation

The spec-writing/review process used actual repository state to
challenge a documented assumption and changed the design accordingly.

### Conclusion

Repository documentation is an important source of architectural intent,
but runtime and filesystem observations remain authoritative for actual
behavior.

For feature design, Open Mercato's process can be understood as:

`repo rules + repo state + observed runtime behavior → design`

rather than treating documentation alone as unquestionable truth.

------------------------------------------------------------------------

## Finding 009 --- Spec implementation uses a thin router and a separate execution engine

**Evidence:** Experiment 004 --- Autonomous spec implementation
lifecycle

`om-auto-implement-spec` did not directly perform the feature
implementation.

It resolved the approved specification, checked whether an
implementation already existed, and selected the appropriate downstream
engine.

For a fresh implementation the observed handoff was:

``` text
approved spec
    ↓
om-auto-implement-spec
    ↓
resolve spec
    ↓
detect existing implementation
    ↓
none found
    ↓
om-auto-create-pr
```

`om-auto-create-pr` then owned the implementation machinery: execution
planning, worktree isolation, incremental implementation, validation,
Progress tracking, PR lifecycle, and downstream review.

This establishes a separation between:

``` text
spec resolution / routing
```

and:

``` text
implementation execution
```

The orchestration layer does not need to duplicate the execution
machinery it routes into.

------------------------------------------------------------------------

## Finding 010 --- Approved design is translated into a durable execution artifact before code

**Evidence:** Experiment 004 --- Autonomous spec implementation
lifecycle

The approved specification was not consumed only as prompt context.

`om-auto-create-pr` used the specification's `Implementation Plan` to
generate a five-Step execution plan.

Before implementation code was committed, the plan itself became the
first durable commit on the implementation branch:

``` text
7c22dd7 docs(runs): add execution plan for lab-status-check
```

The observed transition was therefore:

``` text
approved specification
        ↓
Implementation Plan
        ↓
execution Phases / Steps
        ↓
durable execution plan
        ↓
implementation
```

This creates an explicit boundary between **design intent** and
**execution state**.

The specification describes what should be built and the approved design
constraints. The execution plan represents how that approved design is
being carried out in a particular implementation run.

------------------------------------------------------------------------

## Finding 011 --- Resumability is built from durable execution state, not only agent memory

**Evidence:** Experiment 004 --- Autonomous spec implementation
lifecycle

The fresh implementation run continuously persisted execution state
outside the active agent invocation.

Observed durable state included:

``` text
implementation branch
execution-plan commit
incremental implementation commits
Progress checklist
commit SHAs associated with completed work
remote pushes
implementation PR
```

Implementation work was committed incrementally, and completion of the
implementation phase was separately recorded:

``` text
eda21c4 docs(runs): mark lab-status-check Phase 1 complete
```

After review produced an additional fix, Progress was updated again:

``` text
fdf642b docs(runs): record the review autofix commit
```

The resulting model is:

``` text
execution plan
    +
Progress state
    +
Git history
    +
remote branch
    +
implementation PR
        ↓
durable implementation state
```

This provides the architectural foundation for a resumable
implementation lifecycle without relying solely on the context of one
running agent.

The actual resume path through `om-auto-continue-pr` was **not tested in
Experiment 004**, so this finding does not claim that resume execution
itself has been observed.

------------------------------------------------------------------------

## Finding 012 --- Design and implementation are separate but linked lifecycles

**Evidence:** Experiments 003 and 004

Lesson 6 produced the approved design on a design-only PR:

``` text
feature intent
    ↓
autonomous specification
    ↓
architectural review
    ↓
human decisions
    ↓
approved spec
    ↓
spec PR #9
    ↓
main
```

Lesson 7 consumed that approved artifact and created a separate
implementation lifecycle:

``` text
approved spec on main
    ↓
om-auto-implement-spec
    ↓
om-auto-create-pr
    ↓
feat/lab-status-check
    ↓
implementation PR #10
```

The implementation did not reuse or mutate the spec PR branch.

Instead:

``` text
PR #9 = design artifact
PR #10 = implementation artifact
```

The two lifecycles remained linked through the specification path and PR
cross-references.

The combined observed lifecycle is therefore:

``` text
FEATURE INTENT
      ↓
────────────────────────
DESIGN LIFECYCLE
────────────────────────
      ↓
specification
      ↓
review / human override
      ↓
approved design
      ↓
spec PR
      ↓
main
      ↓
────────────────────────
IMPLEMENTATION LIFECYCLE
────────────────────────
      ↓
spec resolution
      ↓
execution plan
      ↓
isolated implementation
      ↓
incremental commits
      ↓
Progress tracking
      ↓
validation
      ↓
review
      ↓
implementation PR
```

Open Mercato therefore treats approved design and implementation as
**separate autonomous lifecycles connected by durable handoff
artifacts**, rather than as one continuous opaque agent run.

------------------------------------------------------------------------

## Finding 013 --- `om-auto-continue-pr` reconstructs and resumes unfinished PR work

**Evidence:** Lesson 8 --- documented inspection of
`om-auto-continue-pr`, `references/claim-pr.md`, and
`references/worktree-setup.md`

`om-auto-continue-pr` accepts an existing PR number as its primary entry
point and reconstructs the implementation context required to continue
that PR.

The documented normal resume path is:

``` text
PR number
    ↓
claim / concurrency check
    ↓
resolve Tracking plan
    ↓
restore isolated worktree from PR head
    ↓
parse ## Progress
    ↓
cross-check completed commit SHA
    ↓
first unchecked Step
    ↓
continue implementation
```

The skill does not create a fresh implementation branch. It restores the
existing PR head in an isolated worktree and continues the existing
execution plan.

The resume point is selected at **Step granularity**:

``` text
[x] completed Step
[x] completed Step
[ ] first pending Step  ← resume point
[ ] later Step
```

Execution then continues phase-by-phase using the same implementation,
validation, Progress-update, review, and finalization discipline as
`om-auto-create-pr`.

### Conclusion

`om-auto-continue-pr` is the resume engine for unfinished PR work.

Its role can be summarized as:

``` text
om-auto-create-pr
        ↓
creates implementation state
        ↓
unfinished PR
        ↓
om-auto-continue-pr
        ↓
reconstructs implementation context
        ↓
continues from first pending Step
        ↓
finishes PR
```

This behavior is **documented and inspected in Lesson 8 but has not been
runtime-tested in the Learning Lab**.

------------------------------------------------------------------------

## Finding 014 --- Resume state is reconstructed from multiple durable surfaces

**Evidence:** Lesson 8 --- documented inspection of
`om-auto-continue-pr`, `references/claim-pr.md`, and
`references/worktree-setup.md`

Lesson 7 showed that autonomous implementation persists execution state
outside the active agent invocation.

Lesson 8 clarified how the resume contract uses those artifacts.

The documented state model is:

``` text
PR
= resume entry point and coordination surface

Tracking plan
= execution contract

## Progress
= logical completion state

commit SHAs + Git history
= checkpoint verification

remote PR head
= durable implementation source

assignee + in-progress label + claim comments
= concurrency / ownership state
```

Before continuing implementation, `om-auto-continue-pr` reconstructs
both execution state and ownership state.

It resolves the plan from the PR, restores an isolated worktree from the
existing remote PR head, finds the first unchecked Progress Step, and
cross-checks the last recorded completed Step SHA against Git history.

The documented worktree restoration path is:

``` text
existing PR
    ↓
headRefName
    ↓
origin/<PR-head>
    ↓
temporary isolated worktree
```

This means normal resume reconstruction depends on durable remote state
rather than the previous invocation's local filesystem state.

### Conclusion

Open Mercato resumability is not simply:

``` text
read Progress
→ continue coding
```

The documented model is closer to:

``` text
coordination state
        +
execution plan
        +
Progress
        +
Git history
        +
remote PR branch
        ↓
reconstruct safe execution context
        ↓
select resume point
        ↓
continue
```

Lesson 7 observed the creation of much of this durable state. Lesson 8
documented how `om-auto-continue-pr` is designed to consume it.

The actual resume reconstruction path remains **not runtime-tested in
the Learning Lab**.

------------------------------------------------------------------------

## Finding 015 --- PR adoption normalizes external or undocumented PRs into the standard resume contract

**Evidence:** Lesson 8 --- documented inspection of
`references/adopt-pr.md`

`om-auto-continue-pr` is not limited to PRs created by
`om-auto-create-pr`.

When an existing PR has no usable execution plan, the skill can
**adopt** it rather than treating missing pipeline metadata as a
terminal error.

The documented adoption path is:

``` text
existing PR
    ↓
no usable Tracking plan
    ↓
evidence sweep
    ↓
reconstruct goal and remaining work
    ↓
create canonical execution plan
    ↓
create ## Progress
    ↓
add Tracking plan: to PR
    ↓
ordinary resume machinery
```

The evidence sweep can use:

``` text
PR title / body / task lists
comments
review feedback
failing checks
linked issues
specs and design documents
diff
Git history
repository conventions
```

Adoption therefore acts as a normalization layer.

Instead of building a separate execution mechanism for non-pipeline PRs,
it converts them into the same durable representation expected by the
normal resume engine:

``` text
arbitrary PR state
        ↓
ADOPTION
        ↓
execution plan + Progress
        ↓
standard om-auto-continue-pr lifecycle
```

The same mechanism can repair a malformed or missing `## Progress`
section without replacing the rest of an existing plan.

For an interactive run, documented `ask` mode can commit and publish the
reconstructed plan, release the claim, clean up the worktree, and stop
for human confirmation before implementation. This leaves the PR in a
durable state that can later be re-entered through the normal resume
path.

### Conclusion

Open Mercato's resume architecture is not restricted to work originally
created by its own implementation engine.

PR adoption provides an adapter from external or incomplete PR state
into the standard execution-plan contract, after which the ordinary
resume machinery can take over.

Adoption was **inspected but not runtime-tested in Lesson 8**.

------------------------------------------------------------------------

## Finding 016 --- PR autopilot is a state-driven orchestration layer

**Evidence:** Lesson 9 --- documented inspection of `om-pr-autopilot`,
`references/diagnose.md`, `references/state-matrix.md`,
`references/rules.md`, `references/report-templates.md`, and
`references/agentic-setup.md`

`om-pr-autopilot` provides a single orchestration entry point for an
existing open PR.

It does not implement review, fixes, CI repair, QA, continuation, or
merge itself. Instead, it first reconstructs a normalized view of the PR
and then decides which specialized `om-*` capabilities should run and in
what order.

The documented lifecycle is:

``` text
existing open PR
        ↓
agentic preflight
        ↓
diagnose 10 state signals
        ↓
PR State Report
        ↓
classify through state matrix
        ↓
build ordered skill chain
        ↓
delegate to specialized om-* skill
        ↓
re-diagnose changed signals
        ↓
adapt remaining chain
        ↓
stop / merge-ready / explicit merge
        ↓
publish PR + session report
```

Diagnosis considers multiple independent dimensions of PR state,
including:

``` text
identity / repository
PR ownership and draft state
plan progress
diff scope
review state and conversations
CI
mergeability
labels
QA evidence
claim state
```

Classification is not a one-time selection of a single skill.

The state matrix is evaluated top-to-bottom, and one PR can match
multiple rows. This produces an ordered lifecycle chain such as:

``` text
unfinished implementation
        ↓
continue implementation
        ↓
review / autofix
        ↓
CI
        ↓
QA
        ↓
merge-ready
```

After delegated steps, the autopilot re-reads relevant PR signals
because one capability may satisfy several later conditions. The
remaining chain can therefore shrink or change as the PR state changes.

The orchestration also distinguishes technical capability from
authority:

``` text
PUSHABLE
= can this identity technically push to the branch?

DRIVABLE
= is this identity permitted to autonomously modify this PR?
```

This allows the same technical PR state to route differently depending
on ownership and policy. For example, another author's PR can be
reviewed and handed off rather than automatically modified.

Autonomy is similarly bounded. Ordinary reversible decisions are made
without requiring a human in the loop, while explicit gates such as
claim conflicts and `⚠ NEEDS HUMAN CONFIRMATION` stop execution. Merge
is also intentionally excluded from default autonomous execution: the
normal endpoint is `merge-ready`, and actual merge requires
`--allow-merge`.

The orchestration is repository-aware rather than GitHub-hard-coded.
Configuration, tracker operations, labels, repository instructions, and
optional repo-local skill extensions are resolved during agentic
preflight. Tracker access is performed through named operations defined
by the configured tracker descriptor.

### Conclusion

`om-pr-autopilot` establishes a higher PR orchestration layer above the
specialized PR skills.

Its responsibility is:

``` text
observe state
    ↓
normalize state
    ↓
apply routing and policy
    ↓
sequence capabilities
    ↓
observe the new state
    ↓
adapt
    ↓
report
```

while the delegated skills retain responsibility for the actual
implementation, review, fix, QA, CI, and merge work.

A useful architectural model is therefore:

``` text
                 om-pr-autopilot
                        │
          state diagnosis + policy
                        │
                  routing matrix
                        │
                 dynamic chain
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
   continue         review/fix           QA
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                   merge-ready
```

This makes `om-pr-autopilot` best understood as a **state-driven
dispatcher/orchestrator with policy guards**.

It exhibits state-machine-like behavior because execution repeatedly
transitions between observed PR states, but describing it formally as a
state machine remains an architectural interpretation rather than
terminology established by the inspected skill documentation.

This finding is **documented and inspected in Lesson 9 but has not been
runtime-tested in the Learning Lab**.

------------------------------------------------------------------------

## Finding 017 --- Fresh implementation engine selection is deterministic and separate from loop run-mode classification

**Evidence:** Lesson 10 --- documented inspection of
`om-auto-implement-spec`, `om-auto-create-pr`,
`references/engine-selection.md`, and `om-auto-create-pr-loop`

For a fresh spec implementation, `om-auto-implement-spec` delegates to
`om-auto-create-pr`.

`om-auto-create-pr` owns the flat-vs-loop engine decision.

The documented routing rule is deterministic:

``` text
--loop
OR
drafted plan Steps > engine.loopStepThreshold
        ↓
om-auto-create-pr-loop
```

The default threshold is:

``` text
engine.loopStepThreshold = 20
```

The count is based on Steps, not Phases.

Nothing else selects the loop engine. UI work, subjective complexity, or
the possibility that a run may not finish in one pass are not routing
signals.

When the Step threshold triggers the handoff, the plain engine's drafted
Progress-format plan is discarded before it is written or committed. The
loop engine receives the original brief/spec and creates its own
run-folder plan format.

This means engine selection happens before durable execution artifacts
are committed.

Inside `om-auto-create-pr-loop`, a separate classification then chooses
between:

``` text
Simple run
```

and:

``` text
Spec-implementation run
```

These are two different decisions:

``` text
LEVEL 1
flat engine vs loop engine

LEVEL 2
inside loop:
Simple vs Spec-implementation contract
```

### Conclusion

Open Mercato separates **engine routing** from **execution-contract
classification**.

A useful model is:

``` text
fresh implementation
        ↓
om-auto-create-pr
        ↓
engine routing
        ↓
plain OR loop
              ↓
      if loop selected:
              ↓
      run-mode classification
              ↓
      Simple / Spec-implementation
```

This routing behavior is **documented**. Lesson 10 runtime-tested only
the explicit `--loop` path, not automatic threshold routing.

------------------------------------------------------------------------

## Finding 018 --- Loop execution uses a different durable state model from the plain implementation engine

**Evidence:** Experiment 005 --- Loop implementation engine and durable
execution protocol

The plain implementation engine observed in Lesson 7 persisted resumable
execution state primarily through:

``` text
single execution-plan file
## Progress checklist
commit SHAs
remote branch
implementation PR
```

In Lesson 10, the loop engine used a richer durable state model:

``` text
run folder/
    ├── PLAN.md
    ├── HANDOFF.md
    ├── NOTIFY.md
    ├── checkpoint state
    └── final-gate state
```

`PLAN.md` carries the authoritative Tasks state.

Implementation Steps were committed individually, and checkpoint
activity created additional durable execution-state commits.

A checkpoint fired during the six-Step Lab Report implementation,
proving that checkpoint-based verification is part of the runtime
execution model rather than only a documented design.

### Conclusion

`om-auto-create-pr-loop` is not simply a larger version of
`om-auto-create-pr`.

It uses a different **durable execution protocol** intended to make
long-running implementation progress explicit and reconstructable:

``` text
execution plan
    +
Step state
    +
Git history
    +
handoff snapshot
    +
event log
    +
checkpoint evidence
        ↓
durable loop execution state
```

The key architectural difference is therefore not only how much work is
performed, but **how execution state is represented and persisted**.

This behavior is **runtime observed in Lesson 10**.

------------------------------------------------------------------------

## Finding 019 --- Loop checkpoints batch verification and execution-state updates

**Evidence:** Experiment 005 and Lesson 10 inspection of
`references/checkpoint-pass.md`

The Lab Report loop run contained six implementation Steps and produced
a real checkpoint during execution.

The loop contract does not create a verification artifact for every
Step.

Instead, normal implementation progress is kept lean:

``` text
Step
    ↓
implementation
    ↓
one commit
    ↓
Tasks state update
```

and periodically batches verification and handoff state into a
checkpoint:

``` text
multiple Steps
    ↓
checkpoint
    ↓
targeted verification
HANDOFF rewrite
NOTIFY entry
checkpoint evidence
checkpoint commit
```

This reduces per-Step ceremony while still creating durable recovery
points.

### Conclusion

The loop engine combines **fine-grained implementation commits** with
**coarser-grained verification checkpoints**.

A useful mental model is:

``` text
Step-level execution granularity
        +
checkpoint-level verification granularity
```

The existence of checkpoint execution is **runtime observed in Lesson
10**. The full set of checkpoint trigger rules remains documented rather
than exhaustively runtime-tested.

------------------------------------------------------------------------

## Finding 020 --- Linked design and implementation PRs can be finalized as a coordinated merge pair

**Evidence:** Lesson 10 --- runtime execution of `om-approve-merge-pr`
for implementation PR #12 and linked spec PR #11

During finalization of the Lab Report feature, `om-approve-merge-pr`
discovered that implementation PR #12 was linked to spec PR #11.

The skill did not silently merge both PRs just because the relationship
existed.

Instead, it surfaced the relationship and required an explicit human
decision. After the user chose to merge both, the implementation PR was
merged first and the spec PR second.

The observed flow was:

``` text
implementation PR #12
        +
linked spec PR #11
        ↓
detect linked PR relationship
        ↓
human decision
        ↓
merge implementation PR #12
        ↓
main changes
        ↓
re-check spec PR #11
        ↓
MERGEABLE / CLEAN
        ↓
merge spec PR #11
```

A particularly important behavior was that the second PR was not assumed
to remain safe after the first merge changed `main`.

GitHub briefly reported PR #11 mergeability as `UNKNOWN` while
recomputing. `om-approve-merge-pr` waited for the state to settle,
re-checked it, confirmed `CLEAN`, and only then merged the spec PR.

The resulting squash merge commits were:

``` text
PR #12 → 10f9456
PR #11 → e96339a
```

### Conclusion

Open Mercato can treat linked design and implementation PRs as a
coordinated finalization unit without collapsing them into one atomic
operation.

The observed model is:

``` text
discover relationship
        ↓
request merge authority
        ↓
merge first PR
        ↓
repository state changes
        ↓
re-observe remaining PR
        ↓
validate against new state
        ↓
merge second PR
```

This reinforces two architectural principles already visible elsewhere
in the skills:

``` text
AUTONOMY
≠
UNBOUNDED AUTHORITY
```

and:

``` text
previously observed state
≠
current authoritative state
```

The skill can discover relationships and coordinate the merge sequence,
but the human retains authority over whether the linked PRs should
actually be merged.

At the same time, each state-changing action is followed by fresh
observation rather than assuming that the remaining PR is still
mergeable.

This behavior was **runtime observed in Lesson 10** with implementation
PR #12 and linked spec PR #11.

------------------------------------------------------------------------

## Finding 021 --- Autonomous QA is a layered runtime-verification architecture

### Question

Does Open Mercato treat autonomous QA as one monolithic test skill, or
as a set of separate runtime-verification responsibilities?

### Evidence

Lesson 11 inspected `om-auto-qa-pr`, `om-prepare-test-env`, their
references, and the configured browser descriptor.

`om-auto-qa-pr` documents a QA orchestration flow that derives
verification scope and scenarios, obtains a runnable environment through
`om-prepare-test-env`, drives the configured browser provider, and
produces QA evidence.

`om-prepare-test-env` owns environment discovery, provisioning,
lifecycle, and the environment descriptor rather than the QA scenario
itself.

The browser provider is resolved through a descriptor contract exposing
operations such as:

``` text
open
snapshot
interact
assert
screenshot
close
```

### Observation

The documented architecture separates three responsibilities:

``` text
om-auto-qa-pr
    ↓
QA orchestration
    ↓
┌──────────────────────┬─────────────────────┐
│ om-prepare-test-env  │ browser provider    │
│ environment lifecycle│ browser interaction │
└──────────┬───────────┴──────────┬──────────┘
           ↓                      ↓
      test-env.json           real browser
           └──────────┬───────────┘
                      ↓
                  real runtime
                      ↓
                  QA evidence
```

`om-auto-qa-pr` does not need to know how the application is started or
how a particular browser implementation is installed and invoked.

### Conclusion

Open Mercato's autonomous QA capability is a **layered
runtime-verification architecture**, not a single test runner.

The documented responsibility boundaries are:

``` text
QA orchestration
        ≠
environment provisioning
        ≠
browser implementation
```

This architecture was **documented and inspected in Lesson 11**. A
complete browser-driven `om-auto-qa-pr` run was not runtime-tested in
the Learning Lab.

------------------------------------------------------------------------

## Finding 022 --- Test-environment discovery can be compiled into reusable executable knowledge

### Question

Does `om-prepare-test-env` rediscover how to run an application on every
invocation?

### Evidence

Lesson 11 inspection of `om-prepare-test-env` and its generation
references documented a two-stage model.

For a repository with a runnable application, the generation path
discovers how to build, start, stop, and verify the environment and then
generates platform-appropriate entrypoints such as:

``` text
.ai/scripts/test-env-up.ps1
.ai/scripts/test-env-down.ps1
```

The generated entrypoint is then verified through cold and warm runs.
Later invocations can use the generated entrypoint instead of repeating
the full discovery process.

The skill also documents repair behavior in which failures found during
later runs are fixed in the generated script and the script is rerun.

### Observation

The intended transition is:

``` text
agent discovery
      ↓
understand repository runtime
      ↓
generate deterministic entrypoint
      ↓
verify cold + warm
      ↓
future runs execute the entrypoint
```

This converts repository-specific runtime knowledge discovered by an
agent into ordinary executable artifacts.

The Learning Lab itself has no runnable application, so Lesson 11 did
**not** generate `test-env-up.ps1` or `test-env-down.ps1` and did not
observe cold/warm reuse.

### Conclusion

`om-prepare-test-env` can be understood as an **environment compiler**:

``` text
discovered runtime knowledge
        ↓
generated executable knowledge
        ↓
reusable deterministic environment lifecycle
```

The generation and reuse model is **documented**, while successful
script generation and cold-to-warm reuse remain **not runtime-tested in
the Learning Lab**.

------------------------------------------------------------------------

## Finding 023 --- `test-env.json` is the shared runtime-environment contract

### Question

How do QA and integration-test capabilities consume a prepared
environment without knowing how that environment was created?

### Evidence

Lesson 11 inspection of the environment-descriptor contract showed that
`om-prepare-test-env` writes `.ai/qa/test-env.json`.

The descriptor can expose environment state and connection information
such as:

``` text
baseUrl
services
credential references
browser provider
test runner
start / stop scripts
platform
startedByThisRepo
```

Both `om-auto-qa-pr` and `om-integration-tests` are documented as
consumers of the prepared environment.

During the Learning Lab runtime experiment, `om-prepare-test-env`
actually wrote `.ai/qa/test-env.json`. The descriptor recorded the
configured browser provider as `agent-browser`, the Windows platform,
and the absence of a runnable application.

### Observation

The environment layer owns **how** the environment is discovered and
managed, while consumers receive a normalized description of **what
runtime is available**:

``` text
om-prepare-test-env
        ↓
   test-env.json
        ↓
┌────────────────────┬──────────────────────┐
│ om-auto-qa-pr      │ om-integration-tests │
└────────────────────┴──────────────────────┘
```

The runtime experiment also showed that configuration participates in
this contract: the Lab's configured `browser.provider = agent-browser`
appeared in the generated descriptor.

### Conclusion

`test-env.json` is a **shared runtime boundary** between environment
provisioning and runtime-verification consumers.

This allows QA and integration-test skills to consume environment state
without duplicating repository-specific startup logic.

The contract is **documented**, and creation of a `test-env.json`
descriptor plus propagation of the configured browser provider were
**runtime observed in Lesson 11**.

------------------------------------------------------------------------

## Finding 024 --- No runnable application is a valid environment-discovery outcome

### Question

What does `om-prepare-test-env` do when repository discovery finds no
application that should be brought up?

### Evidence

Lesson 11 ran `om-prepare-test-env` against `om-skills-learning-lab`.

Repository inspection found no application code or common
runnable-application definition:

``` text
no package.json
no Dockerfile
no compose file
no Makefile
no application manifest
no .github/workflows/
```

The repository's own guidance also states that it has no source tree,
test suite, or application code.

The skill identified the self-contained `learning-map/*.html` files as a
possible browsable artifact but asked for a human decision rather than
silently turning them into a served application.

The selected target was:

``` text
No app — record the gap
```

The resulting `.ai/qa/test-env.json` contained:

``` text
status            = no-app
mode              = none
baseUrl           = null
startedByThisRepo = false
startScript       = null
stopScript        = null
browser.provider  = agent-browser
browser.installed = false
testRunner.name   = none
platform          = win32
```

No environment scripts were generated and no server or browser provider
was started.

### Observation

The observed runtime path was:

``` text
repository discovery
        ↓
no runnable application
        ↓
human target decision
        ↓
do not fabricate a server
        ↓
do not fabricate a baseUrl
        ↓
write negative environment state
        ↓
status = no-app
baseUrl = null
```

The configured `agent-browser` provider was also deliberately left
uninstalled because there was no application for it to drive.

### Conclusion

Absence of a runnable application is a **valid environment-discovery
result**, not automatically a provisioning failure.

The runtime contract can explicitly communicate that consumers must not
attach to an environment:

``` text
no applicable runtime
        ↓
explicit descriptor state
        ↓
downstream skills can stop honestly
```

This `no-app` behavior was **runtime observed in Lesson 11**.

------------------------------------------------------------------------

## Finding 025 --- QA evidence and durable regression tests are separate runtime-verification capabilities

### Question

Are `om-auto-qa-pr` and `om-integration-tests` two names for the same
test-execution capability?

### Evidence

Lesson 11 inspection showed different documented responsibilities.

`om-auto-qa-pr` derives a QA scenario for a change, drives the real
application through the browser-provider abstraction, and produces
evidence such as:

``` text
screenshots
report.md
report.json
PASS / FAIL
```

`om-integration-tests` can run existing integration/E2E tests, but it
can also explore the real application, author new executable tests,
execute them, and analyze failures.

It preserves the repository's existing test framework rather than
replacing it with the browser provider used for agent exploration.

### Observation

The two capabilities share runtime infrastructure but produce different
kinds of engineering assets:

``` text
                prepared real runtime
                        │
             ┌──────────┴──────────┐
             ↓                     ↓
      om-auto-qa-pr        om-integration-tests
             ↓                     ↓
       QA evidence          executable tests
             ↓                     ↓
 "does it work now?"      durable regression asset
```

The browser provider and repository test runner are also separate
concepts:

``` text
browser provider
= agent interaction with the live application

test runner
= repository-native execution of durable tests
```

### Conclusion

Open Mercato separates **change-oriented QA evidence** from **durable
automated regression coverage**.

`om-auto-qa-pr` is primarily an autonomous QA/evidence capability, while
`om-integration-tests` is a test-engineering capability covering test
authoring, execution, and failure analysis.

This separation is **documented and inspected in Lesson 11**. Neither a
complete browser QA run nor integration-test authoring against a
runnable application was runtime-tested in the Learning Lab.

------------------------------------------------------------------------

## Finding 026 --- Environment discovery can persist durable repo-local knowledge

### Question

When environment discovery reaches a stable repository-specific
conclusion, does that knowledge have to be rediscovered on every future
invocation?

### Evidence

The Lesson 11 runtime experiment concluded that `om-skills-learning-lab`
has no runnable application.

In addition to the ignored runtime descriptor, `om-prepare-test-env`
created the tracked repo-local extension:

``` text
.ai/skills/om-prepare-test-env/SKILL.md
```

The file records:

``` text
the no-application conclusion
supporting repository evidence
machine/tooling facts
the chosen PowerShell flavor
instructions for QA consumers
browser-provider deferral
explicit re-attempt triggers
```

The re-attempt triggers include changes such as adding an application
manifest, Docker/Compose configuration, a CI workflow that documents a
run recipe, changing the relevant `AGENTS.md` state, or deliberately
deciding to serve `learning-map/` as an HTTP target.

### Observation

The runtime produced two different artifacts with different lifetimes:

``` text
.ai/qa/test-env.json
        ↓
current generated runtime state
        ↓
gitignored

.ai/skills/om-prepare-test-env/SKILL.md
        ↓
durable repository knowledge
        ↓
tracked source artifact
```

The repo-local skill extension preserves not only a conclusion but also
the evidence behind it and the conditions that should invalidate it.

This creates a different durable-state pattern from the loop execution
artifacts observed in Lesson 10.

### Conclusion

Open Mercato can persist **discovered repository knowledge** so future
agent runs do not need to repay the same discovery cost.

A broader durable-state model now visible across Lessons 10--11 is:

``` text
loop PLAN / HANDOFF / checkpoints
→ durable execution state

generated test-env scripts
→ durable executable environment knowledge
  [documented, not generated in this Lab]

repo-local SKILL.md
→ durable discovered repository knowledge

test-env.json
→ current generated runtime state
```

Creation of the repo-local `om-prepare-test-env` extension and its
evidence/re-attempt contract was **runtime observed in Lesson 11**.

------------------------------------------------------------------------

## Finding 027 --- Pipeline retro turns finished delivery history into quantified improvement evidence

### Question

What does `om-pipeline-retro` actually produce from completed pipeline
runs?

### Evidence

Lesson 13 runtime-tested `om-pipeline-retro` against the Learning Lab's
real 30-day PR history.

The skill examined 10 finished PRs. Nine carried usable agent run
markers and were classified as:

``` text
7 clean single pass
0 hard recovery
0 loop checkpoints (by design)
2 second pass, cause not stated
```

The clean-run median time to merge was 1.0h.

The two unexplained second-pass runs accounted for 1.1h beyond that
clean-run baseline.

The retro also reported declared-outcome coverage of 0% because none of
the nine classifiable runs contained an `Outcome:` line.

### Observation

The retro did more than count successful and unsuccessful PRs.

It reconstructed historical execution signals, classified run shapes,
established a clean-run timing baseline, measured excess time, and
surfaced missing telemetry when the historical record could not justify
a recovery classification.

The observed model was:

``` text
finished PR history
        ↓
agent run markers + timestamps + size
        ↓
om-pipeline-retro
        ↓
run classification
        +
clean-run baseline
        +
second-pass cost
        +
observability gaps
        ↓
ranked improvement evidence
```

The classifier did not infer a hard-recovery cause merely because a
second pass occurred.

When the historical record lacked a qualifying cause, the run remained:

``` text
second pass, cause not stated
```

### Conclusion

`om-pipeline-retro` is a **pipeline observability and
improvement-analysis capability**, not simply a retrospective summary
generator.

It converts durable delivery history into quantified evidence about:

``` text
how often rework occurs
what kind of rework is recorded
how much measurable time second passes cost
where pipeline telemetry is insufficient to explain the work
```

This behavior was **runtime observed in Lesson 13**.

------------------------------------------------------------------------

## Finding 028 --- Missing cause data is itself a first-class observability finding

### Question

What does `cause not recorded` mean in the retro model?

### Evidence

Lesson 13 found two PRs that ran `om-auto-review-pr` twice.

Their histories did not contain a qualifying formal `CHANGES_REQUESTED`,
merge conflict, interruption, declared recovery outcome, or another
recorded hard-recovery signal.

At the same time, declared-outcome coverage across the nine classifiable
runs was:

``` text
0%
```

No run carried an `Outcome:` line.

The retro therefore classified both second-pass runs as:

``` text
Second pass, cause not stated
```

rather than assigning an inferred hard-recovery cause.

### Observation

The pipeline history was sufficient to prove that extra work occurred,
but insufficient to prove why it occurred.

This creates an important distinction:

``` text
rework observed
        ≠
rework cause recorded
```

The retro treats that gap as useful evidence instead of hiding it
through inference.

The same GitHub self-review refusal appeared on clean runs as well as
second-pass runs, which further demonstrated that the presence of a
condition is not sufficient evidence that the condition caused
measurable rework.

### Conclusion

In Open Mercato pipeline observability, **missing causal telemetry is
itself a measurable result**.

A useful evidence rule is:

``` text
historical signal proves extra pass
        +
historical record does not prove cause
        ↓
report unexplained rework
        ↓
do not promote inference to recorded fact
```

This directly supports the Lab's evidence discipline:

``` text
● observed behavior
≠
assumed explanation
```

This behavior was **runtime observed in Lesson 13**.

------------------------------------------------------------------------

## Finding 029 --- Pipeline retro is read-only until an explicit human improvement gate

### Question

Does `om-pipeline-retro` automatically turn its findings into tracker
work?

### Evidence

After the Lesson 13 retro completed:

``` powershell
git status --short
```

returned no output.

The retro explicitly reported that it had read the tracker and taken no
tracker action.

Its final step surfaced the top improvement opportunity and asked
whether it should be filed through `om-prepare-issue`.

The Issue was created only after the human explicitly answered:

``` text
Yes. File the top cause with om-prepare-issue.
```

### Observation

The observed boundary was:

``` text
Human
  ↓ INVOKE
om-pipeline-retro
  ↓
read finished pipeline history
  ↓
analyze / classify / rank
  ↓
retro report
  ↓
✕ HUMAN GATE
create improvement issue?
```

The analysis itself remained read-only.

Tracker mutation belonged to a separate capability and required explicit
human authorization.

### Conclusion

Open Mercato separates **autonomous diagnosis** from **authority to
create improvement work**.

`om-pipeline-retro` may autonomously inspect and rank pipeline problems,
but it does not autonomously decide that a new backlog item should
exist.

This creates a clear control boundary:

``` text
observability
        ↓
recommendation
        ↓
✕ HUMAN GATE
        ↓
tracker mutation
```

The read-only boundary and the human gate were **runtime observed in
Lesson 13**.

------------------------------------------------------------------------

## Finding 030 --- The retro-to-issue handoff enriches evidence instead of copying the report

### Question

What happens after a human approves the `om-pipeline-retro` handoff to
`om-prepare-issue`?

### Evidence

In Lesson 13, the human approved the top retro cause for filing.

`om-prepare-issue` then created Issue #13.

The resulting Issue contained more than the retro report. It added:

``` text
duplicate checking
repository-specific affected areas
expected vs actual behavior
root-cause hypothesis
quantitative retro evidence
file-level implementation guidance
compatibility analysis
verification guidance
explicit out-of-scope work
SDLC classification
```

The Issue classified the work as:

``` text
bug
priority-medium
risk-high
```

and persisted a separate label-rationale comment explaining why each
label applied.

No PR pipeline labels and no `in-progress` label were added because the
Issue represented deferred backlog work rather than active execution.

### Observation

The handoff behaved as:

``` text
om-pipeline-retro
        ↓
ranked historical evidence
        ↓
✕ HUMAN GATE
        ↓
om-prepare-issue
        ↓
inspect current repository contracts
        ↓
transform evidence into actionable work
        ↓
Issue #13
```

This is not a simple serialization of the retro report.

`om-prepare-issue` re-contextualized the finding against the current
repository and produced an engineering-ready backlog artifact.

### Conclusion

The `om-pipeline-retro` → `om-prepare-issue` relationship is a
**capability handoff from diagnosis to backlog preparation**.

The first skill answers:

``` text
What recurring pipeline behavior is costing us?
```

The second turns the selected evidence into:

``` text
What exactly should be changed in this repository,
how risky is it,
and how could the change be verified?
```

This enrichment behavior was **runtime observed in Lesson 13**.

------------------------------------------------------------------------

## Finding 031 --- Continuous improvement can improve the telemetry consumed by future retros

### Question

Can the output of a pipeline retro improve the quality of future
pipeline retros?

### Evidence

Lesson 13 reported:

``` text
declared-outcome coverage = 0%
```

Issue #13 proposed preserving a machine-readable verdict on the degraded
self-review path using markers already recognized by the retro
classifier:

``` text
Outcome: clean
Outcome: recovered
Outcome: blocked
```

The Issue analysis stated that the existing classifier already parses
this marker family, so the proposed change would not require a
classifier modification.

The improvement itself was not implemented during Lesson 13.

### Observation

The proposed feedback relationship is:

``` text
delivery run
        ↓
machine-readable Outcome telemetry
        ↓
future om-pipeline-retro
        ↓
better historical classification
        ↓
better improvement evidence
```

This means the improvement backlog generated from observability evidence
can target the observability mechanism itself.

### Conclusion

Open Mercato's pipeline-retro capability supports a genuine
**continuous-improvement feedback loop** in which retrospective evidence
can identify changes that improve the quality of future retrospective
evidence.

However, only the discovery and Issue preparation were observed.

The effect of the proposed `Outcome:` markers on a later retro remains:

``` text
◌ NOT TESTED
```

because Issue #13 was deliberately not implemented as part of the Lesson
13 exercise.

------------------------------------------------------------------------

## Finding 032 --- Improvement discovery and improvement execution are separate human-controlled lifecycles

### Question

After a retro finding becomes an improvement Issue, does the pipeline
automatically execute that improvement?

### Evidence

Lesson 13 ended after `om-prepare-issue` created Issue #13.

The Issue itself suggested possible pickup paths such as
`om-auto-fix-issue`, but no implementation skill was invoked.

No implementation branch or improvement PR was created.

### Observation

The complete observed boundary was:

``` text
finished delivery history
        ↓
om-pipeline-retro
        ↓
improvement evidence
        ↓
✕ HUMAN GATE
        ↓
om-prepare-issue
        ↓
improvement backlog artifact
        ↓
✕ HUMAN GATE
        ↓
STOP
```

The first gate controls whether evidence becomes backlog work.

The second gate controls whether backlog work becomes active delivery.

### Conclusion

Open Mercato separates:

``` text
discover improvement
        ≠
record improvement
        ≠
execute improvement
```

This keeps continuous-improvement analysis autonomous while preserving
human authority over backlog creation and implementation priority.

The two-gate boundary was **runtime observed in Lesson 13**. Execution
of Issue #13 was intentionally not tested.

------------------------------------------------------------------------

## Finding 033 --- `om-brainstorm` shapes the problem before routing delivery

### Question

Does `om-brainstorm` mainly elaborate a proposed solution, or can it
change the problem definition before any Issue, Spec, implementation, or
PR exists?

### Evidence

Lesson 14 runtime-tested `om-brainstorm` with the real Learning Lab
question:

``` text
Should the Learning Lab have a simple dashboard or status summary?
```

Before recommending work, the skill inspected the repository and tracker
and found existing status surfaces including `lab-status.ps1`,
`lab-report.ps1`, the Learning Map, and existing Issues.

The conversation then reframed the problem twice.

The initial framing was:

``` text
we may need a dashboard
```

The first reframing was:

``` text
we may lack a reliable source of truth for learning status
```

After further repository inspection and the challenger step, the final
diagnosis became:

``` text
the coverage record already exists in the Learning Map
        ↓
the real problem is stale facts + poor discoverability
```

### Observation

`om-brainstorm` did not accept the proposed artifact as the problem
definition.

It used repository evidence, clarification questions, alternatives, and
challenge to reduce uncertainty before selecting a delivery route.

### Conclusion

`om-brainstorm` is an **idea-shaping and routing capability**, not a
feature-generation shortcut.

Its observed role is:

``` text
rough idea / question
        ↓
clarify the actual need
        ↓
inspect existing reality
        ↓
compare alternatives
        ↓
challenge the leading direction
        ↓
select the smallest justified route
```

This behavior was **runtime observed in Lesson 14**.

------------------------------------------------------------------------

## Finding 034 --- The challenger step is a real decision-quality gate, not ceremonial critique

### Question

Can the challenger materially change the preferred direction?

### Evidence

During Lesson 14, the conversation initially converged on creating:

``` text
LEARNING-STATUS.md
```

as a manually maintained source of truth.

The challenger forced a deeper check of:

``` text
learning-map/om-skills-learning-map-v16.html
```

That inspection showed that the map already carried the same
`OBSERVED / DOCUMENTED / NOT TESTED` evidence model, per-skill coverage,
and learning gaps that the proposed new file was intended to hold.

The agent explicitly acknowledged that its earlier diagnosis had been
partly wrong and withdrew the previously favored new-file design.

### Observation

The challenger did not merely list generic risks.

It attacked a key premise, demanded evidence from the repository, and
caused the preferred solution to be abandoned.

The winning direction changed from:

``` text
create a new status source
```

to:

``` text
keep the existing Learning Map as the coverage source
and fix stale navigation / facts around it
```

### Conclusion

The challenger is a **decision-quality gate** whose purpose is to test
the strongest current direction against overlooked evidence and
assumptions.

A useful observed model is:

``` text
leading direction
        ↓
DELEGATES → challenger
        ↓
attack assumptions / inspect counter-evidence
        ↓
direction survives OR changes
```

In Lesson 14 the direction **changed**, so the challenger behavior is
runtime observed rather than merely documented.

------------------------------------------------------------------------

## Finding 035 --- `build nothing` is a genuine brainstorm outcome

### Question

Does `om-brainstorm` assume that every idea should become a new artifact
or implementation?

### Evidence

The Lesson 14 brainstorm considered several possible solutions:

``` text
derived status from EXPERIMENTS.md
table inside AGENTS.md
new LEARNING-STATUS.md
new dashboard / HTML artifact
reuse the existing Learning Map
do nothing / build nothing
```

The final decision rejected the proposed dashboard and rejected a new
status file.

The only remaining work was a small documentation correction because
`AGENTS.md` and `README.md` contained stale or misleading facts.

### Observation

The original proposed product did not survive the brainstorm.

`build nothing` won for the new status/dashboard capability, while a
smaller existing-information repair remained justified.

### Conclusion

`om-brainstorm` can legitimately conclude that the proposed capability
should **not be built**.

Its routing objective is therefore not:

``` text
idea → choose how to implement it
```

but closer to:

``` text
idea
  ↓
is new work justified?
  ├─ no → build nothing / minimal correction
  └─ yes → choose an appropriate downstream capability
```

This behavior was **runtime observed in Lesson 14**.

------------------------------------------------------------------------

## Finding 036 --- Brainstorm routing stops at a human-controlled handoff boundary

### Question

After `om-brainstorm` selects a downstream capability, does it execute
that capability automatically?

### Evidence

Lesson 14 classified the final work as a small, well-understood
documentation change and recommended:

``` text
Next: om-auto-create-pr "Fix stale skill-coverage facts in AGENTS.md and README and make the v16 learning map the lab's orientation surface — brief: .ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md"
```

Before writing the handoff brief, the skill asked the human to confirm
the proposed resolution and command.

After confirmation it wrote:

``` text
.ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md
```

and ended with machine-readable:

``` text
Next: ...
Brief: .ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md
```

It explicitly returned control to the human and did **not** invoke
`om-auto-create-pr`.

### Observation

The observed boundary was:

``` text
Human
  ↓ INVOKE
om-brainstorm
  ↓
clarification + alternatives
  ↓
DELEGATES → challenger
  ↓
routing recommendation
  ↓
✕ HUMAN GATE
confirm direction?
  ↓ YES
ARTIFACT: handoff brief
  ↓
Next: downstream capability
  ↓
STOP
```

The `Next:` line described the recommended next capability; it was not
an automatic delegation.

### Conclusion

`om-brainstorm` separates **autonomous reasoning and routing** from
**authority to begin delivery**.

The handoff brief is the durable bridge between those lifecycles, while
the human retains control over whether the recommended downstream skill
is ever invoked.

This human-gated handoff and non-execution of `om-auto-create-pr` were
**runtime observed in Lesson 14**.

------------------------------------------------------------------------

## Finding 037 --- `om-close-fixed-issues` is a post-merge tracker reconciliation safety net

### Question

Is `om-close-fixed-issues` simply the mechanism that closes every Issue
after a PR merge?

### Evidence

Lesson 15 runtime-tested:

``` text
om-close-fixed-issues --dry-run
```

against the real Learning Lab history for:

``` text
2026-08-10 → 2026-08-17
```

The run inspected:

``` text
10 merged PRs
0 closed-without-merge PRs
0 drafts
```

It found two authoritative PR→Issue close relationships:

``` text
PR #8 → Issue #7
PR #3 → Issue #2
```

Both relationships came from `closingIssuesReferences`.

Both Issues were already closed before the run.

The resulting actions were therefore:

``` text
#8 → #7 → skipped: already CLOSED
#3 → #2 → skipped: already CLOSED
```

with:

``` text
closed 0
commented 0
skipped 2
unmatched-mentions 0
dry-run-would-have 0
```

### Observation

The skill did not treat "nothing to do" as a failure.

It verified that authoritative merged work and tracker state were
already consistent and produced a reconciliation report showing that no
mutation was required.

The runtime model was:

``` text
merged PR history
        ↓
authoritative PR→Issue links
        ↓
current Issue state
        ↓
consistent?
   ┌────┴────┐
  yes       no
   ↓         ↓
 no-op     reconcile
```

### Conclusion

`om-close-fixed-issues` is best understood as a **post-merge tracker
reconciliation safety net**, not merely an Issue-closing helper.

Its responsibility is:

``` text
verify merged-work truth
against tracker truth
        ↓
repair only when inconsistent
```

A clean no-op is a correct steady-state outcome.

This behavior was **runtime observed in Lesson 15**.

------------------------------------------------------------------------

## Finding 038 --- Post-merge Issue closing requires authoritative close evidence, not bare references

### Question

How does `om-close-fixed-issues` avoid closing an Issue merely because a
PR mentions `#N`?

### Evidence

The Lesson 15 dry-run found many `#N` references across the remaining
PRs in the window.

Only these two were treated as authoritative close relationships:

``` text
PR #8 → Issue #7
PR #3 → Issue #2
```

because the tracker supplied `closingIssuesReferences`.

The other `#N` references were ignored for action. They resolved either
to pull requests or already-closed Issues, and none resolved to an open
Issue with an authoritative close signal.

The skill's inspected contract also states:

``` text
closingIssuesReferences
        OR
explicit close keyword + #N
```

as authority, while bare `#N` mentions are non-authoritative.

### Observation

The runtime distinguished:

``` text
"mentions #7"
```

from:

``` text
"Fixes #7"
```

or an equivalent tracker-parsed closing relationship.

No conversational reference was promoted to closing authority.

### Conclusion

Post-merge tracker reconciliation uses an **evidence threshold** for
mutation:

``` text
reference
≠
closure authority
```

The skill requires an authoritative close relationship before it can
close an Issue.

This reduces the risk that ordinary PR cross-references are mistaken for
proof that work is complete.

The safety behavior was **runtime observed in Lesson 15**, while the
broader keyword fallback behavior remains documented.

------------------------------------------------------------------------

## Finding 039 --- `om-auto-update-changelog` is a release-engineering capability, not a simple docs helper

### Question

What does `om-auto-update-changelog` actually do with merged work?

### Evidence

Lesson 15 runtime-tested:

``` text
om-auto-update-changelog
  --since 2026-08-10
  --version 0.1.0
  --dry-run
```

against the same 10 real merged PRs used by `om-close-fixed-issues`.

The skill:

``` text
resolved the release window
enumerated 10 merged PRs
categorized every PR
verified contributor attribution against commit authorship
built a structured release entry
left Highlights as a human-authored TODO
```

The resulting draft contained:

``` text
2 Features
2 Improvements
6 Specs & Documentation entries
1 Contributor
```

The run also carried through the authoritative Issue relationship for PR
#8 as:

``` text
(fixes #7)
```

inside the release entry.

### Observation

The skill did more than edit Markdown formatting.

It interpreted merged delivery history as a release-level representation
of shipped work.

Its observed transformation was:

``` text
merged PR window
        ↓
release boundary
        ↓
category derivation
        ↓
credit verification
        ↓
normalized summaries
        ↓
structured release narrative
```

### Conclusion

`om-auto-update-changelog` is a **Release Engineering / Release
Documentation capability**.

Its core job is not:

``` text
write changelog text
```

but:

``` text
translate merged delivery history
into an auditable release narrative
```

The PR-delivery mechanics remain a downstream concern delegated to
`om-auto-create-pr` in a normal run.

This release-narrative behavior was **runtime observed in Lesson 15**.

------------------------------------------------------------------------

## Finding 040 --- Release-window resolution degrades explicitly when release metadata is missing

### Question

What happens when `om-auto-update-changelog` cannot use the preferred
release reachability model because the repository has no tags?

### Evidence

The Learning Lab has no Git tags.

During Lesson 15, the changelog dry-run reported:

``` text
git describe --tags → no tag
```

and explicitly entered its documented degraded mode.

Instead of silently pretending reachability was available, it built the
window from:

``` text
baseRefName == main
```

within:

``` text
merged:>=2026-08-10
merged:<=2026-08-17
```

All 10 PRs in the repository's window targeted `main`, so for this
repository the degraded fallback selected the same practical set.

### Observation

The missing release metadata changed the execution mode, but the skill
surfaced that fact in the report.

The observed model was:

``` text
preferred release reachability
        ↓
metadata available?
   ┌────┴────┐
  yes       no
   ↓         ↓
normal    explicit degraded mode
window    + report the degradation
```

### Conclusion

Release-window discovery is designed to **degrade transparently rather
than silently**.

This matters because release tooling can otherwise appear correct while
quietly omitting shipped work.

The degraded no-tag path was **runtime observed in Lesson 15**.

------------------------------------------------------------------------

## Finding 041 --- Release contributor credit is evidence-verified rather than copied from PR authorship

### Question

How does `om-auto-update-changelog` decide who should receive release
credit?

### Evidence

The Lesson 15 changelog dry-run performed contributor verification for
all 10 consumed PRs.

The report stated that every credited author was compared against commit
authorship and that all 10 passed:

``` text
Credit verification: 10 checked
0 mismatches
```

All ten PRs resolved to:

``` text
@rafsaw
```

with full commit coverage and no supersede/carry-forward correction
required.

The run found:

``` text
Supersede detections: 0
Merge-capture corrections: 0
```

### Observation

The skill did not simply trust the merged PR's `author` field.

Credit was checked against the actual commits that carried the work.

### Conclusion

Contributor attribution in the release narrative is treated as an
**evidence-backed release artifact**, not a cosmetic field.

A useful model is:

``` text
PR metadata
    +
commit authorship
    +
supersede / attribution rules
        ↓
verified release credit
```

The simple all-credits-match path was **runtime observed in Lesson 15**.
Supersede and carry-forward correction paths remain documented but were
not exercised.

------------------------------------------------------------------------

## Finding 042 --- Post-merge tracker reconciliation and release documentation are sibling capabilities over the same merged history

### Question

Are `om-close-fixed-issues` and `om-auto-update-changelog` a required
sequence?

### Evidence

Lesson 15 ran both skills against the same real Learning Lab merged
history.

`om-close-fixed-issues` interpreted the history as:

``` text
Which authoritative PR→Issue relationships exist,
and is the tracker already correct?
```

Its result was:

``` text
2 authoritative links
both already satisfied
0 mutations required
```

`om-auto-update-changelog` interpreted the same history as:

``` text
What shipped in this release window,
how should it be categorized,
and who should be credited?
```

Its result was a complete draft release entry.

Neither skill delegated to the other.

The changelog skill's documented downstream delegation is to:

``` text
om-auto-create-pr
```

for PR mechanics in a real run.

### Observation

The two skills share an evidence surface:

``` text
merged PR history
```

but reconcile different project surfaces:

``` text
tracker state
```

and:

``` text
release documentation
```

### Conclusion

The Lesson 15 relationship is:

``` text
                    MERGED PR HISTORY
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
 om-close-fixed-issues      om-auto-update-changelog
              │                         │
 tracker reconciliation        release narrative
```

They are **siblings**, not a mandatory sequence, not alternatives, and
neither automatically invokes the other.

This relationship was **runtime observed in Lesson 15**.

------------------------------------------------------------------------

## Finding 043 --- Dry-run can expose almost the full post-merge execution model without manufacturing release work

### Question

Can post-merge skills be meaningfully learned without creating synthetic
Issues, releases, or repository mutations?

### Evidence

Both Lesson 15 runtime experiments were executed with:

``` text
--dry-run
```

`om-close-fixed-issues` still performed:

``` text
repo/context resolution
window discovery
PR enumeration
authoritative-link extraction
Issue-state checks
action classification
final reconciliation report
```

but made no tracker mutation.

`om-auto-update-changelog` still performed:

``` text
release-window resolution
PR enumeration
categorization
credit verification
draft entry construction
per-PR audit
```

but:

``` text
did not create CHANGELOG.md
did not invoke om-auto-create-pr
did not create a PR
```

### Observation

The high-value reasoning and state-reconciliation parts of both skills
were observable independently from their mutation/delivery mechanics.

This allowed the Learning Lab to use existing real history rather than
inventing work merely to trigger a side effect.

### Conclusion

For lifecycle discovery, `--dry-run` can act as a **high-fidelity
observation boundary**:

``` text
real repository history
        ↓
real execution model
        ↓
real classification / draft artifacts
        ↓
no mutation
```

This supports the Learning Lab principle:

``` text
learn capability boundaries
≠
execute every discovered action
```

The usefulness of dry-run as a post-merge learning strategy was
**runtime observed in Lesson 15**.

------------------------------------------------------------------------

## Finding 044 --- `om-merge-buddy` separates PR portfolio visibility from individual-PR execution

### Question

Where does `om-merge-buddy` sit relative to PR skills such as
`om-pr-autopilot`, `om-auto-fix-pr`, and `om-approve-merge-pr`?

### Evidence

Lesson 16 inspected `om-merge-buddy` and then runtime-tested it against
the Learning Lab's natural repository state.

At runtime the repository contained:

``` text
0 open PRs
```

The skill still resolved and reported the repository-level readiness
context:

``` text
Labels gate: enabled
QA gate: disabled (qaGate: false)
```

It then returned:

``` text
Ready to Merge  0
Almost Ready    0
Blocked         0
```

The report also noticed local uncommitted installation work:

``` text
skills-lock.json modified
.agents/skills/om-merge-buddy/ untracked
```

but explicitly treated that work as outside the skill's scope.

It suggested `om-check-and-commit` or `om-auto-create-pr` as possible
next actions without invoking either capability.

The inspected skill contract documents that, when open PRs exist,
readiness is computed from signals including review state, required CI,
mergeability / merge state, blocking labels, and the configured QA gate.

### Observation

The runtime boundary was:

``` text
Human
  ↓ INVOKE
om-merge-buddy
  ↓
scan repository-wide open PR queue
  ↓
evaluate merge-readiness context
  ↓
Ready / Almost Ready / Blocked report
  ↓
✕ HUMAN GATE
  ↓
optional individual-PR action
```

`om-merge-buddy` did not create a PR, modify a PR, add labels, claim
work, repair a PR, or merge anything.

This differs from the one-PR action layer:

``` text
om-pr-autopilot
om-auto-fix-pr
om-approve-merge-pr
```

which operates after a particular PR has been selected for action.

### Conclusion

`om-merge-buddy` is a **Merge Readiness Visibility / PR Portfolio
Triage** capability.

Its responsibility is:

``` text
observe the open PR portfolio
        ↓
compute / summarize readiness
        ↓
support a human choice
```

rather than:

``` text
select one PR
        ↓
repair / orchestrate / merge it
```

The repository-wide read-only scan, empty-queue report, gate-context
reporting, non-mutation behavior, and treatment of local work as out of
scope were **runtime observed in Lesson 16**.

The actual classification of real PRs into `Ready`, `Almost Ready`, and
`Blocked` remains **documented but not runtime-tested**, because the
Learning Lab had no open PRs during the experiment.
