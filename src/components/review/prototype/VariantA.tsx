// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
//
// VARIANT A — "Bare row".
// Today's screen, minimally stretched to four ratings.
//   Interval on buttons: NO. Labels only; the consequence is invisible.
//   Keyboard: Space reveals (and only while hidden), 1-4 rate (and only once revealed).
//             Exactly the rule in `src/lib/review-shortcuts.ts`, with 3 and 4 added.
//   Layout: four equal buttons in one row under the card, hint row below.
import { useEffect } from "react";
import { Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RATINGS, RATING_LABEL } from "./sm2-preview";
import type { VariantProps } from "./ReviewSessionPrototype";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-muted text-muted-foreground text-meta rounded-lg border px-1.5 py-0.5 font-mono">
      {children}
    </kbd>
  );
}

export function VariantA({ card, index, total, revealed, submitting, pendingRating, onReveal, onRate }: VariantProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = ((event.target as { tagName?: string } | null)?.tagName ?? "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (event.key === " ") {
        if (revealed || ["BUTTON", "A", "SUMMARY"].includes(tag)) return;
        event.preventDefault();
        onReveal();
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
      <p className="text-meta text-muted-foreground">
        Card {index + 1} of {total}
      </p>

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

      {!revealed ? (
        <Button type="button" className="w-full" aria-keyshortcuts="Space" onClick={onReveal}>
          <Eye className="size-4" />
          Reveal answer
        </Button>
      ) : (
        /* One filled button (Good, the expected answer); the other three outline.
           Four in a row means each is ~a quarter of 672px — fine on desktop, tight
           on a phone, which is part of what this variant is here to expose. */
        <div className="flex gap-2">
          {RATINGS.map((rating, i) => (
            <Button
              key={rating}
              type="button"
              variant={rating === "good" ? "default" : "outline"}
              className="flex-1"
              aria-keyshortcuts={String(i + 1)}
              disabled={submitting}
              onClick={() => {
                onRate(rating);
              }}
            >
              {submitting && pendingRating === rating && <Loader2 className="size-4 animate-spin" />}
              {RATING_LABEL[rating]}
            </Button>
          ))}
        </div>
      )}

      <p className="text-meta text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className={cn("flex items-center gap-1.5", revealed && "opacity-40")}>
          <Kbd>Space</Kbd> Reveal
        </span>
        {RATINGS.map((rating, i) => (
          <span key={rating} className={cn("flex items-center gap-1.5", !revealed && "opacity-40")}>
            <Kbd>{i + 1}</Kbd> {RATING_LABEL[rating]}
          </span>
        ))}
      </p>
    </section>
  );
}
