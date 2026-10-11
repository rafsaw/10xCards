export interface TagFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  disabled?: boolean;
}

/**
 * Label-plus-input primitive for the optional lesson tag. A plain text input is
 * the baseline; the datalist of the user's existing tags is a progressive
 * enhancement (native autocomplete). `Field` stays textarea-only by contract.
 */
export function TagField({ id, value, onChange, suggestions = [], disabled }: TagFieldProps) {
  const listId = `${id}-suggestions`;
  return (
    <div>
      <label htmlFor={id} className="text-meta text-foreground mb-1 block">
        Lesson tag (optional)
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        maxLength={40}
        list={listId}
        disabled={disabled}
        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
      />
      <datalist id={listId}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
