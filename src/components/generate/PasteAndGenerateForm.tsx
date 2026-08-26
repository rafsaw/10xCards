import React, { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { parseErrorBody } from "@/lib/parse-error";
import { Notice } from "@/components/ui/Notice";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/button";

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

export default function PasteAndGenerateForm({ primary }: { primary: boolean }) {
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

      const { code, message } = await parseErrorBody(response);
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
    <Section title="Generate new cards from text">
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-4"
      >
        {error && <Notice variant="error">{error.message}</Notice>}

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
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
          />
          <div className="text-muted-foreground mt-1 text-right text-xs">
            {source.length} / {MAX_LENGTH}
          </div>
        </div>

        <Button
          type="submit"
          variant={primary ? "default" : "outline"}
          disabled={submitting || tooShort}
          className="w-full transition-colors"
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
        </Button>
      </form>
    </Section>
  );
}
