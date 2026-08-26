import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
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
      {error && <Notice variant="error">{error.message}</Notice>}

      <Field
        id="card-front"
        label="Front"
        value={front}
        onChange={setFront}
        disabled={submitting}
        rows={2}
        placeholder="The question or prompt…"
      />

      <Field
        id="card-back"
        label="Back"
        value={back}
        onChange={setBack}
        disabled={submitting}
        rows={2}
        placeholder="The answer…"
      />

      <Button type="submit" className="w-full" disabled={submitting || !canSubmit}>
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
      </Button>
    </form>
  );
}
