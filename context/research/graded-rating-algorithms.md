# Graded-rating scheduling algorithms: what each requires and what is off the shelf

Research for issue #70, on the map in issue #69. Input to the decision in issue #72 — this
document supplies facts only; it does not pick a candidate.

- **Researched:** 2026-11-25. All version numbers, release dates and package contents were read
  on that date; npm metadata moves, so re-check before implementing.
- **Method:** primary sources only — the official FSRS algorithm wiki (open-spaced-repetition),
  SuperMemo's own SM-2 page, library READMEs, and the published npm tarballs themselves
  (type declarations and `dist/` grepped directly rather than trusting prose).

## 0. The constraint everything is measured against

From the map (issue #69), already decided: migration is strictly progress-preserving. Every
existing card keeps its `next_due_at` **unchanged**; the existing Leitner `box` may only seed the
new algorithm's initial state.

Current state, for reference (`supabase/migrations/20260527150510_cards_and_account_deletion.sql`,
renamed by `20261125120000_cards_rename_repetition_count_to_box.sql`):

| column | type |
| --- | --- |
| `next_due_at` | `timestamptz` (nullable) |
| `interval_days` | `integer not null default 0`, `check (interval_days >= 0)` |
| `box` | `integer not null default 0` (was `repetition_count`) |
| `last_reviewed_at` | `timestamptz` (nullable) |

Scheduler: `src/lib/leitner.ts` — one pure function, `BOX_INTERVALS_DAYS = [1,2,4,7,15,30]`,
6 boxes, `right` promotes one box (capped), `wrong` resets to box 0. No review-history table
exists anywhere in the schema.

**General point that applies to all three candidates.** None of them *needs* `next_due_at` to be
recomputed at migration time. All three are "state in, state out" functions evaluated at review
time. So a migration can write only the new state columns and leave `next_due_at` untouched; the
first rating after the migration is what moves the due date. The seeding question is therefore
purely "what initial state values make the first post-migration interval sane", not "can we avoid
moving the due date" — that is free in every case.

---

## 1. FSRS

Source: <https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm> (the official
wiki; the old `fsrs4anki` wiki page now redirects here). Page last edited **2026-11-16**. It
documents FSRS-7 as current, plus FSRS-6, 5, 4.5, v4, v3, v2, v1, v0.

### Per-card state

Version matters — this is the main place where FSRS claims go stale:

- **FSRS-7:** long-term stability, short-term stability, difficulty `D`. Three floats.
- **FSRS-6:** stability `S`, difficulty `D`. Two floats.
- **v1 only:** also a lapse count.

Retrievability is **not stored** — it is derived from the state plus elapsed time. FSRS-6:
`R(t) = (1 + factor·t/S)^(-w20)`, with `factor` chosen so `R = 90%` at `t = S`. FSRS-7 blends two
power-law curves (short-term and long-term). v3 used `0.9^(t/S)`.

What the `ts-fsrs` `Card` actually persists (read from `ts-fsrs@6.0.1` `dist/index.d.mts`), i.e.
the practical column count if you adopt the library's shape — **9 fields**:

```ts
interface Card {
  due: Date;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;         // 0 New | 1 Learning | 2 Review | 3 Relearning
  last_review?: Date;
}
```

(`ts-fsrs@5.4.2` has the same shape plus a deprecated `elapsed_days`.) Of these, `due` maps to
`next_due_at`, `scheduled_days` to `interval_days`, `last_review` to `last_reviewed_at` — so the
genuinely new columns are `stability`, `difficulty`, `state`, `learning_steps`, `reps`, `lapses`:
four numeric/integer plus two counters. `reps` and `lapses` are bookkeeping, not inputs to the
interval maths in FSRS-6/7.

### Review history

**Not needed to compute the next interval.** Each update takes the previous state, the grade, and
the elapsed days. The wiki's only exceptions are v1 (running lapse count) and v0's adaptive
initial-stability method (regression over past reviews) — neither is current.

**Needed to tune parameters.** Optimising the 34 weights (FSRS-7; FSRS-6 has 21, FSRS-5 19,
v4/4.5 17, v3 13) requires full review logs. That is a separate package,
`@open-spaced-repetition/binding` (latest **0.6.3**, 2026-11-25, MIT): "Node.js bindings for the
FSRS Optimizer implemented in Rust and compiled to WASI", with 11 platform-specific optional
binaries (`darwin-*`, `linux-*`, `win32-*`, `wasm32-wasi`, `wasm32-wasip1`) and `engines: node >= 24`.
Not something to run in a Worker. The map already puts per-user parameter optimisation out of
scope, so this only matters if review logs are kept for *later* tuning.

### Four ratings to an interval

Grades: **Again = 1, Hard = 2, Good = 3, Easy = 4** (confirmed in the wiki and in `ts-fsrs`'s
`Rating` const: `Manual: 0, Again: 1, Hard: 2, Good: 3, Easy: 4`; `grades = [1,2,3,4]`).

- **Stability:** Hard/Good/Easy are successful recalls; each multiplies stability by a factor >= 1,
  with extra multipliers for Hard and Easy. Again is a lapse — stability is capped at a post-lapse
  value never above the prior stability.
- **Difficulty (FSRS-7):** Again raises it, Hard raises it slightly, Good leaves it roughly
  unchanged (small pull toward the Easy baseline), Easy lowers it. Clamped to 1-10.
- **Interval:** v4 `I(r, S) = 9·S·(1/r - 1)`; v3 `I(r, S) = S·ln(r)/ln(0.9)`; both give `I = S` at
  `r = 0.9`. **FSRS-7 has no closed form** — the wiki says intervals are found iteratively by a
  solver targeting the desired retention. Relevant for a hand-rolled implementation: FSRS-7 is not
  a formula you can transcribe into a pure function in an afternoon; FSRS-6 and earlier are.

### A brand-new card

- **FSRS-7:** long-term stability `= w[G-1]`, short-term stability `= 0.8 x` that;
  `D0 = clamp(w4 - e^(w5·(G-1)) + 1, 1, 10)`.
- **v4:** `S0(G) = w[G-1]`, `D0(G) = w4 - (G-3)·w5`.
- **v3:** `S0(G) = w0 + (G-1)·w1`, `D0(G) = w2 + (G-3)·w3`.

Note the shape: the initial state is a function of **the first rating**, not a constant. A card has
no stability/difficulty until it is first rated. In `ts-fsrs` this is `scheduler.newCard({ now })`
(v6) / `createEmptyCard(now)` (v5), which produces `state: New` with placeholder
stability/difficulty, and the first `review()` sets the real values.

### Libraries

**`ts-fsrs`** (open-spaced-repetition, the org that owns the spec):

| | `ts-fsrs@6.0.1` | `ts-fsrs@5.4.2` |
| --- | --- | --- |
| Released | **2026-11-22** | 2026-09-01 |
| Licence | MIT | MIT |
| Dependencies | **1** — `@open-spaced-repetition/srs-kit@1.0.1` (BSD-3-Clause, 0 deps, `engines: node>=20`) | **0** |
| `engines.node` | **`>=24.0.0`** | `>=20.0.0` |
| Unpacked | 848 KB (incl. types + maps); ESM entry `dist/index.mjs` **43 KB**, FSRS-6 model 11 KB, middlewares 32 KB | 706 KB; ESM `dist/index.mjs` **61 KB** |
| FSRS models | 3, 4, 4.5, 5, 6, 7 — `DefaultScheduler()` defaults to **FSRS-7** | 3, 4, 4.5, 5, 6 |
| Formats | ESM + CJS (`exports` map, subpath exports) | ESM + CJS + UMD |

Edge-safety, checked by grepping the published tarballs (not from docs):

- `ts-fsrs@6.0.1` `dist/`: **no `node:` specifiers, no `require("fs"|"path"|"crypto"|...)`, no
  `.wasm`.** Same for `@open-spaced-repetition/srs-kit@1.0.1`.
- `ts-fsrs@5.4.2` `dist/`: same — clean.
- So: no `nodejs_compat` needed on the evidence of the bundle. **Two caveats.**
  1. `engines.node: ">=24.0.0"` on v6. The repo pins Node **22.14.0** (`.nvmrc`), so `npm install`
     will emit `EBADENGINE`; it fails outright only with `engine-strict`. This is a
     declaration, not a runtime import — but it is a friction point, and v5.4.2 (`>=20`) does not
     have it.
  2. v6's `DefaultScheduler()` is **async** and performs `await import("./models/fsrs-7.mjs")`
     (verified in `dist/index.mjs`; all six model versions are dynamically imported). Static-path
     dynamic imports are bundleable, but the scheduler factory returning a `Promise` changes the
     call-site shape versus today's synchronous `schedule()`.
- Neither README mentions Cloudflare Workers, Deno or the browser explicitly; v6's README points at
  "browser/WASI setup" in the binding package. **There is no first-party statement of Workers
  support** — the clean-bundle evidence above is ours, not theirs.

v6 API (from the README, 2026-11): `const scheduler = await DefaultScheduler();
const card = scheduler.newCard({ now }); scheduler.preview({ card, now })` (one entry per grade,
useful for showing "Good -> 4d" on the buttons); `scheduler.review({ card, grade: Rating.Good, now })`
returns `{ card, revlog }` without mutating the input. v5 API: `new FSRS(params).repeat(card, now)`
/ `.next(card, now, grade)`, plus `get_retrievability`, `rollback`, `forget`.

Other FSRS packages found, none from the spec org:

- `fsrs.js` — MIT, 0 deps, latest **1.2.2 (2024-01-21)**, no repository field. Stale.
- `fsrs-algorithm` — MIT, 0 deps, latest **1.1.3 (2025-07-22)**, `github.com/mkamran67/FSRS-algorithm`.
- `@squeakyrobot/fsrs`, `@austinshelby/simple-ts-fsrs` (JSR) — minimal third-party implementations,
  not verified here.

### Seeding from a Leitner box

Clean, with one wrinkle. Because FSRS's initial state is a function of the **first rating**, the
natural seed is `state = New` (`stability`/`difficulty` unset/placeholder) while leaving
`next_due_at` as-is: the card stays due when it was due, and the first graded review initialises
`S0(G)`/`D0(G)`. Cost: the box's accumulated progress is thrown away — a card sitting in box 5
(30-day interval) jumps back to a first-review interval after its next rating.

To actually *carry* the progress you must synthesise a stability. The honest mapping is
`S ~ interval_days` at 90% desired retention, since `I = S` at `r = 0.9` in v3/v4 and the FSRS-6
factor is defined so `R = 90%` at `t = S`. So: `stability = BOX_INTERVALS_DAYS[box]`,
`difficulty =` the FSRS default for `Good` (w4-derived; a mid-scale value such as 5 is defensible
for a training project), `state = Review`, `reps = box`, `lapses = 0`,
`scheduled_days = interval_days`, `last_review = last_reviewed_at`. This is a **fabricated** memory
state, not a derived one — it is a judgement call the ADR should state out loud, not a fact this
research can settle.

**No blocker for the constraint.** `next_due_at` is never read by the seeding step.

---

## 2. SM-2

Source: <https://super-memory.com/english/ol/sm2.htm> — SuperMemo's own description, by Piotr
Wozniak, written **1990** (adapted from his Master's thesis, Poznan University of Technology),
posted to the web **1998-05-10**. The algorithm is frozen; there are no versions to disambiguate.

### Per-card state

**Three fields:** `interval` (days, number), `repetition` number `n` (integer), `efactor` (EF,
float, starts at 2.5, floor 1.3). `interval` already exists as `interval_days`; `repetition` is
arguably what `box` becomes. So SM-2 adds **one new column** (`efactor numeric`), or two if you
decline to reuse `box`.

### Review history

**Not needed for the next interval** — `I(n) = I(n-1) × EF` is a pure function of the three stored
fields and the grade. SM-2 has no parameters to tune, so history is not needed for that either.
History would be kept only for statistics, which the map puts out of scope.

### Grades to an interval

SM-2 is specified on a **0-5 quality scale**, not four buttons: 5 perfect, 4 correct after
hesitation, 3 correct with serious difficulty, 2 incorrect but answer felt easy, 1 incorrect but
familiar, 0 blackout.

- `I(1) = 1`, `I(2) = 6`, `I(n) = I(n-1) × EF` for `n > 2`; fractional intervals round **up**.
- `EF' = EF + (0.1 - (5-q)·(0.08 + (5-q)·0.02))`, equivalently `EF - 0.8 + 0.28q - 0.02q²`;
  never below 1.3. `q = 4` leaves EF unchanged.
- **`q < 3` (failure):** repetitions restart from `I(1)`, `I(2)`, ... as if newly learned, and
  **"the E-Factor is not changed"**.
- The page also specifies a same-day rule: items scoring below 4 are repeated within the session
  until all score >= 4. Anki and most reimplementations drop this; it does not fit a once-through
  review screen.

Adapting four buttons onto SM-2 means **choosing** a mapping, e.g. Again->0 or 2, Hard->3, Good->4,
Easy->5. That mapping is a design decision, not something the spec provides. Note the asymmetry it
creates: only Good (`q=4`) is EF-neutral, Hard (`q=3`) shrinks EF by 0.14, Easy (`q=5`) grows it
by 0.1.

The classic SM-2 weakness, visible straight from the formulas: because a lapse resets to `I(1)=1`
with EF untouched, a mature card that is forgotten once loses its whole interval, and `Hard` has no
way to shorten an interval without failing the card (there is no "correct but reduce the interval"
branch — `q=3` still advances `n`).

### A brand-new card

`interval = 0`, `repetition = 0`, `efactor = 2.5`. The first successful grade yields
`interval = 1`, the second `interval = 6`.

### Library

**`supermemo`** (`github.com/VienDinhCom/supermemo`), read from the published `2.0.23` tarball:

- Latest **2.0.23, 2025-03-20** (a burst of releases that day after a 2020-2024 gap; the API is unchanged).
- Licence **MIT** (`LICENSE`, "Copyright (c) 2020 Vien Dinh").
- **Zero dependencies.** No `engines` field.
- Unpacked **12.8 KB** total; the implementation is **~1.4 KB** — literally one function, ~30 lines
  of arithmetic, `esm/` + `script/` (CJS) builds plus `.d.ts`.
- Published to JSR as `@vien/supermemo`; README documents browser use via `esm.sh` and Deno via JSR.
- **Edge-safe:** the source uses nothing but `Math.round` and arithmetic — no `Date`, no imports at
  all, no Node builtins. The README's `dayjs` example is optional and only for computing a due date.

API:

```ts
type SuperMemoItem = { interval: number; repetition: number; efactor: number };
type SuperMemoGrade = 0 | 1 | 2 | 3 | 4 | 5;
function supermemo(item: SuperMemoItem, grade: SuperMemoGrade): SuperMemoItem;
```

**Two deviations from the SuperMemo page, read off the implementation** — flag these if the library
is adopted:

1. On failure (`grade < 3`) it sets `interval = 1, repetition = 0` and **still updates EF** with the
   same formula. SuperMemo's page says the E-Factor is *not* changed on a failed repetition. With
   `grade = 0` the library drops EF by 0.8 per lapse — markedly harsher than the spec.
2. The same-day re-repetition rule is not implemented (expected, and fine for our review screen).

Given it is one ~30-line pure function, writing it in `src/lib/` instead of adding a dependency is a
real option, and would let the failure branch follow the spec exactly.

### Seeding from a Leitner box

The most natural fit of the three, because SM-2's state is interval-shaped rather than
memory-model-shaped: `efactor = 2.5` (the spec's own default), `interval = interval_days` (already
correct in the row), `repetition = box` or `box + 1`. Then `next_due_at` is untouched and the first
post-migration success multiplies the *existing* interval by 2.5 — box progress is genuinely
carried, not fabricated, since Leitner's `[1,2,4,7,15,30]` is already "days until due" and that is
exactly what SM-2's `interval` means.

One wrinkle: with `repetition <= 1` SM-2 ignores the stored interval and uses the fixed `I(1)=1` /
`I(2)=6` ladder, so seeding `repetition = box` sends box 0/1 cards back onto the 1-then-6 ladder.
Seeding `repetition = box + 2` (or any value > 2) puts every card straight onto `I × EF`. Which to
pick is a decision for #72, not a fact.

**No blocker for the constraint.**

---

## 3. Leitner driven by four ratings

No spec and no library — this is whatever we define. Primary source is our own code
(`src/lib/leitner.ts`) and `docs/adr/0001-leitner-boxes-for-review-schedule.md`, which names graded
ratings as its own revisit trigger.

### Per-card state

**Zero new columns.** `box` keeps doing the work; `interval_days`, `next_due_at`,
`last_reviewed_at` already exist. If a variable step size is wanted (e.g. Easy skipping ahead
further than Good) that is still just arithmetic on `box`.

### Review history

**Not needed at all** — there are no parameters to tune, so history has no second use either.

### Four ratings to an interval

Needs defining; the obvious shape is a box delta per rating, e.g.
`Again -> 0` (reset, as today), `Hard -> box - 1` (floored at 0, a genuinely new capability the
binary version lacks), `Good -> box + 1`, `Easy -> box + 2` (capped at `MAX_BOX = 5`); interval then
read from `BOX_INTERVALS_DAYS[newBox]` exactly as now. This is a ~5-line change to
`schedule()` and is the only candidate where the rating-to-interval mapping is fully under our
control and inspectable in one screen.

Its limitation, stated plainly: the schedule is **not adaptive**. Six fixed intervals capped at 30
days, identical for every card and every user; no per-card easiness, no desired retention. A card
you find trivial and a card you barely know both top out at 30 days. The intervals also stay
deterministic, so review load can clump (FSRS has fuzzing for exactly this; `ts-fsrs` exposes
`enableFuzz` / `schedulerFuzzingMiddleware`).

### A brand-new card

`box = 0`. Already true today — `cards.box` defaults to `0`, and `interval_days` to `0` until the
first review.

### Seeding from a Leitner box

**Nothing to seed.** `box` is already the state; the migration is a no-op on the `cards` table, and
`next_due_at` cannot move because nothing is written. This is the only candidate with a literally
empty data migration.

---

## 4. Summary table

| | FSRS (via `ts-fsrs`) | SM-2 | Leitner + 4 ratings |
| --- | --- | --- | --- |
| New per-card columns | ~6 (`stability`, `difficulty`, `state`, `learning_steps`, `reps`, `lapses`) | 1 (`efactor numeric`), reusing `box` as `repetition` | **0** |
| History needed for next interval | No | No | No |
| History needed to tune | **Yes** (34 weights in FSRS-7), via a native/WASI optimizer | No params | No params |
| Library | `ts-fsrs` 6.0.1, 2026-11-22, MIT, 1 dep, 43 KB ESM entry, `engines node>=24`, async factory | `supermemo` 2.0.23, 2025-03-20, MIT, 0 deps, ~1.4 KB — or ~30 lines of our own | n/a — our own code |
| Edge-safe without `nodejs_compat` | Yes on tarball evidence (no `node:`/`.wasm`); not stated by upstream; `engines` mismatch with Node 22.14 | Yes, trivially | Yes, already |
| Rating scale fit | Native Again/Hard/Good/Easy = 1/2/3/4 | 0-5 scale; needs a chosen 4-to-6 mapping | Whatever we define |
| New card starts from | A function of the first rating (`S0(G)`, `D0(G)`) | `interval 0, repetition 0, efactor 2.5` | `box 0` |
| Leitner seeding | Either discard progress (`state: New`) or **fabricate** `stability ~ interval_days` | Direct: `interval_days` *is* SM-2's `interval` | Nothing to do |
| Adaptive per card | Yes | Yes (via EF) | **No** |

### Flags against the hard constraint (`next_due_at` unchanged)

- **No candidate blocks the constraint.** All three compute the next interval from stored state at
  review time, so the migration can write new columns only and never touch `next_due_at`.
- The honest risks are elsewhere:
  - **FSRS:** seeding requires either throwing away box progress or inventing a memory state that
    never came from a real review. `next_due_at` survives, but the *first interval after* the
    migration is where the discontinuity shows up. This is the one place where "progress-preserving"
    could be satisfied on paper and violated in spirit.
  - **FSRS:** `ts-fsrs@6` declares `engines.node >= 24` against the repo's pinned 22.14.0
    (`EBADENGINE` warning), and `DefaultScheduler()` is async with dynamic model imports — a shape
    change from today's synchronous pure `schedule()`. `ts-fsrs@5.4.2` (zero deps, `>=20`, sync
    `FSRS#next`) avoids both but caps at FSRS-6.
  - **SM-2 via `supermemo`:** the library updates EF on failure, which SuperMemo's own page says it
    must not. Harmless for a training project, but it means the dependency is not spec-faithful.
  - **SM-2 seeding:** `repetition <= 1` makes SM-2 ignore the stored interval and use the fixed 1/6
    ladder, so the seeded `repetition` value decides whether box progress actually carries.
  - **Leitner:** `check (interval_days >= 0)` and the `cards_due_idx` on `(user_id, next_due_at)`
    are satisfied by all three; nothing to flag.

## Sources

- FSRS algorithm (official wiki, last edited 2026-11-16): <https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm>
- `ts-fsrs` repo and READMEs: <https://github.com/open-spaced-repetition/ts-fsrs>, `packages/fsrs/README.md`
- npm registry metadata and published tarballs for `ts-fsrs@6.0.1`, `ts-fsrs@5.4.2`,
  `@open-spaced-repetition/srs-kit@1.0.1`, `@open-spaced-repetition/binding@0.6.3`,
  `supermemo@2.0.23`, `fsrs.js@1.2.2`, `fsrs-algorithm@1.1.3` — read 2026-11-25
- SM-2 (Wozniak, 1990; web 1998-05-10): <https://super-memory.com/english/ol/sm2.htm>
- `supermemo` library: <https://github.com/VienDinhCom/supermemo>
- Repo: `src/lib/leitner.ts`, `supabase/migrations/20260527150510_cards_and_account_deletion.sql`,
  `supabase/migrations/20260531120000_cards_due_index_and_interval_check.sql`,
  `supabase/migrations/20261125120000_cards_rename_repetition_count_to_box.sql`,
  `docs/adr/0001-leitner-boxes-for-review-schedule.md`
