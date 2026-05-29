import React, { useState } from "react";
import { CircleAlert, Check, Trash2, Save } from "lucide-react";

interface Draft {
  id: string;
  front: string;
  back: string;
}

interface SaveError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_selection: "Your selection looked malformed. Refresh and review again.",
  incomplete_selection: "Your draft list changed. Refresh and review again.",
  unauthorized: "Your session expired. Please sign in again.",
  supabase_unconfigured: "Database is not configured. Ask the admin to check the setup.",
  db_error: "Could not save your selection. Please try again.",
  bad_request: "Something went wrong with the request. Please try again.",
};

type Decision = "accept" | "reject";

export default function DraftReviewList({ drafts }: { drafts: Draft[] }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => {
    const init: Record<string, Decision> = {};
    for (const d of drafts) init[d.id] = "accept";
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);

  const acceptCount = drafts.filter((d) => decisions[d.id] === "accept").length;
  const rejectCount = drafts.length - acceptCount;

  function toggle(id: string) {
    setDecisions((prev) => ({ ...prev, [id]: prev[id] === "accept" ? "reject" : "accept" }));
  }

  async function handleSave() {
    if (
      !window.confirm(`Save ${acceptCount} to your deck and permanently discard ${rejectCount}? This can't be undone.`)
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);

    const accept = drafts.filter((d) => decisions[d.id] === "accept").map((d) => d.id);
    const reject = drafts.filter((d) => decisions[d.id] === "reject").map((d) => d.id);

    try {
      const response = await fetch("/api/generations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept, reject }),
      });

      if (response.ok) {
        window.location.assign("/generate");
        return;
      }

      let code = "unknown";
      let message = "Save failed. Please try again.";
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
      setError({ code: "network_error", message: "Network error — please try again." });
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review draft batch ({drafts.length})</h2>
          <p className="mt-1 text-sm text-blue-100/70">
            {acceptCount} to save · {rejectCount} to discard
          </p>
        </div>
        <form
          method="POST"
          action="/api/generations/discard"
          onSubmit={(e: React.SubmitEvent<HTMLFormElement>) => {
            if (!window.confirm(`Discard all ${drafts.length} drafts? This cannot be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-1.5 text-sm text-red-200 transition-colors hover:bg-red-900/40"
          >
            Discard all drafts
          </button>
        </form>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {error.message}
        </p>
      )}

      <ul className="space-y-3">
        {drafts.map((draft) => {
          const rejected = decisions[draft.id] === "reject";
          return (
            <li
              key={draft.id}
              className={`flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-4 transition-opacity ${
                rejected ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0">
                <p className={`font-medium text-white ${rejected ? "line-through" : ""}`}>{draft.front}</p>
                <p className={`mt-1 text-sm text-blue-100/70 ${rejected ? "line-through" : ""}`}>{draft.back}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggle(draft.id);
                }}
                aria-pressed={!rejected}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  rejected
                    ? "border-red-500/30 bg-red-900/20 text-red-200 hover:bg-red-900/40"
                    : "border-green-500/30 bg-green-900/20 text-green-200 hover:bg-green-900/40"
                }`}
              >
                {rejected ? (
                  <>
                    <Trash2 className="size-4" />
                    Discard
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Keep
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-600/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="size-4" />
        {submitting ? "Saving…" : "Save to deck"}
      </button>
    </section>
  );
}
