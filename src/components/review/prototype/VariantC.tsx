// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
//
// VARIANT C — "Progressive".
// A middle position on the interval question: the number exists but is not shipped
// on every button, so the row stays quiet and the scheduler stays peekable.
//   Interval on buttons: ON DEMAND — one fixed-height line above the row shows the
//                        interval for whichever rating is hovered or keyboard-focused.
//   Keyboard: Space reveals; 1-4 ALSO reveal when the answer is still hidden, so a
//             mistimed digit never rates a card you have not seen. Second press rates.
//   Layout: card stays hero, Again is detached on the left (it is a different kind of
//           act: "I did not know this"), hard/good/easy form one segmented control.
import { useEffect, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { previewAll, RATINGS, RATING_LABEL, formatInterval, type Rating } from "./sm2-preview";
import type { VariantProps } from "./ReviewSessionPrototype";

const PASS: Rating[] = ["hard", "good", "easy"];

export function VariantC({ card, index, total, revealed, submitting, pendingRating, onReveal, onRate }: VariantProps) {
  const preview = previewAll(card.state);
  const [hinted, setHinted] = useState<Rating | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = ((event.target as { tagName?: string } | null)?.tagName ?? "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      const slot = Number(event.key);
      const isDigit = slot >= 1 && slot <= 4;

      if (!revealed) {
        if (event.key === " " && ["BUTTON", "A", "SUMMARY"].includes(tag)) return;
        if (event.key !== " " && !isDigit) return;
        event.preventDefault();
        // A digit pressed too early reveals instead of rating a card you cannot see.
        onReveal();
        if (isDigit) setHinted(RATINGS[slot - 1]);
        return;
      }

      if (submitting || !isDigit) return;
      event.preventDefault();
      onRate(RATINGS[slot - 1]);
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

      <div className="border-border bg-card min-h-44 space-y-4 rounded-lg border p-6">
        <p className="text-foreground text-title font-serif break-words">{card.front}</p>
        {revealed ? (
          <p className="border-border text-foreground text-title border-t pt-4 font-serif break-words">{card.back}</p>
        ) : (
          <button
            type="button"
            onClick={onReveal}
            aria-keyshortcuts="Space"
            className="text-muted-foreground hover:text-foreground border-border w-full rounded-md border border-dashed py-3 text-sm"
          >
            Reveal answer <span className="font-mono">(Space, or any of 1–4)</span>
          </button>
        )}
      </div>

      {revealed && (
        <>
          {/* Fixed height so the row never reflows as the hint appears and disappears. */}
          <p className="text-meta text-muted-foreground flex h-5 items-center justify-center">
            {hinted ? (
              <span className="font-mono">
                {RATING_LABEL[hinted]} → back in {formatInterval(preview[hinted].interval_days)}
              </span>
            ) : (
              <span className="opacity-50">hover or tab a rating to see when it comes back</span>
            )}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              aria-keyshortcuts="1"
              onMouseEnter={() => {
                setHinted("again");
              }}
              onMouseLeave={() => {
                setHinted(null);
              }}
              onFocus={() => {
                setHinted("again");
              }}
              onBlur={() => {
                setHinted(null);
              }}
              onClick={() => {
                onRate("again");
              }}
              className="border-border bg-background hover:bg-accent flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting && pendingRating === "again" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCw className="size-4" />
              )}
              Again
            </button>

            {/* One control, three segments: these three all mean "I knew it", and the
                choice between them is a dial, not three separate decisions. */}
            <div className="border-border flex flex-1 divide-x divide-[var(--color-border)] overflow-hidden rounded-md border">
              {PASS.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  disabled={submitting}
                  aria-keyshortcuts={String(RATINGS.indexOf(rating) + 1)}
                  onMouseEnter={() => {
                    setHinted(rating);
                  }}
                  onMouseLeave={() => {
                    setHinted(null);
                  }}
                  onFocus={() => {
                    setHinted(rating);
                  }}
                  onBlur={() => {
                    setHinted(null);
                  }}
                  onClick={() => {
                    onRate(rating);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium disabled:opacity-50",
                    rating === "good"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-background hover:bg-accent",
                  )}
                >
                  {submitting && pendingRating === rating && <Loader2 className="size-4 animate-spin" />}
                  {RATING_LABEL[rating]}
                  <span className="font-mono text-xs opacity-60">{RATINGS.indexOf(rating) + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
