import React, { useState } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { parseErrorBody } from "@/lib/parse-error";

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
  const { code, message } = await parseErrorBody(response);
  return { code, message: message || FALLBACK_MESSAGES[code] };
}

export default function CardRow({ card, readOnly = false }: { card: SavedCard; readOnly?: boolean }) {
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

  // The spec writes the row surface on the Paper radius, but --radius-paper is
  // documented at global.css:273 as consumed only by primitives under
  // src/components/ui/, and primitives.test.ts enforces that confinement.
  // /review's card face and /generate's draft row set the precedent for a
  // screen-level surface: stay on the legacy radius scale.
  return (
    <li className="border-border rounded-lg border p-4">
      {error && (
        <div className="mb-3">
          <Notice variant="error">{error.message}</Notice>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <Field
            id={`card-front-${card.id}`}
            label="Front"
            value={front}
            onChange={setFront}
            disabled={pending}
            rows={2}
          />
          <Field id={`card-back-${card.id}`} label="Back" value={back} onChange={setBack} disabled={pending} rows={2} />
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
            <p className="text-foreground text-title font-serif break-words">{card.front}</p>
            <p className="text-muted-foreground text-title mt-1 font-serif break-words">{card.back}</p>
          </div>
          {!readOnly && (
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={startEdit} disabled={pending}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                // `ghost` carries `hover:text-accent-foreground`; because that is a hover:
                // variant and `text-destructive` is a base utility, tailwind-merge keeps
                // both and the destructive tint disappears exactly when the pointer is on
                // the control. Re-stating it under hover: (and focus-visible:, for the
                // keyboard path) pins the semantic colour through every interaction state.
                className="text-destructive hover:text-destructive focus-visible:text-destructive"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
