import React, { useState } from "react";
import { CircleAlert, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SavedCard {
  id: string;
  front: string;
  back: string;
}

interface RowError {
  code: string;
  message: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_card: "Both front and back are required.",
  unauthorized: "Your session expired. Please sign in again.",
  supabase_unconfigured: "Database is not configured. Ask the admin to check the setup.",
  db_error: "Could not save the change. Please try again.",
  not_found: "This card no longer exists.",
  bad_request: "Something went wrong with the request. Please try again.",
};

async function parseError(response: Response): Promise<RowError> {
  let code = "unknown";
  let message = "Something went wrong. Please try again.";
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
  return { code, message: message || FALLBACK_MESSAGES[code] };
}

export default function CardRow({ card }: { card: SavedCard }) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RowError | null>(null);

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  function startEdit() {
    setFront(card.front);
    setBack(card.back);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    if (!canSave) {
      setError({ code: "client_validation", message: "Both front and back are required." });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      if (response.ok) {
        window.location.assign("/library");
        return;
      }
      setError(await parseError(response));
      setPending(false);
    } catch {
      setError({ code: "network_error", message: "Network error — please try again." });
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this card? This cannot be undone.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (response.ok) {
        window.location.assign("/library");
        return;
      }
      setError(await parseError(response));
      setPending(false);
    } catch {
      setError({ code: "network_error", message: "Network error — please try again." });
      setPending(false);
    }
  }

  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-4">
      {error && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          {error.message}
        </p>
      )}

      {editing ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={`card-front-${card.id}`} className="mb-1 block text-sm text-blue-100/80">
              Front
            </label>
            <textarea
              id={`card-front-${card.id}`}
              value={front}
              onChange={(e) => {
                setFront(e.target.value);
              }}
              disabled={pending}
              rows={2}
              className="w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor={`card-back-${card.id}`} className="mb-1 block text-sm text-blue-100/80">
              Back
            </label>
            <textarea
              id={`card-back-${card.id}`}
              value={back}
              onChange={(e) => {
                setBack(e.target.value);
              }}
              disabled={pending}
              rows={2}
              className="w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void handleSave();
              }}
              disabled={pending || !canSave}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={pending}>
              <X className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium break-words text-white">{card.front}</p>
            <p className="mt-1 text-sm break-words text-blue-100/70">{card.back}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={startEdit} disabled={pending}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                void handleDelete();
              }}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
