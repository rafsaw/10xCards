import { useState } from "react";
import { CircleAlert, Eye, Check, X, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
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

function DoneCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white backdrop-blur-xl">
      <div className="flex justify-center text-blue-200">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-blue-100/70">{body}</p>
      <a
        href="/dashboard"
        className="inline-block rounded-lg border border-white/20 bg-gradient-to-r from-blue-500/30 to-purple-500/30 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:from-blue-500/40 hover:to-purple-500/40"
      >
        Back to dashboard
      </a>
    </section>
  );
}

export default function ReviewSession({ dueCards, loadError }: { dueCards: DueCard[]; loadError: boolean }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<RateError | null>(null);

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
      />
    );
  }

  const card = dueCards[index];

  async function handleRate(rating: ReviewRating) {
    setSubmitting(true);
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
        setSubmitting(false);
        return;
      }

      let code = "unknown";
      let message = "Rating failed. Please try again.";
      try {
        const body: unknown = await response.json();
        if (body && typeof body === "object") {
          const rawCode = (body as { error?: unknown }).error;
          const rawMessage = (body as { message?: unknown }).message;
          if (typeof rawCode === "string") code = rawCode;
          if (typeof rawMessage === "string" && rawMessage) message = rawMessage;
        }
      } catch {
        /* non-JSON error body — keep the generic message */
      }
      setError({ code, message: message || FALLBACK_MESSAGES[code] });
      setSubmitting(false);
    } catch {
      setError({ code: "network_error", message: FALLBACK_MESSAGES.network_error });
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <p className="text-sm text-blue-100/70">
        Card {index + 1} of {dueCards.length}
      </p>

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
            disabled={submitting}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-red-500/30 bg-red-900/20 text-red-200 hover:bg-red-900/40",
            )}
          >
            <X className="size-4" />
            Wrong
          </button>
          <button
            type="button"
            onClick={() => {
              void handleRate("right");
            }}
            disabled={submitting}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "border-green-500/30 bg-green-900/20 text-green-200 hover:bg-green-900/40",
            )}
          >
            <Check className="size-4" />
            Right
          </button>
        </div>
      )}
    </section>
  );
}
