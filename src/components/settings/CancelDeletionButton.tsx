import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

// Cancel a pending deletion (FR-018) and restore read-write. Shared by the
// global retention banner and the settings page. On success, reload the current
// page so middleware recomputes isReadOnly = false. `className` lets the banner
// and settings page style the button to fit their surrounding context.
export default function CancelDeletionButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/cancel", { method: "POST" });
      if (response.ok) {
        window.location.reload();
        return;
      }
      setError("Could not cancel the deletion. Please try again.");
      setPending(false);
    } catch {
      setError("Network error — please try again.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void handleCancel();
        }}
        disabled={pending}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md border border-current px-3 py-1 text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
        Cancel deletion
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </span>
  );
}
