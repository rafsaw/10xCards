import { useState } from "react";
import { CircleAlert, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  unauthorized: "Your session expired. Please sign in again.",
  supabase_unconfigured: "Database is not configured. Ask the admin to check the setup.",
  db_error: "Could not request account deletion. Please try again.",
};

// Request account deletion (FR-016) from the settings Danger zone. Confirms,
// then POSTs /api/account/delete; on success lands on the dashboard, which now
// renders read-only with the retention banner. Inline <p> error on failure,
// mirroring the FALLBACK_MESSAGES pattern from CreateCardForm.
export default function DeleteAccountButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DeleteError | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete your account? You'll have 30 days to cancel by logging in, after which all your cards are permanently deleted.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (response.ok) {
        window.location.assign("/dashboard");
        return;
      }

      let code = "unknown";
      let message = "Could not request account deletion. Please try again.";
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
      setPending(false);
    } catch {
      setError({ code: "network_error", message: "Network error — please try again." });
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {error.message}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          void handleDelete();
        }}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Delete account
      </Button>
    </div>
  );
}
