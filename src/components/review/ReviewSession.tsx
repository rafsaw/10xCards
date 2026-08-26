import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Check, X, PartyPopper, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseErrorBody } from "@/lib/parse-error";
import { resolveReviewShortcut, type ShortcutTarget } from "@/lib/review-shortcuts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import type { ReviewRating } from "@/lib/leitner";

export interface DueCard {
  id: string;
  front: string;
  back: string;
  repetition_count: number;
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground text-meta rounded-lg border px-1.5 py-0.5 font-mono">
      {children}
    </kbd>
  );
}

export default function ReviewSession({ dueCards, loadError }: { dueCards: DueCard[]; loadError: boolean }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRating, setPendingRating] = useState<ReviewRating | null>(null);
  const [error, setError] = useState<RateError | null>(null);
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
    async (rating: ReviewRating) => {
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
          body: JSON.stringify({ cardId: card.id, rating, currentBox: card.repetition_count }),
        });

        if (response.ok) {
          // Success includes applied:false (stale/replay) — advance regardless.
          setIndex((prev) => prev + 1);
          setRevealed(false);
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

  // Keyboard shortcuts (Space reveals, 1/2 rate). The listener is on `document`
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
      void handleRate(action === "rate-wrong" ? "wrong" : "right");
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

  // Re-walk the same dueCards from the top. Pure client-state reset: ratings
  // already POSTed stay persisted, so the schedule is untouched (no refetch).
  function handleRestart() {
    setIndex(0);
    setRevealed(false);
    setError(null);
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
          </div>
        )}
      </div>

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
        /* Principle 6's "shape, not colour" fix. The two are different tiers of the
           house button system, not a red button and a green button: semantic
           destructive/success are reserved for deletion and confirmation, and a
           self-assessment rating is neither. Principle 5 requires exactly one filled
           button per view and forbids a destructive-analogue action being primary, so
           Right is default and Wrong is outline. Icons inherit their button's text
           colour (Direction A §10) — no colour class on either glyph. */
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            aria-keyshortcuts="1"
            disabled={submitting}
            onClick={() => {
              void handleRate("wrong");
            }}
          >
            {submitting && pendingRating === "wrong" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Wrong
          </Button>
          <Button
            type="button"
            variant="default"
            className="flex-1"
            aria-keyshortcuts="2"
            disabled={submitting}
            onClick={() => {
              void handleRate("right");
            }}
          >
            {submitting && pendingRating === "right" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Right
          </Button>
        </div>
      )}

      {/* AC7: the shortcuts are discoverable without documentation. Both rows are
          always rendered so the hint never reflows the card as the state flips;
          the row that isn't active right now is dimmed rather than removed. */}
      <p className="text-meta text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className={cn("flex items-center gap-1.5", revealed && "opacity-40")}>
          <Kbd>Space</Kbd> Reveal
        </span>
        <span className={cn("flex items-center gap-1.5", !revealed && "opacity-40")}>
          <Kbd>1</Kbd> Wrong
        </span>
        <span className={cn("flex items-center gap-1.5", !revealed && "opacity-40")}>
          <Kbd>2</Kbd> Right
        </span>
      </p>
    </section>
  );
}
