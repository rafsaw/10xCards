import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Eye, Check, X, PartyPopper, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseErrorBody } from "@/lib/parse-error";
import { resolveReviewShortcut, type ShortcutTarget } from "@/lib/review-shortcuts";
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

function DoneCard({
  icon,
  title,
  body,
  onRestart,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onRestart?: () => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white backdrop-blur-xl">
      <div className="flex justify-center text-blue-200">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-blue-100/70">{body}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <RotateCcw className="size-4" />
            Restart session
          </button>
        )}
        <a
          href="/dashboard"
          className="inline-block rounded-lg border border-white/20 bg-gradient-to-r from-blue-500/30 to-purple-500/30 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:from-blue-500/40 hover:to-purple-500/40"
        >
          Back to dashboard
        </a>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-blue-100/80">
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

  if (loadError) {
    return (
      <DoneCard
        icon={<CircleAlert className="size-10" />}
        title="Could not load your review session"
        body="Something went wrong fetching your due cards. Try refreshing the page."
      />
    );
  }

  if (dueCards.length === 0) {
    return (
      <DoneCard
        icon={<PartyPopper className="size-10" />}
        title="All caught up!"
        body="You have no cards due for review right now. Come back later."
      />
    );
  }

  if (index >= dueCards.length) {
    return (
      <DoneCard
        icon={<PartyPopper className="size-10" />}
        title="Session complete"
        body={`You reviewed ${dueCards.length} card${dueCards.length === 1 ? "" : "s"}. Nicely done.`}
        onRestart={handleRestart}
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
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-blue-100/70">
          Card {index + 1} of {dueCards.length}
        </p>
        <button
          type="button"
          onClick={handleRestart}
          disabled={submitting}
          className="flex items-center gap-1.5 text-xs text-blue-100/60 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" />
          Restart
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {error.message}
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-6">
        <div>
          <p className="text-xs tracking-wide text-blue-100/50 uppercase">Front</p>
          <p className="mt-1 text-lg font-medium text-white">{card.front}</p>
        </div>
        {revealed && (
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs tracking-wide text-blue-100/50 uppercase">Back</p>
            <p className="mt-1 text-blue-100/90">{card.back}</p>
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          aria-keyshortcuts="Space"
          onClick={() => {
            setRevealed(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-600/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600/50"
        >
          <Eye className="size-4" />
          Reveal answer
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void handleRate("wrong");
            }}
            aria-keyshortcuts="1"
            disabled={submitting}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-red-500/30 bg-red-900/20 text-red-200 hover:bg-red-900/40",
            )}
          >
            {submitting && pendingRating === "wrong" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Wrong
          </button>
          <button
            type="button"
            onClick={() => {
              void handleRate("right");
            }}
            aria-keyshortcuts="2"
            disabled={submitting}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-green-500/30 bg-green-900/20 text-green-200 hover:bg-green-900/40",
            )}
          >
            {submitting && pendingRating === "right" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Right
          </button>
        </div>
      )}

      {/* AC7: the shortcuts are discoverable without documentation. Both rows are
          always rendered so the hint never reflows the card as the state flips;
          the row that isn't active right now is dimmed rather than removed. */}
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-blue-100/50">
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
