import { useState } from "react";
import { Check, Trash2, Save, Loader2 } from "lucide-react";
import { parseErrorBody } from "@/lib/parse-error";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/button";

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

  function setAll(decision: Decision) {
    const next: Record<string, Decision> = {};
    for (const d of drafts) next[d.id] = decision;
    setDecisions(next);
  }

  function acceptAll() {
    setAll("accept");
  }

  function rejectAll() {
    // Bulk reject is destructive intent — confirm before marking every draft to discard.
    // This only sets the selection; permanent removal happens at handleSave (own count confirm).
    if (!window.confirm(`Mark all ${drafts.length} drafts to discard? You'll still need to "Save to deck" to apply.`))
      return;
    setAll("reject");
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

      const { code, message } = await parseErrorBody(response);
      setError({ code, message: message || FALLBACK_MESSAGES[code] });
      setSubmitting(false);
    } catch {
      setError({ code: "network_error", message: "Network error — please try again." });
      setSubmitting(false);
    }
  }

  return (
    <Section
      title={`Review draft batch (${drafts.length})`}
      description={`${acceptCount} to save · ${rejectCount} to discard`}
    >
      {error && <Notice variant="error">{error.message}</Notice>}

      {/* Bulk selection setters — they only mark every card's Keep/Discard decision;
          nothing persists until "Save to deck" below. Kept separate from the immediate
          "Discard all drafts" action above so the deferred intent reads clearly. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Set all:</span>
        <button
          type="button"
          onClick={acceptAll}
          disabled={submitting}
          className="border-success bg-success-surface text-success focus-visible:border-ring focus-visible:ring-ring flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors outline-none hover:opacity-80 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="size-4" />
          Keep all
        </button>
        <button
          type="button"
          onClick={rejectAll}
          disabled={submitting}
          className="border-destructive bg-destructive-surface text-destructive focus-visible:border-ring focus-visible:ring-ring flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors outline-none hover:opacity-80 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          Discard all
        </button>
      </div>

      <ul className="space-y-3">
        {drafts.map((draft) => {
          const rejected = decisions[draft.id] === "reject";
          return (
            <li
              key={draft.id}
              className={`border-surface-draft-border bg-surface-draft flex items-start justify-between gap-4 rounded-lg border p-4 transition-opacity ${
                rejected ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0">
                <p className={`text-foreground font-medium ${rejected ? "line-through" : ""}`}>{draft.front}</p>
                <p className={`text-muted-foreground mt-1 text-sm ${rejected ? "line-through" : ""}`}>{draft.back}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggle(draft.id);
                }}
                aria-pressed={!rejected}
                className={`focus-visible:border-ring focus-visible:ring-ring flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors outline-none hover:opacity-80 focus-visible:ring-[3px] ${
                  rejected
                    ? "border-destructive bg-destructive-surface text-destructive"
                    : "border-success bg-success-surface text-success"
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

      <Button
        type="button"
        variant="default"
        onClick={() => {
          void handleSave();
        }}
        disabled={submitting}
        className="w-full transition-colors"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </Section>
  );
}
