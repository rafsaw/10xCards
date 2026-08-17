# OM Skills Learning Lab -- Experiments

A log of hands-on Open Mercato pipeline exercises: what was attempted,
what actually happened, and what came of it.

This is the companion to `FINDINGS.md`. A **finding** is a conclusion
reached by reading --- a question answered from the documentation. An
**experiment** is a conclusion reached by running something and watching
the result. When an experiment produces a durable insight about how Open
Mercato works, record the run here and the insight there. The split
applies from here on: entries already in `FINDINGS.md` predate it and
are not moved back.

Number experiments sequentially (`001`, `002`, ...), append new entries
to the end of this file, and separate each one from the entry above it
with a `---` rule --- the same convention `FINDINGS.md` uses. The first
real run is `001`; the skeleton below is a template, not an entry, so
nothing is holding that number.

## Entry template

Copy this for a new entry and replace `NNN` with the next number:

``` markdown
## Experiment NNN

### Goal

_What was being tried, and what outcome was expected._

### Observations

_What actually happened while running it — commands, output, surprises._

### Result

_What the experiment settled: confirmed, refuted, or inconclusive._
```

------------------------------------------------------------------------

## Experiment 001

### Goal

Run a real repository change through the Open Mercato PR pipeline and
observe the pipeline states, claims, review loop, and merge behavior.

Two runs are covered, because no single run exercised every stage: the
issue-driven run behind PR #3 (from issue #2), and the branch-driven run
behind PR #4, which had no issue at all.

### Observations

-   A real GitHub issue was claimed before work started --- issue #2 was
    assigned and claimed by comment before the work that became PR #3.
-   Opening the PR applied the expected pipeline, category, QA,
    priority, and risk labels (PR #4).
-   `om-auto-review-pr` claimed the PR while working on it (PR #4).
-   Review moved the PR from `review` to `changes-requested`, applied
    autofixes, re-reviewed it, and moved it to `merge-queue` (PR #4).
-   `om-code-review` acted as the review engine used by
    `om-auto-review-pr`.
-   GitHub rejected formal approval because the PR author and reviewer
    were the same account (PR #4).
-   `om-approve-merge-pr` detected that limitation and asked before
    merging without formal approval (PR #4).
-   Review/autofix used isolated worktrees and left local `review/pr-*`
    branch refs that required cleanup afterwards.

### Result

Confirmed that the Open Mercato pipeline is a stateful workflow
coordinated through GitHub claims and labels. Skills perform specific
stages of the workflow and can hand work from one stage to the next,
including review, autofix, re-review, merge queue, and merge.

## Experiment 002 --- Autonomous issue orchestration from a plain brief

### Goal

Observe how Open Mercato handles a plain problem description end to end
and identify which skill actually orchestrates the issue-driven
workflow.

### Input

Plain problem description:

> The README is too minimal and does not explain the purpose of this
> learning lab or how to navigate it.

The run was started from the primary checkout on `main`. No issue,
branch, worktree, or implementation plan was prepared manually.

### What happened

1.  `om-auto-fix-issue` recognized the input as a plain brief and
    delegated issue creation to `om-prepare-issue`.
2.  `om-prepare-issue` searched for duplicates and created Issue #7 with
    analysis and SDLC classification.
3.  `om-auto-fix-issue` classified the issue into the bug route.
4.  The first run stopped cleanly because required companion skills were
    not installed. No claim, branch, worktree, or PR was left behind.
5.  After installing the missing companions, `/om-auto-fix-issue 7`
    resumed work from the existing issue rather than recreating it.
6.  `om-verify-in-repo` acted as a read-only triage gate.
7.  After triage passed, `om-auto-fix-issue` created an isolated
    temporary worktree and branch
    `fix/issue-7-readme-purpose-and-navigation`.
8.  `om-root-cause` produced a read-only analysis brief that was passed
    to `om-fix`.
9.  `om-fix` claimed Issue #7, implemented the change, and ran
    validation.
10. `om-open-pr` created PR #8 and handed the continuous `in-progress`
    lock from the Issue to the PR.
11. The existing review subsystem processed the PR, including one
    autofix and re-review.
12. The run released its lock, removed the temporary worktree, and left
    the primary checkout on `main` untouched.

### Handoff mechanisms observed

The chain used explicit contracts rather than relying only on shared
conversational context:

-   `Issue: #<number> (...)` --- reference handoff.
-   `NO_ACTION_NEEDED` --- clean-stop control signal.
-   `LOW_CONFIDENCE` --- analysis-confidence signal that can propagate
    forward.
-   `Status: ready` / `Status: blocked` --- implementation-state signal.
-   `— PREVIOUS STEP (...) said —` blocks --- verbatim context transfer
    between skills.
-   `in-progress` --- concurrency lock transferred from Issue to PR.

### Additional observations

-   `om-auto-fix-issue` does not install missing companions at runtime.
    Missing required skills cause a clean stop.
-   Claiming occurs only when implementation begins in `om-fix`;
    read-only triage and analysis do not claim the Issue.
-   Worktree isolation keeps the user's primary checkout untouched.
-   GitHub prevents formal self-approval when the same account authors
    and reviews the PR.
-   `om-fix` requires regression tests, but this documentation-only
    repository has no test runner. The configured `git diff --check`
    gate and manual documentation checks were used instead.

------------------------------------------------------------------------

## Experiment 003 --- Autonomous feature specification lifecycle

### Goal

Start from a small real feature brief and observe how Open Mercato turns
feature intent into an approved specification without implementing the
feature.

The chosen feature was **Learning Lab Status**: a lightweight way to
check whether the Open Mercato Skills Learning Lab is ready for the next
learning session.

### Input

The run started from a plain feature brief:

> Add a simple way to check the current status of the Open Mercato
> Skills Learning Lab.
>
> I want to quickly see whether the repository is ready for the next
> learning session, including basic repository state, installed Open
> Mercato skills, and the latest recorded experiment and finding.
>
> Keep the feature lightweight and appropriate for this learning-lab
> repository.

No Issue or implementation branch was created manually.

### What happened

1.  `om-auto-write-spec` accepted the plain brief and ran the
    feature-design flow autonomously.
2.  It created an isolated spec worktree and branch
    `spec/lab-status-check`.
3.  `om-spec-writing --autonomous` produced
    `.ai/specs/2026-08-13-lab-status-check.md`.
4.  The autonomous run resolved seven Open Questions using reversible
    defaults and surfaced those decisions in the spec and PR.
5.  `om-open-pr` published PR #9 as a design-only spec PR. No feature
    code was implemented.
6.  The first autonomous design chose a POSIX
    `.ai/scripts/lab-status.sh` implementation and included a broader
    set of readiness checks.
7.  `om-spec-writing` was run again in architectural-review mode without
    modifying the spec. It found no Critical issues, but identified four
    High findings and several Medium/Low findings affecting correctness
    and testability.
8.  Human review overrode two important design decisions:
    -   use Windows PowerShell 5.1 and `.ai/scripts/lab-status.ps1`,
    -   reduce Phase 1 to the smallest useful status capability.
9.  `om-spec-writing` amended the existing specification in place
    instead of creating a new spec.
10. During the amendment, repository probing discovered that the current
    `.claude/skills/` discovery entries are NTFS junctions rather than
    symbolic links. The design was updated to accept both link types and
    verify their resolved targets.
11. Two additional small contract amendments corrected PowerShell
    unsupported-parameter behavior so the spec does not promise an exit
    code the script cannot control.
12. The amended spec was committed and pushed to the existing spec
    branch.
13. `om-open-pr` detected and reused existing PR #9, refreshing its body
    and labels instead of opening a duplicate PR.
14. `om-approve-merge-pr` attempted formal approval. GitHub rejected
    self-approval because the same account authored the PR.
15. After explicit confirmation, PR #9 was squash-merged into `main` and
    the remote spec branch was deleted.
16. The final merged PR remained design-only: the approved specification
    landed on `main`, while feature implementation was deliberately
    deferred to a later lesson.

### Observations

-   `om-auto-write-spec` is a high-level feature-design orchestrator,
    not merely a Markdown generator.
-   `om-spec-writing` has distinct autonomous writing and
    architectural-review behaviors.
-   Autonomous Open Questions can be resolved with reversible defaults
    instead of blocking an unattended run.
-   Human decisions can override autonomous defaults and trigger an
    in-place spec amendment.
-   An architectural review can find technical correctness issues
    without necessarily catching product/context choices such as the
    preferred implementation language or desired scope.
-   The spec lifecycle is isolated from feature implementation: PR #9
    contained only the specification.
-   Runtime repository probing can invalidate documentation assumptions;
    the Windows checkout used NTFS junctions where the docs said
    symlinks.
-   `om-open-pr` can reuse an existing PR and refresh stale PR metadata
    after the underlying spec changes.
-   GitHub still prevents same-account formal approval;
    `om-approve-merge-pr` surfaced the limitation and asked before
    proceeding.

### Result

Confirmed that Open Mercato provides a complete autonomous **feature
specification lifecycle** before implementation:

`brief → autonomous spec → review → human override → amendment → spec PR → merge`

The experiment also confirmed that autonomous design is not treated as
final authority. The specification remains a durable, reviewable
artifact that can be corrected by architectural review, runtime
evidence, and human product judgement before implementation starts.

`om-auto-implement-spec` was not installed or run in this lesson and
remains untested for the next lesson.

------------------------------------------------------------------------

## Experiment 004 --- Autonomous spec implementation lifecycle

### Goal

Observe how Open Mercato takes an approved specification already merged
to `main` and turns it into a controlled implementation run.

The experiment focused on the fresh implementation path:

``` text
approved spec
→ om-auto-implement-spec
→ om-auto-create-pr
→ implementation PR
```

Resume behavior through `om-auto-continue-pr` was intentionally left for
a separate experiment.

### Starting state

The repository was on a clean `main` branch, up to date with
`origin/main`.

The approved specification already existed on `main`:

``` text
.ai/specs/2026-08-13-lab-status-check.md
```

The specification came from the design-only PR:

``` text
#9 — docs(specs): lab status check
```

The implementation skills had been installed before the experiment:

``` text
om-auto-implement-spec
om-auto-create-pr
```

No implementation branch, worktree, execution plan, Issue, or
implementation PR was created manually.

### Run

The approved specification was passed directly to:

``` text
om-auto-implement-spec .ai/specs/2026-08-13-lab-status-check.md
```

`om-auto-implement-spec` resolved the specification by its exact
repository-relative path.

The spec PR was already merged, so the specification was available on
`main` and did not need to be materialized from a separate spec branch.

No existing implementation PR referencing the specification was found,
so the orchestrator selected the fresh implementation path:

``` text
om-auto-implement-spec
→ om-auto-create-pr
```

### Engine selection

`om-auto-create-pr` generated an execution plan from the specification's
`Implementation Plan`.

The resulting plan contained:

``` text
5 Steps
```

The configured threshold was:

``` text
engine.loopStepThreshold = 20
```

`--loop` was not supplied.

The selected engine was therefore:

``` text
Engine: om-auto-create-pr (steps: 5, --loop: no)
```

`om-auto-create-pr-loop` was not exercised.

### Branch and isolated worktree

The implementation used the branch:

``` text
feat/lab-status-check
```

An isolated implementation worktree was created under:

``` text
.ai/tmp/om-auto-create-pr/
```

The primary checkout remained on `main`.

The temporary implementation worktree was removed at the end of the run.
A later:

``` text
git worktree list --porcelain
```

showed only the primary repository worktree.

### Durable execution plan

The first commit on the implementation branch was:

``` text
7c22dd7 docs(runs): add execution plan for lab-status-check
```

This confirmed that the execution plan became a durable repository
artifact before feature implementation commits were created.

The plan tracked implementation progress and was updated as work
completed.

### Incremental implementation

The implementation proceeded through incremental commits:

``` text
ef6114b feat(scripts): add lab-status.ps1 skeleton with anchor check and verdict
c346238 feat(scripts): report branch and working-tree state in lab-status
6af942f feat(scripts): check skill discovery resolution and lockfile drift
f697ca6 feat(scripts): report the latest recorded experiment and finding
a347cc6 docs(readme,agents): point at lab-status.ps1 as the session-readiness check
```

After the implementation phase completed, Progress was recorded
separately:

``` text
eda21c4 docs(runs): mark lab-status-check Phase 1 complete
```

This provided a durable relationship between the execution plan,
completed implementation work, and Git history.

### Validation

The repository-configured validation gate was:

``` text
git diff --check
```

It passed.

The run additionally performed specification-specific verification,
including PowerShell parsing and execution against multiple
repository-state scenarios.

### Review/autofix

The implementation then entered the already-known downstream review
subsystem:

``` text
om-auto-review-pr --autofix
```

The first review requested changes.

A real Windows PowerShell 5.1 compatibility issue was identified:
repository Markdown files encoded as UTF-8 without BOM were being read
using the host's default encoding.

The fix was committed as:

``` text
4a2e036 fix(scripts): read repository text as UTF-8 regardless of the host code page
```

The execution plan was updated again to record the review autofix:

``` text
fdf642b docs(runs): record the review autofix commit
```

The subsequent review passed.

GitHub did not allow the automation account to formally approve its own
PR. The review verdict was therefore represented through PR conversation
comments and pipeline state rather than a native approving review.

### Implementation PR

The implementation was published separately from the design PR:

``` text
#10
```

on:

``` text
feat/lab-status-check
```

The implementation PR referenced the approved specification, while spec
PR `#9` remained design-only.

`om-auto-implement-spec` also posted an implementation cross-link on
spec PR `#9`.

The final implementation PR was left ready for human review/merge.

### UI verification

UI verification was not run.

The implementation consisted of a PowerShell terminal script and
documentation pointers and did not modify an application UI.

The run therefore reported:

``` text
UI: n/a
```

and used `skip-qa`.

### Observed flow

``` text
approved spec on main
        ↓
om-auto-implement-spec
        ↓
resolve spec
        ↓
search for existing implementation
        ↓
no implementation PR
        ↓
om-auto-create-pr
        ↓
execution plan from spec
        ↓
5 Steps
        ↓
flat engine selected
        ↓
isolated worktree
        ↓
feat/lab-status-check
        ↓
execution-plan commit
        ↓
draft implementation PR
        ↓
incremental implementation commits
        ↓
Progress update
        ↓
validation
        ↓
review / autofix
        ↓
Progress update
        ↓
ready implementation PR
        ↓
temporary worktree cleanup
```

### Evidence status

Observed in this experiment:

``` text
● om-auto-implement-spec resolving an approved spec from main
● fresh-run routing to om-auto-create-pr
● execution-plan generation from the spec
● Step counting and flat-engine selection
● isolated implementation worktree
● separate feat/ implementation branch
● execution plan committed before implementation code
● incremental implementation commits
● durable Progress tracking
● validation before completion
● downstream review/autofix
● separate design and implementation PRs
● ready implementation PR
● temporary worktree cleanup
```

Documented but not exercised:

``` text
○ om-auto-create-pr-loop
○ automatic routing for plans above the Step threshold
○ --loop
○ --force
```

Not tested:

``` text
◌ om-auto-continue-pr resume path
◌ om-auto-continue-pr-loop
◌ interruption and resume behavior
◌ claim-conflict behavior
◌ implementation from an unmerged spec PR
```

------------------------------------------------------------------------

## Experiment 005 --- Loop implementation engine and durable execution protocol

### Goal

Observe the runtime behavior of `om-auto-create-pr-loop` during a real
feature implementation and verify whether it uses a meaningfully
different execution model from the plain `om-auto-create-pr` engine.

The experiment deliberately focused on the loop concept itself.
Interruption/resume, stale locks, and `om-auto-continue-pr-loop` were
left out of scope.

### Starting point

A new Learning Lab feature was first described as a normal feature brief
and passed through the already-known design path:

``` text
feature brief
    ↓
om-auto-write-spec
    ↓
design-only spec PR #11
```

The resulting specification was:

``` text
.ai/specs/2026-08-15-lab-report.md
```

It designed a read-only Windows PowerShell 5.1 script:

``` text
.ai/scripts/lab-report.ps1
```

The spec PR remained open and design-only.

### Run

The implementation was started through the normal spec implementation
entry point, but with loop execution explicitly forced for the
experiment:

``` text
om-auto-implement-spec .ai/specs/2026-08-15-lab-report.md --loop
```

`om-auto-implement-spec` resolved the specification from the supplied
path.

Because the spec was not yet on `main`, it was materialized into the
implementation worktree from spec PR #11 for reference only and was not
committed to the implementation branch.

The fresh implementation route delegated to `om-auto-create-pr`, and the
forwarded `--loop` flag caused an immediate handoff to:

``` text
om-auto-create-pr-loop
```

The engine report was:

``` text
Engine: om-auto-create-pr-loop (steps: n/a, --loop: yes)
```

The Step count is `n/a` because `--loop` forced the handoff before the
plain engine drafted and counted a plan.

The loop engine then produced a six-Step implementation plan. Without
`--loop`, this feature would have remained under the configured
threshold of 20 Steps and would have used the plain engine.

### Observed loop execution model

The run used the branch:

``` text
feat/lab-report
```

The implementation used the loop engine's durable run-folder contract
rather than the plain single-plan-file contract.

Observed execution included:

``` text
run folder
    ↓
PLAN.md with authoritative Tasks state
HANDOFF.md
NOTIFY.md
checkpoint state
final-gate state
```

Implementation proceeded Step-by-Step, with one commit per
implementation Step.

The run contained six planned Steps and produced eleven commits in
total, because durable execution-state commits were added alongside the
implementation commits, including the run-folder, checkpoint, and
close-out commits.

A checkpoint fired during the run after the first group of Steps,
exercising the checkpoint-based verification model rather than only
end-of-run validation.

The final gate completed successfully.

### Validation and review

The repository-configured gate:

``` text
git diff --check
```

passed.

Additional verification included PowerShell parsing and a manual
verification fixture covering 28 cases across the implementation Steps
using scratch repositories under `$env:TEMP`.

The verification found real implementation defects before the affected
commits landed, including a version that exited successfully while
producing no output.

The authoritative review path ran through:

``` text
om-auto-review-pr
    ↓
om-code-review
```

The final review verdict was approve.

One major finding about the absence of a test file was waived because
the Learning Lab repository has no test runner or CI. Two minor findings
were fixed in a follow-up commit.

### Implementation PR

The implementation was published as:

``` text
PR #12
```

The spec PR and implementation PR remained separate:

``` text
PR #11 = design-only specification
PR #12 = feature implementation
```

PR #12 was left ready for review.

### Result

Confirmed that `om-auto-create-pr-loop` is not merely the plain
implementation engine running for more iterations.

The loop engine uses a different durable execution contract:

``` text
PLAN / Tasks
    +
HANDOFF
    +
NOTIFY
    +
Step-level commits
    +
checkpoint verification
    +
final gate
        ↓
durable loop execution state
```

The experiment also confirmed that forcing `--loop` is useful for
studying the execution model independently of the Step-count routing
threshold.

Observed in this experiment:

``` text
● --loop forcing handoff to om-auto-create-pr-loop
● loop execution on a real spec implementation
● run-folder durable state
● PLAN.md Tasks-based execution state
● one implementation Step per commit
● checkpoint execution during the run
● final-gate execution
● separate spec and implementation PRs
● ready implementation PR
```

Documented but not exercised:

``` text
○ automatic loop routing when Step count exceeds engine.loopStepThreshold
○ executor subagent dispatch
○ Simple → Spec-implementation promotion
```

Not tested:

``` text
◌ interruption and resume
◌ om-auto-continue-pr-loop runtime behavior
◌ multi-session handoff
◌ stale-lock recovery
```

------------------------------------------------------------------------

## Experiment 006 --- QA environment discovery and no-app boundary

### Goal

Test how `om-prepare-test-env` consumes the repository's QA-related
configuration and observe its runtime behavior when the repository has
no runnable application.

The experiment was intentionally scoped to environment discovery and QA
configuration rather than a full browser-driven QA run.

The main question was:

``` text
agentic.config.json
        ↓
om-prepare-test-env
        ↓
can it produce an honest runtime contract
for this repository?
```

### Starting state

The Learning Lab configuration already contained:

``` text
paths.qa         = .ai/qa
paths.scripts    = .ai/scripts
browser.provider = agent-browser
qaGate           = false
```

The repository itself had no application runtime.

A recursive check found no common application or environment
definitions:

``` text
no package.json
no *.csproj / *.sln
no Dockerfile
no docker-compose*.yml / compose*.yml
no pyproject.toml / requirements.txt
no Cargo.toml
```

The repository also had no `.github/workflows/` directory.

`AGENTS.md` and `README.md` both documented that the Learning Lab
contains no application source tree or test suite.

The only browsable artifacts were the self-contained Learning Map HTML
files under:

``` text
learning-map/
```

### Run

`om-prepare-test-env` performed repository discovery and reported the
runtime facts it found.

It identified that there was no actual application to bring up, but also
noticed that the self-contained Learning Map HTML files could
technically be served over HTTP.

Rather than silently inventing a target, the skill surfaced an explicit
choice:

``` text
There is no app in this repo. What should the generated test environment actually bring up?

1. Static server for learning-map/
2. Static server for repo root
3. No app — record the gap
```

The selected answer was:

``` text
No app — record the gap
```

The skill then asked which script flavor should be used if environment
scripts were ever generated for this repository.

The selected answer was:

``` text
PowerShell .ps1
```

This matched the repository's existing Windows PowerShell tooling and
the documented PowerShell 5.1 execution convention.

### Observations

The run completed with:

``` text
no environment applicable
```

and explicitly treated that conclusion as a valid discovery result
rather than a provisioning failure.

No environment scripts were generated:

``` text
.ai/scripts/test-env-up.ps1    → not created
.ai/scripts/test-env-down.ps1  → not created
```

No server was started.

No readiness probe was run.

No base URL was fabricated.

The skill wrote:

``` text
.ai/qa/test-env.json
```

with the observed state:

``` text
status            = no-app
mode              = none
baseUrl           = null
startedByThisRepo = false
startScript       = null
stopScript        = null
services          = []
credentials       = []
testRunner.name   = none
platform          = win32
```

The configured browser provider propagated into the descriptor:

``` text
browser.provider  = agent-browser
browser.installed = false
```

`agent-browser` was deliberately not installed because there was no
application for it to drive.

This avoided downloading and provisioning browser tooling that had no
runtime target.

The descriptor therefore acted as an explicit negative environment
contract:

``` text
status = no-app
baseUrl = null
        ↓
runtime consumers must not attach
```

The skill also created a tracked repo-local extension:

``` text
.ai/skills/om-prepare-test-env/SKILL.md
```

That file persisted the discovery result so future runs do not have to
repeat the same repository analysis.

It recorded:

``` text
the no-application conclusion
supporting repository evidence
machine/tooling facts
PowerShell 5.1 constraints
the chosen .ps1 flavor
instructions for QA consumers
browser-provider deferral
explicit re-attempt triggers
```

The re-attempt triggers include adding a real application manifest,
Docker/Compose setup, CI workflow, changing the relevant `AGENTS.md`
state, or deliberately deciding to serve `learning-map/` as a browser QA
target.

The repository validation gate:

``` text
git diff --check
```

passed.

### Result

Confirmed that `om-prepare-test-env` consumes the repository's QA
environment configuration and can produce an honest runtime contract
even when no runnable application exists.

The observed runtime path was:

``` text
agentic.config.json
        ↓
om-prepare-test-env
        ↓
repository discovery
        ↓
no runnable application
        ↓
explicit human target decision
        ↓
no fake server
no fake baseUrl
no fake readiness
        ↓
test-env.json
status = no-app
baseUrl = null
```

The experiment also confirmed that environment discovery can persist
repository-specific knowledge through a repo-local skill extension
instead of forcing future runs to repeat the same discovery.

Observed in this experiment:

``` text
● om-prepare-test-env repository discovery
● consumption of the configured QA path and browser provider
● explicit no-app decision boundary
● PowerShell .ps1 flavor selection for this Windows repository
● no generated environment scripts when no application exists
● no server or readiness probe when there is no runtime target
● test-env.json written with status=no-app and baseUrl=null
● browser.provider=agent-browser propagated into the descriptor
● browser provider deliberately left uninstalled
● repo-local .ai/skills/om-prepare-test-env/SKILL.md created
● repository-specific evidence and re-attempt triggers persisted
● git diff --check passed
```

Documented but not exercised:

``` text
○ generated test-env-up.ps1 / test-env-down.ps1
○ cold-run environment generation
○ warm-run environment reuse
○ build-cache behavior
○ browser-provider ensure-installed / doctor success path
```

Not tested:

``` text
◌ real runnable application boot
◌ real agent-browser open / snapshot / interact / assert
◌ full om-auto-qa-pr runtime scenario
◌ screenshot evidence and report PASS / FAIL
◌ qaGate=true merge-blocking behavior
◌ self-QA label mutation
◌ om-integration-tests authoring against a real application
```

------------------------------------------------------------------------

## Experiment 007 --- Pipeline retro and continuous-improvement handoff

### Goal

Observe how `om-pipeline-retro` analyzes completed pipeline history,
classifies second-pass/rework behavior, quantifies its cost, and stops
at the human decision boundary before creating improvement work.

The experiment also tested the optional handoff:

``` text
finished pipeline runs
        ↓
om-pipeline-retro
        ↓
ranked causes / rework evidence
        ↓
✕ HUMAN GATE
create improvement issue?
        ↓
om-prepare-issue
        ↓
improvement Issue
        ↓
✕ HUMAN GATE
execute improvement?
```

The improvement itself was deliberately left unimplemented. The purpose
of the exercise was to observe the Pipeline Observability / Continuous
Improvement capability, not to repeat the implementation/review/merge
pipeline.

### Starting state

The Learning Lab already contained enough real pipeline history to avoid
manufacturing a synthetic run.

The 30-day window contained 10 finished pull requests. Nine carried Open
Mercato agent run markers; PR #1 predated the pipeline it configured and
contained no usable agent marker history.

`om-pipeline-retro` was installed and committed separately before the
runtime experiment.

The working tree was clean before the run.

### Retro run

`om-pipeline-retro` used its default 30-day window:

``` text
2026-07-18 → 2026-08-17
```

It examined all 10 finished runs in the window. The configured limit was
not reached.

Of those runs:

``` text
9 = classifiable runs with agent markers
1 = pre-pipeline PR with no usable agent marker history
```

All 10 had reached merge. There were no closed-unmerged requests and no
request carried the `in-progress` label.

The classifier reported complete timestamps and sizes for the nine
classifiable rows and timestamps for all 49 marker comments, so the run
did not degrade its timing calculations to upper bounds.

### Classification result

The nine classifiable runs were categorized as:

``` text
✅ Clean single pass              7 / 9 = 78%
⚠️ Hard recovery                 0 / 9 = 0%
🔁 Loop checkpoints (by design)  0 / 9 = 0%
⛔ Second pass, cause not stated  2 / 9 = 22%
```

The clean-run median time to merge was:

``` text
1.0h
```

The two unexplained second-pass runs were PR #5 and PR #6.

Both ran `om-auto-review-pr` twice, but neither history contained a
formal `CHANGES_REQUESTED`, merge conflict, interruption, declared
recovery outcome, or another recorded hard-recovery signal explaining
why a second full review pass was required.

The retro therefore did not infer a cause that the run history could not
support.

### Rework cost

The two second-pass runs together accounted for:

``` text
1.1h beyond the median clean run
```

The recurring recorded condition was GitHub's refusal to let the
automation formally review a pull request authored by the same GitHub
identity:

``` text
Can not approve your own pull request
```

The same refusal text also existed on clean runs #8 and #12, where it
caused no measurable second-pass cost.

The retro therefore distinguished:

``` text
condition exists
```

from:

``` text
condition caused measurable rework
```

rather than treating every occurrence of the refusal as recovery.

### Observability gap

The most important runtime finding was not a hard pipeline failure but
missing telemetry.

Declared-outcome coverage was:

``` text
0%
```

None of the nine classifiable runs carried an `Outcome:` line.

Because the two second-pass runs lacked a qualifying recorded recovery
reason, both landed in:

``` text
Second pass, cause not stated
```

The retro explicitly refused to guess why those runs re-entered review.

This demonstrated that `cause not recorded` is an observability signal
in its own right: the pipeline history can show that additional work
happened while still being unable to explain why.

### Change-size analysis

The retro grouped runs into:

``` text
0–200 added lines
200–600 added lines
600+ added lines
```

No size bucket contained a hard recovery.

The experiment therefore produced no evidence that change size explained
the observed second-pass cost in this repository.

### Read-only boundary

After the complete retro run:

``` powershell
git status --short
```

returned no output.

The retro also reported that it had taken no tracker action.

This confirmed the runtime boundary:

``` text
Human
  ↓ INVOKE
om-pipeline-retro
  ↓
read finished tracker history
  ↓
classify runs
  ↓
calculate rework evidence
  ↓
ARTIFACT: Pipeline Retro Report
  ↓
✕ HUMAN GATE
```

`om-pipeline-retro` did not create an Issue automatically.

### Human gate and handoff

At the end of the report the skill surfaced the top improvement
opportunity and explicitly asked for human authorization before filing
it.

The human approved the handoff with:

``` text
Yes. File the top cause with om-prepare-issue.
```

Only after that decision did the flow continue to:

``` text
om-prepare-issue
```

`om-prepare-issue` created:

``` text
Issue #13
```

as a durable improvement backlog artifact.

### What the handoff added

The Issue was not a copy of the retro report.

`om-prepare-issue` transformed the historical evidence into
repository-specific engineering guidance by:

-   checking for duplicate Issues and open PRs,
-   inspecting the actual review and pipeline contracts,
-   identifying the concrete change surface,
-   distinguishing expected behavior from actual behavior,
-   recording a root-cause hypothesis,
-   carrying the quantitative retro evidence into the Issue,
-   producing file-level implementation guidance,
-   checking `BACKWARD_COMPATIBILITY.md`,
-   defining verification steps,
-   defining explicit out-of-scope work,
-   classifying the deferred work with category, priority, and risk
    labels.

The resulting classification was:

``` text
🐛 bug
🔹 priority-medium
⚠️ risk-high
```

The label rationale was persisted as a consolidated `om-prepare-issue`
comment.

No PR pipeline labels such as `review`, `qa`, or `merge-queue` were
applied, and no `in-progress` label was applied because the Issue
represented deferred work rather than active implementation.

### Dedupe degradation

During Issue preparation, GitHub's search API returned
`503 Service Unavailable`.

Rather than silently skipping deduplication, `om-prepare-issue` reported
the degradation and fell back to enumerating the repository's complete
Issue history and open PR set.

In this small Learning Lab repository that fallback was sufficient to
establish that no credible duplicate existed.

The degradation was surfaced explicitly rather than hidden.

### Improvement proposed by the Issue

Issue #13 identified a gap between GitHub's self-review restriction and
the pipeline's machine-readable review contract.

The proposed improvement centered on a documented degraded path that
would preserve a parseable verdict when formal self-review cannot be
recorded.

A key proposed telemetry mechanism was the existing retro-readable
marker family:

``` text
Outcome: clean
Outcome: recovered
Outcome: blocked
```

The retro classifier already understands these markers, so the proposed
improvement could make future pipeline history more observable without
requiring a classifier change.

This exposed a closed continuous-improvement relationship:

``` text
delivery run
    ↓
machine-readable outcome telemetry
    ↓
future om-pipeline-retro
    ↓
better classification
    ↓
improvement evidence
    ↓
✕ HUMAN GATE
    ↓
improvement backlog
```

### Result

Confirmed the runtime execution model of Pipeline Observability /
Continuous Improvement:

``` text
finished pipeline history
        ↓
om-pipeline-retro
        ↓
read-only classification
        ↓
rework cost + observability evidence
        ↓
ranked improvement opportunity
        ↓
✕ HUMAN GATE
        ↓ YES
om-prepare-issue
        ↓
repo-aware improvement Issue
        ↓
✕ HUMAN GATE
        ↓
STOP
```

The experiment confirmed that `om-pipeline-retro` does not repair the
pipeline itself. It produces evidence and stops before tracker mutation.

It also confirmed that the optional `om-prepare-issue` handoff is more
than report copying: it turns retro evidence into an actionable,
repository-aware backlog artifact with implementation guidance,
compatibility analysis, and SDLC classification.

Issue #13 was deliberately not executed. That second human gate marked
the end of the exercise.

Observed in this experiment:

``` text
● default 30-day retro window
● complete enumeration of 10 finished PRs
● 9 runs with usable agent markers
● deterministic clean / recovery / loop / unexplained classification
● 7 clean single-pass runs
● 2 second-pass runs with cause not stated
● 0 hard recoveries
● 0 loop-checkpoint classifications
● clean-run median used as the rework baseline
● 1.1h measurable excess time across the two second-pass runs
● 0% declared-outcome coverage
● refusal to infer an unsupported recovery cause
● change-size recovery breakdown
● read-only retro execution
● clean working tree after retro
● HUMAN GATE before improvement Issue creation
● handoff to om-prepare-issue only after explicit approval
● Issue #13 created as a durable improvement artifact
● repo-specific implementation and compatibility analysis added during handoff
● bug / priority-medium / risk-high classification with persisted rationale
● GitHub search 503 surfaced and dedupe fallback used
● second HUMAN GATE before executing the improvement
```

Documented but not exercised:

``` text
○ hard-recovery classification from a recorded merge conflict
○ hard-recovery classification from an interruption or timeout
○ hard-recovery classification from formal CHANGES_REQUESTED
○ loop-checkpoint classification on a qualifying recorded loop run
○ excess-time splitting across multiple recorded causes on one PR
○ fallback ranking by occurrence count when no clean-run baseline exists
```

Not tested:

``` text
◌ implementation of Issue #13
◌ future Outcome: marker emission
◌ re-running om-pipeline-retro after the proposed observability improvement
◌ whether declared-outcome coverage improves after that change
◌ whether future second passes move from unexplained to clean/hard-recovery classifications
```

------------------------------------------------------------------------

## Experiment 008 --- Idea shaping and routing with `om-brainstorm`

### Goal

Observe how `om-brainstorm` handles a real but still ambiguous Learning
Lab idea before Issue, Spec, implementation, or PR work begins.

The starting question was:

``` text
Should our Open Mercato Skills Learning Lab have a simple dashboard
or status summary?
```

The experiment was intentionally scoped to:

``` text
clarification
→ alternatives
→ challenger
→ routing
→ handoff brief
→ HUMAN GATE
```

No downstream delivery skill was to be executed unless it added new
evidence about `om-brainstorm`.

### Starting state

The repository already contained several partially overlapping status
surfaces:

``` text
.ai/scripts/lab-status.ps1
.ai/scripts/lab-report.ps1
learning-map/om-skills-learning-map-v16.html
FINDINGS.md
EXPERIMENTS.md
```

The brainstorm was invoked in Polish and was allowed to inspect the
repository and tracker before asking questions.

### What happened

1.  `om-brainstorm` inspected the repository before asking for more
    detail.
2.  It identified the existing status scripts and Learning Map and
    checked that there was no existing dashboard Issue.
3.  It asked what concrete moment created the need for a dashboard.
4.  The human clarified the real need: after a break, quickly understand
    which capabilities were actually exercised, which were only
    documented/installed, and what the current learning direction is.
5.  The skill inspected the available evidence and initially diagnosed a
    source-of-truth problem.
6.  It compared two status-maintenance models: manually maintained
    evidence vs status derived from `EXPERIMENTS.md`.
7.  The human chose manual evidence because
    `OBSERVED / DOCUMENTED / NOT TESTED` requires semantic judgement and
    cannot safely be inferred from mentions alone.
8.  The conversation then compared where that truth should live,
    including a new `LEARNING-STATUS.md` and `AGENTS.md`.
9.  A new `LEARNING-STATUS.md` became the leading direction.
10. The challenger step tested that direction against repository
    evidence and found that
    `learning-map/om-skills-learning-map-v16.html` already contained the
    same three-state evidence model, per-skill coverage, and learning
    gaps.
11. The agent explicitly corrected its earlier diagnosis and abandoned
    the new-file direction.
12. The final choice was to keep the Learning Map as the coverage source
    and make the smallest correction needed around discoverability and
    stale facts.
13. The original dashboard/status artifact was therefore not built.
14. The remaining work was classified as a small documentation change
    suitable for direct `om-auto-create-pr` routing rather than a new
    specification lifecycle.
15. Before writing the handoff, `om-brainstorm` asked for explicit human
    confirmation of the resolution and proposed command.
16. After confirmation it wrote:

``` text
.ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md
```

17. The final output exposed the downstream route in machine-readable
    form:

``` text
Next: om-auto-create-pr "Fix stale skill-coverage facts in AGENTS.md and README and make the v16 learning map the lab's orientation surface — brief: .ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md"
Brief: .ai/specs/briefs/2026-08-17-lab-orientation-doc-fixes.md
```

18. `om-auto-create-pr` was **not** invoked. Control returned to the
    human.

### Key observation: the problem changed

The brainstorm did not merely refine a dashboard feature.

The problem moved through:

``` text
"maybe build a dashboard"
        ↓
"maybe create a reliable learning-status source"
        ↓
challenger + repository evidence
        ↓
"the source already exists;
stale facts and discoverability are the real problem"
```

This was the central value of the experiment.

### Alternatives and `build nothing`

The conversation considered:

``` text
status derived from EXPERIMENTS.md
status table inside AGENTS.md
new LEARNING-STATUS.md
new dashboard / HTML artifact
reuse the existing Learning Map
do nothing / build nothing
```

The final outcome deliberately created **no new status/dashboard
artifact**.

`build nothing` therefore survived as a real decision for the proposed
new capability. Only the smaller documentation correction remained
justified.

### Challenger behavior

The challenger materially changed the decision.

Before challenge:

``` text
preferred direction = create LEARNING-STATUS.md
```

After challenge:

``` text
preferred direction = do not create another source of truth
```

The challenger found repository evidence that contradicted a key premise
of the earlier reasoning and caused the agent to acknowledge and correct
its own diagnosis.

### Human gate and handoff

The observed end of the brainstorm was:

``` text
IDEA / QUESTION
      ↓
Human → INVOKE
      ↓
om-brainstorm
      ↓
clarification
      ↓
alternatives
      ↓
DELEGATES → challenger
      ↓
routing recommendation
      ↓
✕ HUMAN GATE
      ↓
ARTIFACT: handoff brief
      ↓
Next: om-auto-create-pr
      ↓
STOP
```

The downstream skill was recommended, not automatically delegated.

### Result

Confirmed that `om-brainstorm` is an **idea-shaping and routing
capability** operating before the normal delivery lifecycle.

The experiment showed that it can challenge the proposed solution,
change its own diagnosis when repository evidence contradicts it,
consider `build nothing`, select a smaller route, create a durable
handoff brief, and stop at a human-controlled boundary before delivery.

Observed in this experiment:

``` text
● repository-first inspection
● tracker reality check
● clarification before solution selection
● one-at-a-time conversational decision making
● exploration of multiple alternatives
● manual-vs-derived source-of-truth comparison
● real build-nothing / minimal-change outcome
● challenger step materially changing the preferred direction
● agent correcting its earlier diagnosis
● routing to a small direct implementation/documentation path
● explicit HUMAN GATE before handoff finalization
● durable handoff brief creation
● machine-readable Next: output
● machine-readable Brief: output
● downstream om-auto-create-pr not automatically invoked
```

Not tested:

``` text
◌ routing from om-brainstorm to om-prepare-issue
◌ routing from om-brainstorm to om-auto-write-spec
◌ routing from om-brainstorm to om-spec-writing
◌ execution of the recommended om-auto-create-pr handoff
◌ whether the documentation correction solves orientation after a future break
```

------------------------------------------------------------------------

## Experiment 009 --- Post-merge tracker reconciliation with `om-close-fixed-issues`

### Goal

Observe how `om-close-fixed-issues` reconciles real merged PR history
against GitHub Issue state and determine whether the Learning Lab has
any stale fixed Issues that require post-merge cleanup.

The experiment was deliberately run in:

``` text
--dry-run
```

so the tracker could be inspected without closing Issues, posting
comments, changing labels, or changing assignees.

No synthetic Issue or PR was created for the experiment.

### Starting state

The Learning Lab already had real merged PR history from Lessons 1--14.

The repository had no `CHANGELOG.md`, so the skill's default:

``` text
--since last-release
```

could not resolve a release heading.

The documented fallback therefore selected the last seven days:

``` text
2026-08-10 → 2026-08-17
```

Resolved runtime context was:

``` text
repo          = rafsaw/om-skills-learning-lab
base branch   = main
current user  = rafsaw
labels        = enabled
closeKeywords = []
```

### Run

The invocation was:

``` text
/om-close-fixed-issues --dry-run
```

The window contained:

``` text
10 merged PRs
0 closed-without-merge PRs
0 drafts
```

The merged PRs were:

``` text
#1, #3, #4, #5, #6, #8, #9, #10, #11, #12
```

### Authoritative PR→Issue relationships

The run found two authoritative closing relationships through
`closingIssuesReferences`:

``` text
PR #8 → Issue #7
PR #3 → Issue #2
```

For each pair the skill fetched the current Issue state before deciding
what to do.

Both Issues were already closed.

The resulting audit rows were:

``` text
#8 → #7 → skipped: already CLOSED
#3 → #2 → skipped: already CLOSED
```

### Bare references were not treated as authority

The remaining eight PRs contained various `#N` references.

The skill did not treat those references as permission to close Issues.

Every mentioned number resolved either to:

``` text
a PR in the same repository
```

or:

``` text
an already-closed Issue
```

No mentioned number resolved to an open Issue requiring the
unmatched-mentions diagnostic section.

The final unmatched count was:

``` text
0
```

### No-op steady state

The final counts were:

``` text
closed 0
commented 0
skipped 2
unmatched-mentions 0
dry-run-would-have 0
```

The report explicitly concluded that the window was genuinely quiet.

The two authoritative close links had already been honored, most likely
by GitHub's own close-on-merge semantics, so there was no tracker drift
for the skill to repair.

### Observed flow

``` text
Human
  ↓ INVOKE
om-close-fixed-issues --dry-run
  ↓
resolve repo / base / window
  ↓
enumerate recent PRs
  ↓
extract authoritative close links
  ↓
fetch Issue state
  ↓
#8 → #7 already CLOSED
#3 → #2 already CLOSED
  ↓
bare #N references do not authorize mutation
  ↓
ARTIFACT: reconciliation report
  ↓
STOP
```

### Result

Confirmed that `om-close-fixed-issues` acts as a post-merge tracker
reconciliation capability rather than merely an automatic Issue closer.

The Learning Lab's tracker was already in a consistent steady state, so
the correct result was a no-op.

Observed in this experiment:

``` text
● default last-release fallback to the last 7 days
● repo/base/user context resolution
● enumeration of 10 real merged PRs
● 0 closed-unmerged PRs
● authoritative PR→Issue extraction through closingIssuesReferences
● PR #8 → Issue #7
● PR #3 → Issue #2
● fetch-before-action Issue-state verification
● skip when Issue is already closed
● bare #N mentions not treated as closure authority
● genuine no-op reconciliation result
● dry-run with no mutations
● final per-pair reconciliation report
```

Documented but not exercised:

``` text
○ real automatic Issue close
○ non-base-branch informational comment
○ closed-without-merge informational comment
○ superseded PR comment suffix
○ do-not-close / blocked / in-progress skip
○ unmatched open Issue mention reporting
○ configured non-English closeKeywords
○ claim / lock / release around an actual Issue close
```

Not tested:

``` text
◌ a real stale open Issue that should be closed
◌ tracker mutation path
◌ cross-repository reference handling in runtime
```

------------------------------------------------------------------------

## Experiment 010 --- Release narrative generation with `om-auto-update-changelog`

### Goal

Observe how `om-auto-update-changelog` interprets the same real merged
PR history used by Experiment 009, but as a release-documentation
problem rather than a tracker-reconciliation problem.

The experiment was intentionally run in:

``` text
--dry-run
```

so no `CHANGELOG.md`, branch, commit, or pull request would be created.

The run used an explicit release window and version:

``` text
--since 2026-08-10
--version 0.1.0
```

This avoided manufacturing a release artifact while still exercising the
skill's release-window, categorization, attribution, and draft
generation logic.

### Starting state

The repository had:

``` text
no CHANGELOG.md
no Git tags
10 real merged PRs in the selected window
all 10 PRs targeted main
```

The invocation was:

``` text
/om-auto-update-changelog
  --since 2026-08-10
  --version 0.1.0
  --dry-run
```

with reporting requested in Polish.

### Release-window resolution

The preferred reachability mode could not use a Git tag because:

``` text
git describe --tags → no tag
```

The skill surfaced the documented degraded mode and used:

``` text
baseRefName == main
```

inside the calendar window:

``` text
merged:>=2026-08-10
merged:<=2026-08-17
```

Because all 10 PRs targeted `main`, this fallback selected the complete
practical window for this repository.

The run also confirmed that pagination did not silently truncate the
result:

``` text
10 returned
limit = 250
```

### Categorization

The 10 PRs were categorized as:

``` text
Features
    #12
    #10

Improvements
    #4
    #1

Specs & Documentation
    #11
    #9
    #8
    #6
    #5
    #3
```

The resulting draft release entry was:

``` text
# 0.1.0 (2026-08-17)

## Highlights
<!-- TODO: Highlights — auto-update-changelog leaves this blank for the human author to fill in. -->

## ✨ Features
- Add lab-report Markdown report generator. (#12)
- Add lab-status.ps1 session-readiness check. (#10)

## 🛠️ Improvements
- Vendor the five review and PR-pipeline skills. (#4)
- Configure agent PR pipeline. (#1)

## 📝 Specs & Documentation
- Add spec for lab-report. (#11)
- Lab status check. (#9)
- Explain the lab's purpose and how to navigate the repo (fixes #7). (#8)
- Add v5 visual memory map with operator runbook. (#6)
- Record experiment 001 and finding 004 from the pipeline run. (#5)
- Add experiment log for hands-on pipeline exercises. (#3)
```

All entries credited:

``` text
@rafsaw
```

and the Contributors block contained one deduplicated contributor.

### Credit verification

The skill did not copy the PR `author` field blindly.

It checked every credited author against commit authorship.

The report stated:

``` text
10 credits checked
10 / 10 commit authorship coverage
0 mismatches
```

No carry-forward/supersede correction was needed.

The run reported:

``` text
Supersede detections: 0
Merge-capture corrections: 0
```

### Human boundary

The generated block intentionally left:

``` text
## Highlights
<!-- TODO: Highlights ... -->
```

for human authorship.

This exposed a release-specific control boundary:

``` text
automation owns:
facts / categorization / attribution

human owns:
release Highlights / narrative emphasis
```

### Downstream delegation boundary

The dry-run report described what a normal run would have done next:

``` text
create/update CHANGELOG.md
        ↓
DELEGATES
om-auto-create-pr
        ↓
docs-only PR mechanics
```

but because `--dry-run` was set:

``` text
CHANGELOG.md was not created
om-auto-create-pr was not invoked
no PR: chaining line was emitted
```

### Comparison with Experiment 009

Both experiments consumed the same real merged history.

Experiment 009 asked:

``` text
Is the tracker consistent with authoritative merged work?
```

Experiment 010 asked:

``` text
What shipped, how should it be grouped,
and who should receive release credit?
```

The shared evidence surface therefore branched into two independent
post-merge capabilities:

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

### Result

Confirmed that `om-auto-update-changelog` is a Release Engineering
capability that builds an auditable release narrative from merged PR
history.

It also confirmed that the post-merge lifecycle is not a single chain:
tracker reconciliation and release documentation are sibling
capabilities over the same merged evidence.

Observed in this experiment:

``` text
● explicit release window and version
● no-tag degraded release-window mode
● complete enumeration of 10 real merged PRs
● category derivation across all 10 PRs
● structured release-section generation
● authoritative fixes #7 suffix carried into the release entry
● contributor deduplication
● 10/10 contributor-credit verification against commits
● no supersede/carry-forward correction needed
● human-owned Highlights boundary
● full in-memory CHANGELOG draft
● dry-run prevented file mutation
● dry-run prevented delegation to om-auto-create-pr
● same merged history interpreted differently from tracker reconciliation
● sibling relationship with om-close-fixed-issues
```

Documented but not exercised:

``` text
○ real CHANGELOG.md creation/update
○ delegation to om-auto-create-pr
○ resulting docs PR
○ review of the generated changelog PR
○ release-window reachability from an actual tag
○ version inference from a project manifest
○ disagreement gate between changelog heading date and tag date
○ supersede credit rule
○ carry-forward attribution correction
○ existing changelog format preservation
```

Not tested:

``` text
◌ actual release publication
◌ human-written Highlights
◌ whether the generated 0.1.0 narrative would be accepted unchanged
```

------------------------------------------------------------------------

## Experiment 011 --- Empty-queue PR portfolio triage with `om-merge-buddy`

### Goal

Touch the runtime behavior of `om-merge-buddy` without manufacturing
synthetic pull requests.

The experiment was intentionally small because the Learning Lab does not
currently have a large PR queue. The goal was to verify the skill's
repository-wide, read-only boundary and observe its behavior when there
is naturally nothing to triage.

### Starting state

The repository had:

``` text
0 open PRs
```

The installed configuration exposed:

``` text
labels gate = enabled
qaGate      = false
```

The skill installation itself had left local uncommitted work:

``` text
skills-lock.json modified
.agents/skills/om-merge-buddy/ untracked
```

Those changes were not on a PR.

### Run

The skill was invoked with no PR number or additional target:

``` text
om-merge-buddy
```

It queried the repository's open PR set and reported:

``` text
gh pr list --state open returned an empty set
```

The resulting report was:

``` text
Merge Buddy Report — 2026-08-17

Ready to Merge  0
Almost Ready    0
Blocked         0
```

The skill explicitly concluded that there was nothing to triage.

### Observations

Even with an empty queue, the runtime exposed the intended scope.

The skill operated at repository / portfolio level rather than requiring
a single PR as input.

It reported the active readiness-gate context:

``` text
Labels gate: enabled
QA gate: disabled
```

It did not:

``` text
create a PR
modify a PR
apply labels
claim work
commit local changes
merge anything
```

The skill also noticed the local uncommitted installation changes but
correctly classified them as outside merge-queue scope.

It suggested:

``` text
om-check-and-commit
or
om-auto-create-pr
```

as possible next actions if the human wanted to ship that local work,
but it did not invoke either skill.

### Observed flow

``` text
Human
  ↓ INVOKE
om-merge-buddy
  ↓
scan all open PRs
  ↓
0 open PRs
  ↓
Ready 0 / Almost Ready 0 / Blocked 0
  ↓
report local non-PR work as out of scope
  ↓
STOP
```

### Result

Confirmed the read-only portfolio boundary of `om-merge-buddy` and its
natural empty-queue behavior.

The experiment provides enough runtime evidence to classify the
capability as explored for the Learning Lab without creating artificial
PR volume merely to exercise every classification branch.

Observed in this experiment:

``` text
● repository-wide invocation with no PR number
● open-PR discovery
● natural empty-queue handling
● Ready 0 / Almost Ready 0 / Blocked 0 report
● labels-gate context surfaced
● qaGate=false context surfaced
● no repository or tracker mutation
● local uncommitted work recognized as outside PR-queue scope
● downstream skills suggested but not automatically invoked
```

Documented but not exercised:

``` text
○ classification of a real PR as Ready
○ classification of a real PR as Almost Ready
○ classification of a real PR as Blocked
○ pending CI as the only minor blocker
○ blocking-label behavior against a real PR
○ qaGate=true readiness behavior
```

Not tested:

``` text
◌ multi-PR portfolio triage
◌ large merge queue
◌ human selection of a PR from the report followed by downstream action
```

The deeper classification paths are intentionally deferred until the
Learning Lab naturally has open PR work worth triaging.
