import React, { useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Sparkles } from "lucide-react";

const MIN_LENGTH = 200;
const MAX_LENGTH = 8000;

interface GenerationError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_source: "Source text must be between 200 and 8000 characters.",
  ai_unconfigured: "AI generation is not configured. Ask the admin to set the OpenRouter key.",
  ai_timeout: "AI generation timed out. Please try again.",
  ai_parse_error: "Could not read the AI response. Please try again.",
  ai_provider_error: "The AI provider returned an error. Ask the admin to check the model.",
  db_error: "Could not save the generated drafts. Please try again.",
  bad_request: "Something went wrong with the request. Please try again.",
};

export default function PasteAndGenerateForm() {
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<GenerationError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!submitting) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [submitting]);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (source.trim().length < MIN_LENGTH) {
      setError({
        code: "client_validation",
        message: `Please paste at least ${MIN_LENGTH} characters of source text.`,
      });
      return;
    }
    startRef.current = Date.now();
    setElapsedMs(0);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      if (response.ok) {
        window.location.assign("/generate");
        return;
      }

      let code = "unknown";
      let message = "Generation failed. Please try again.";
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

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const tooShort = source.trim().length < MIN_LENGTH;

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
        <textarea
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
          }}
          disabled={submitting}
          rows={8}
          maxLength={MAX_LENGTH}
          placeholder="Paste a passage (200–8000 characters)…"
          className="w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50"
        />
        <div className="mt-1 text-right text-xs text-blue-100/50">
          {source.length} / {MAX_LENGTH}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || tooShort}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating… {elapsedSeconds}s
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generate
          </>
        )}
      </button>
    </form>
  );
}
