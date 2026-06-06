import React, { useState } from "react";
import { CircleAlert, Loader2, Plus } from "lucide-react";
import { parseErrorBody } from "@/lib/parse-error";

interface CreateError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_card: "Both front and back are required.",
  unauthorized: "Your session expired. Please sign in again.",
  supabase_unconfigured: "Database is not configured. Ask the admin to check the setup.",
  db_error: "Could not save the card. Please try again.",
  bad_request: "Something went wrong with the request. Please try again.",
};

export default function CreateCardForm() {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CreateError | null>(null);

  const canSubmit = front.trim().length > 0 && back.trim().length > 0;

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) {
      setError({ code: "client_validation", message: "Both front and back are required." });
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });

      if (response.ok) {
        window.location.assign("/library");
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
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {error.message}
        </p>
      )}

      <div>
        <label htmlFor="card-front" className="mb-1 block text-sm text-blue-100/80">
          Front
        </label>
        <textarea
          id="card-front"
          value={front}
          onChange={(e) => {
            setFront(e.target.value);
          }}
          disabled={submitting}
          rows={2}
          placeholder="The question or prompt…"
          className="w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="card-back" className="mb-1 block text-sm text-blue-100/80">
          Back
        </label>
        <textarea
          id="card-back"
          value={back}
          onChange={(e) => {
            setBack(e.target.value);
          }}
          disabled={submitting}
          rows={2}
          placeholder="The answer…"
          className="w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Plus className="size-4" />
            Create card
          </>
        )}
      </button>
    </form>
  );
}
