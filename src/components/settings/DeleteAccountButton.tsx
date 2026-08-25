import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/Notice";
import { parseErrorBody } from "@/lib/parse-error";

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
// renders read-only with the retention banner. Errors render in a Notice,
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

      const { code, message } = await parseErrorBody(response);
      setError({ code, message: message || FALLBACK_MESSAGES[code] });
      setPending(false);
    } catch {
      setError({ code: "network_error", message: "Network error — please try again." });
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Notice variant="error">{error.message}</Notice>}
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
