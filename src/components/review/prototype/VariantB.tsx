// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
//
// VARIANT B — "Consequence-forward".
// The schedule is the point, so the buttons lead with it.
//   Interval on buttons: ALWAYS, as the dominant line ("6 d") plus the absolute
//                        due date underneath ("Mon 2 Dec"). The rating word is the
//                        small text. Couples the screen to the scheduler on purpose.
//   Keyboard: Space reveals, then a SECOND Space = Good — the whole session is
//             tappable with one key, 1-4 only when you disagree with Good.
//   Layout: compact card, 2x2 grid of tall tiles (thumb-reachable on mobile).
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { previewAll, RATINGS, RATING_LABEL, formatInterval, formatDueDate } from "./sm2-preview";
import type { VariantProps } from "./ReviewSessionPrototype";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground text-meta rounded-lg border px-1.5 py-0.5 font-mono">
      {children}
    </kbd>
  );
}

export function VariantB({ card, index, total, revealed, submitting, pendingRating, onReveal, onRate }: VariantProps) {
  const preview = previewAll(card.state);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = ((event.target as { tagName?: string } | null)?.tagName ?? "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (event.key === " ") {
        if (["BUTTON", "A", "SUMMARY"].includes(tag)) return;
        event.preventDefault();
        if (!revealed) {
          onReveal();
        } else if (!submitting) {
          onRate("good"); // Space-as-Good: the one-key flow this variant is testing
        }
        return;
      }
      if (!revealed || submitting) return;
      const slot = Number(event.key);
      if (slot >= 1 && slot <= 4) {
        event.preventDefault();
        onRate(RATINGS[slot - 1]);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [revealed, submitting, onReveal, onRate]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-meta text-muted-foreground">
          Card {index + 1} of {total}
        </p>
        <p className="text-meta text-muted-foreground font-mono">
          seen {card.state.repetition}× · ease {card.state.efactor.toFixed(2)}
        </p>
      </div>

      {/* The card shrinks once revealed: the answer and the four consequences are
          what you are reading at that point, not the prompt. */}
      <div className="border-border bg-card rounded-lg border p-5">
        <p className={cn("font-serif break-words", revealed ? "text-muted-foreground text-sm" : "text-title")}>
          {card.front}
        </p>
        {revealed && <p className="text-foreground text-title mt-3 font-serif break-words">{card.back}</p>}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={onReveal}
          aria-keyshortcuts="Space"
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg py-4 text-sm font-medium"
        >
          Reveal answer · <span className="font-mono opacity-80">Space</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {RATINGS.map((rating, i) => (
            <button
              key={rating}
              type="button"
              disabled={submitting}
              aria-keyshortcuts={rating === "good" ? "4 Space" : String(i + 1)}
              onClick={() => {
                onRate(rating);
              }}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-all disabled:opacity-50",
                rating === "good"
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              <span className="flex w-full items-center justify-between text-xs tracking-wide uppercase opacity-70">
                {RATING_LABEL[rating]}
                <span className="font-mono">{rating === "good" ? "space" : i + 1}</span>
              </span>
              <span className="flex items-center gap-2 font-serif text-xl">
                {submitting && pendingRating === rating && <Loader2 className="size-4 animate-spin" />}
                {formatInterval(preview[rating].interval_days)}
              </span>
              <span className="text-xs opacity-60">{formatDueDate(preview[rating].interval_days)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-meta text-muted-foreground text-center">
        {revealed ? (
          <>
            <Kbd>Space</Kbd> = Good · <Kbd>1</Kbd>–<Kbd>4</Kbd> to override
          </>
        ) : (
          <>
            <Kbd>Space</Kbd> reveals, then <Kbd>Space</Kbd> again accepts Good
          </>
        )}
      </p>
    </section>
  );
}
