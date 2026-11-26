import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, PartyPopper, Loader2, RotateCcw } from "lucide-react";
import { parseErrorBody } from "@/lib/parse-error";
import { resolveReviewShortcut, type ReviewShortcutAction, type ShortcutTarget } from "@/lib/review-shortcuts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ratingHint } from "@/lib/review-hint";
import type { Rating } from "@/lib/sm2";

export interface DueCard {
  id: string;
  front: string;
  back: string;
  tag: string | null;
  // The scheduler state the server guards the write on, echoed back on rating.
  repetition: number;
  efactor: number;
  interval_days: number;
}

interface RateError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_rating: "Something went wrong with the rating. Please try again.",
  unauthorized: "Your session expired. Please sign in again.",
  supabase_unconfigured: "Database is not configured. Ask the admin to check the setup.",
  db_error: "Could not record your review. Please try again.",
  bad_request: "Something went wrong with the request. Please try again.",
  network_error: "Network error — please try again.",
};

// What the resolver's rating actions mean. Keeps the keyboard on the SAME
// handleRate call the buttons make — there is no second rating path.
const RATING_BY_ACTION: Record<Exclude<ReviewShortcutAction, "reveal">, Rating> = {
  "rate-again": "again",
  "rate-hard": "hard",
  "rate-good": "good",
  "rate-easy": "easy",
};

// Shown in the hint line while nothing is hovered or focused, so the affordance
// is discoverable rather than invisible (#82).
const HINT_PLACEHOLDER = "hover or tab a rating to see when it comes back";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground text-meta rounded-lg border px-1.5 py-0.5 font-mono">
      {children}
    </kbd>
  );
}

// The digit hint printed inside a rating button, so the shortcut is not
// sighted-only knowledge. Identical on all four buttons — including Again —
// because only the grouping is allowed to set Again apart. `opacity-70` rather
// than a muted colour token so it reads the same on the filled Good button as
// on the three unfilled ones.
function KeyHint({ children }: { children: React.ReactNode }) {
  return <span className="opacity-70">{children}</span>;
}

export default function ReviewSession({ dueCards, loadError }: { dueCards: DueCard[]; loadError: boolean }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRating, setPendingRating] = useState<Rating | null>(null);
  const [error, setError] = useState<RateError | null>(null);
  // The rating whose consequence the hint line is currently reporting, split in
  // two so hover and focus cannot clobber each other: the pointer wins, because
  // a rating stays focused after a tab and the mouse must still be able to take
  // the line over.
  const [hoveredRating, setHoveredRating] = useState<Rating | null>(null);
  const [focusedRating, setFocusedRating] = useState<Rating | null>(null);
  // Synchronous re-entrancy guard: `submitting` is async state, so the
  // disabled button doesn't block a same-frame double-click. This ref does,
  // preventing a second POST from advancing the card index twice (skipping a card).
  const lockRef = useRef(false);

  // Derived BEFORE the early returns below so the shortcut effect stays an
  // unconditional hook: `card` is null in the load-error / empty / finished
  // states, and the effect simply doesn't subscribe then.
  const card = !loadError && index < dueCards.length ? dueCards[index] : null;

  // Declared here (above the early returns, memoized per card) because the
  // shortcut effect below depends on it — the buttons in the render call this
  // exact function, so keyboard and mouse share one submission path.
  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!card) return;
      if (lockRef.current) return; // drop a same-frame second click before it fires a duplicate POST
      lockRef.current = true;
      setSubmitting(true);
      setPendingRating(rating);
      setError(null);

      try {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: card.id,
            rating,
            currentRepetition: card.repetition,
            currentEfactor: card.efactor,
            currentIntervalDays: card.interval_days,
          }),
        });

        if (response.ok) {
          // Success includes applied:false (stale/replay) — advance regardless.
          setIndex((prev) => prev + 1);
          setRevealed(false);
          // The rated button unmounts without ever firing mouseleave/blur, so
          // clear by hand — otherwise the next card's reveal would open with a
          // hint nobody asked for.
          setHoveredRating(null);
          setFocusedRating(null);
          return;
        }

        const { code, message } = await parseErrorBody(response);
        setError({ code, message: message || FALLBACK_MESSAGES[code] });
      } catch {
        setError({ code: "network_error", message: FALLBACK_MESSAGES.network_error });
      } finally {
        setSubmitting(false);
        setPendingRating(null);
        lockRef.current = false;
      }
    },
    [card],
  );

  // Keyboard shortcuts (Space reveals, 1-4 rate). The listener is on `document`
  // because the session has no single focusable host to hang it off, and the
  // shortcuts are meant to work without the user hunting for focus first. All of
  // the "should this key do anything?" logic lives in the pure resolver, which is
  // unit-tested; this effect only translates the decision into the SAME reveal
  // and handleRate calls the buttons make — no second rating path.
  useEffect(() => {
    if (!card) return;

    function onKeyDown(event: KeyboardEvent) {
      const action = resolveReviewShortcut({
        key: event.key,
        repeat: event.repeat,
        withModifier: event.ctrlKey || event.metaKey || event.altKey,
        target: event.target as ShortcutTarget | null,
        revealed,
        submitting,
      });
      if (!action) return;

      // Only once we've decided to handle the key: Space would otherwise scroll
      // the page, and we don't want to swallow keystrokes we ignore.
      event.preventDefault();

      if (action === "reveal") {
        setRevealed(true);
        return;
      }
      void handleRate(RATING_BY_ACTION[action]);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [card, revealed, submitting, handleRate]);

  // An error state, not an empty one — a failed load is something going wrong,
  // and EmptyState carries no "something went wrong" affordance.
  if (loadError) {
    return (
      <Notice variant="error" title="Could not load your review session">
        Something went wrong fetching your due cards. Try refreshing the page.
      </Notice>
    );
  }

  if (dueCards.length === 0) {
    return (
      <EmptyState
        icon={<PartyPopper className="size-10" />}
        title="All caught up!"
        body="You have no cards due for review right now. Come back later."
      />
    );
  }

  if (index >= dueCards.length) {
    return (
      <EmptyState
        icon={<PartyPopper className="size-10" />}
        title="Session complete"
        body={`You reviewed ${dueCards.length} card${dueCards.length === 1 ? "" : "s"}. Nicely done.`}
        action={
          <Button type="button" variant="outline" onClick={handleRestart}>
            <RotateCcw className="size-4" />
            Restart session
          </Button>
        }
      />
    );
  }

  // Unreachable in practice — the three returns above cover every state in which
  // `card` is null — but it is what narrows `DueCard | null` to `DueCard` for the
  // render below.
  if (!card) return null;

  // The pointer wins over the keyboard; see the state declarations above.
  const inspected = hoveredRating ?? focusedRating;

  // What the one fixed-height line below the card face says, in its three
  // states. Before the reveal there is no rating to inspect and Space is the
  // only key that does anything, so the line carries the shortcut hint #81 left
  // in this slot; it hands the slot over to the interval hint exactly when the
  // ratings — and their own digit hints — come on screen.
  //
  // The interval is the real scheduler's answer, not a second copy of the
  // arithmetic: `ratingHint` calls the same pure `schedule` POST /api/reviews
  // runs server-side, fed the state the card echoed back, for the one rating
  // being inspected. The line's text lives in src/lib/review-hint.ts so that
  // claim is unit-testable at a mature card state (src/lib/review-hint.test.ts),
  // which the E2E spec cannot reach — a card it can create gives every rating
  // 1 d.
  const hintLine = !revealed ? (
    <>
      <Kbd>Space</Kbd> Reveal
    </>
  ) : inspected ? (
    ratingHint(card, inspected)
  ) : (
    HINT_PLACEHOLDER
  );

  // Re-walk the same dueCards from the top. Pure client-state reset: ratings
  // already POSTed stay persisted, so the schedule is untouched (no refetch).
  function handleRestart() {
    setIndex(0);
    setRevealed(false);
    setError(null);
    setHoveredRating(null);
    setFocusedRating(null);
  }

  // Hover and focus feed one line (#82 AC1/AC2). A leave or blur only clears the
  // line if it is still talking about ITS rating, so sliding the pointer from
  // Hard straight onto Good cannot blank the hint on the way.
  function inspectProps(rating: Rating) {
    return {
      onMouseEnter: () => {
        setHoveredRating(rating);
      },
      onMouseLeave: () => {
        setHoveredRating((prev) => (prev === rating ? null : prev));
      },
      onFocus: () => {
        setFocusedRating(rating);
      },
      onBlur: () => {
        setFocusedRating((prev) => (prev === rating ? null : prev));
      },
    };
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-meta text-muted-foreground">
          Card {index + 1} of {dueCards.length}
        </p>
        {/* Name stays "Restart", not "Restart session" — an E2E spec asserts it, and
            the two controls never render at the same time. */}
        <Button type="button" variant="ghost" size="sm" onClick={handleRestart} disabled={submitting}>
          <RotateCcw className="size-3.5" />
          Restart
        </Button>
      </div>

      {/* Notice supplies role="alert" + aria-live="assertive" for the error variant,
          which the plain paragraph this replaces did not — a failed rating used to be
          silent to a screen reader. */}
      {error && <Notice variant="error">{error.message}</Notice>}

      {/* The one bordered surface on the screen, which is what makes it the hero
          (principles 3 and 4). Both faces sit at --text-title: the token layer states
          content never goes below it, and the back of a card is content. */}
      <div className="border-border bg-card space-y-3 rounded-lg border p-6">
        <div>
          <p className="text-meta text-muted-foreground tracking-wide uppercase">Front</p>
          <p className="text-foreground text-title mt-1 font-serif break-words">{card.front}</p>
        </div>
        {revealed && (
          <div className="border-border border-t pt-3">
            <p className="text-meta text-muted-foreground tracking-wide uppercase">Back</p>
            <p className="text-foreground text-title mt-1 font-serif break-words">{card.back}</p>
            {card.tag && (
              <p className="text-meta text-muted-foreground mt-2">
                <span className="tracking-wide uppercase">Lesson:</span> {card.tag}
              </p>
            )}
          </div>
        )}
      </div>

      {/* One always-rendered line, above the button slot, so the schedule is
          peekable on demand and silent otherwise (#82). `h-7` reserves one row
          whatever the line holds — tall enough for the Kbd chip of the pre-reveal
          state, which is the tallest of the three — and `truncate` keeps the text
          to a single line on a narrow viewport, so the slot is exactly the same
          height in every state and the rating row under it never moves. */}
      <p className="text-meta text-muted-foreground flex h-7 items-center justify-center gap-1.5 truncate">
        {hintLine}
      </p>

      {!revealed ? (
        <Button
          type="button"
          variant="default"
          className="w-full"
          aria-keyshortcuts="Space"
          onClick={() => {
            setRevealed(true);
          }}
        >
          <Eye className="size-4" />
          Reveal answer
        </Button>
      ) : (
        /* Principle 6's "shape, not colour" fix. The four ratings are different
           tiers of the house button system, not red and green buttons: semantic
           destructive/success are reserved for deletion and confirmation, and a
           self-assessment rating is neither. Principle 5 requires exactly one
           filled button per view and forbids a failure action being primary, so
           Good is default and the other three are outline.

           Again is a different kind of statement ("I did not know this"), while
           Hard / Good / Easy are a dial on one statement ("I knew it") — so Again
           is detached by the row gap and the other three are flush inside a
           labelled group. The layout says which kind each button is, and Again
           can never be mis-clicked as "a bit hard".

           Every button is the Button primitive's default h-9 and the row never
           wraps, so this slot is exactly as tall as the Reveal button it replaces
           and the card face above it does not shift when the row renders. */
        <div className="flex items-stretch gap-6">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            aria-keyshortcuts="1"
            disabled={submitting}
            {...inspectProps("again")}
            onClick={() => {
              void handleRate("again");
            }}
          >
            {submitting && pendingRating === "again" ? <Loader2 className="size-4 animate-spin" /> : null}
            Again <KeyHint>1</KeyHint>
          </Button>
          <div className="flex flex-[3] items-stretch" role="group" aria-label="I knew it — how easily?">
            {/* Flush segments: only the group's outer corners stay rounded, which
                is what reads as one control rather than three buttons. */}
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-r-none"
              aria-keyshortcuts="2"
              disabled={submitting}
              {...inspectProps("hard")}
              onClick={() => {
                void handleRate("hard");
              }}
            >
              {submitting && pendingRating === "hard" ? <Loader2 className="size-4 animate-spin" /> : null}
              Hard <KeyHint>2</KeyHint>
            </Button>
            <Button
              type="button"
              variant="default"
              className="flex-1 rounded-none"
              aria-keyshortcuts="3"
              disabled={submitting}
              {...inspectProps("good")}
              onClick={() => {
                void handleRate("good");
              }}
            >
              {submitting && pendingRating === "good" ? <Loader2 className="size-4 animate-spin" /> : null}
              Good <KeyHint>3</KeyHint>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-l-none"
              aria-keyshortcuts="4"
              disabled={submitting}
              {...inspectProps("easy")}
              onClick={() => {
                void handleRate("easy");
              }}
            >
              {submitting && pendingRating === "easy" ? <Loader2 className="size-4 animate-spin" /> : null}
              Easy <KeyHint>4</KeyHint>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
