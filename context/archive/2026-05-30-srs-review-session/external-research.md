---
change_id: srs-review-session
type: external-research
source: exa.ai (web_search_exa)
created: 2026-05-30
updated: 2026-05-30
question: Which JS/TS spaced-repetition scheduling libraries can implement S-04, compatible with the stack?
---

# External research — SRS scheduling libraries for S-04

External research (exa.ai) answering "what should we use?" — library capabilities and
ecosystem options for the **simple SR model** S-04 needs. Pairs with any internal
`/10x-research` (`research.md`) on existing schedule fields / conventions before `/10x-plan`.

## Constraint frame (from roadmap + PRD)

- **Simple model only.** PRD §Non-Goals forbids advanced SR optimization; S-04 Risk says the
  danger is **over-engineering, not under**. Roadmap deferred the formula choice to research.
- **Binary right/wrong (FR-014).** The chosen lib must map cleanly onto a binary rating, not a
  4- or 6-point grade scale.
- **Persisted `next_due` across sessions (FR-015).** Output must reduce to a date + a few
  numeric fields storable on the `cards` table (F-01 reserved schedule fields).
- **Fallback contract (PRD Guardrails):** on any due-selection failure → "oldest due-card first".
- **Edge runtime.** Runs on Cloudflare Workers (`nodejs_compat`, `compatibility_date 2026-05-08`),
  Node 22.14.0 local. Prefer zero-dependency pure-function libs that are edge-safe.

All candidates below are TypeScript-native and zero-dependency (edge-safe) unless noted.

## Candidates

| Library | Algorithm | Rating model | Edge/Workers | Maturity | Fit |
|---|---|---|---|---|---|
| **`supermemo`** (VienDinhCom) | SM-2 | 0–5 grade | pure fn, zero-dep → edge-safe | ~1.8K wk dl, since 2020, MIT, 12.5KB | **Strong** — pure `supermemo(item, grade)`; README shows the `{interval, repetition, efactor, dueDate}` + dayjs persistence pattern that maps onto Supabase directly |
| **`@open-spaced-repetition/sm-2`** | SM-2 (classic) | 0–5 grade | JSON-serializable Card/ReviewLog, pure | new (2025), official OSR org, MIT | **Strong** — `Scheduler.reviewCard(card, rating)` returns `card.due`; built for DB storage |
| **`@dtjv/sm-2`** | SM-2 | enum grade | pure fn | old (2021), low usage | OK but stale |
| **`ts-fsrs`** (official OSR) | FSRS v4/5/6 | 4-grade (Again/Hard/Good/Easy) | zero-dep, **requires Node ≥20** | 55K wk dl, 660★, MIT, very active | **Over-spec'd** — best accuracy, but stability/difficulty model + multi-grade rating fight the binary requirement and the simple-model non-goal |
| **`@squeakyrobot/fsrs`** | FSRS v4.5 | 1–4 (+continuous) | **explicit Cloudflare Workers / edge** | new, very low usage (~11 wk) | FSRS, edge-marketed but immature |
| **`quanta-fsrs`** | FSRS v4.5/6 | 1–4 | explicit Workers/edge | brand new, 0★, NOASSERTION license | **Avoid** — unproven + non-standard license |
| **`srs-everything`** | FSRS + queue mgmt | 1–4 | ESM/CJS | new, niche | Too much (queues, interleaving) for MVP |
| **Hand-rolled Leitner boxes** | Leitner | binary pass/fail | trivial, ~20 lines, no dep | n/a | **Simplest possible** — `box++` on right, reset on wrong, interval `≈ 2^box` days |

## Binary FR-014 mapping

- **Leitner / SM-2:** binary maps directly — `wrong → grade 0–2` (reset), `right → grade 4–5`.
  SM-2 adds three numeric columns (`efactor`, `interval`, `repetition`) to the schema.
- **FSRS:** expects ≥4 grades; collapsing to binary (Again/Good) wastes the model's purpose.

## Recommendation

Two defensible "deliberately simple" paths:

1. **`supermemo` (SM-2)** — *primary pick.* Real library (no hand-rolled math), zero-dep/edge-safe,
   pure function, README persistence example mirrors the Supabase flow. Binary → grade is trivial.
2. **Hand-rolled Leitner boxes** — zero dependency, ~20 lines, the literal floor of "simple model";
   aligns with the PRD "oldest due first" fallback. Choose for total control / no new dep.

**Avoid the FSRS family for v1.** Genuinely more accurate (~80% better log-loss than SM-2 on
Anki benchmarks) but it is exactly the "sophisticated SR algorithm" PRD parks for v2, and its
multi-grade model conflicts with binary FR-014.

## Open follow-ups before/during `/10x-plan`

- Confirm `supermemo` runs under Workers `nodejs_compat` (ts-fsrs's Node-20 note is a flag to check
  per-lib; SM-2 libs are pure arithmetic so low risk). Verify via Context7 if needed.
- Decide schema delta: SM-2 needs `efactor`/`interval`/`repetition` columns; Leitner needs a single
  `box` int. Cross-check against F-01's reserved schedule fields (internal `/10x-research`).
