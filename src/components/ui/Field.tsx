export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Label-plus-textarea primitive. Textarea-only by contract: `auth/FormField.tsx`
 * is its own family (input, required icon, password toggle, per-field error) and
 * is deliberately not reconciled here.
 *
 * No error, icon, hint or end-content slot — none has a consumer in this
 * increment, and each would be a contract invented ahead of its use.
 *
 * `onChange` takes the string, not the event: all four call sites do
 * `setX(e.target.value)` and nothing else.
 */
export function Field({ id, label, value, onChange, rows = 2, placeholder, disabled }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-meta text-foreground mb-1 block">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
