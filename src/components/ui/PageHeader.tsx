export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Recedes the title for screens whose content is a single lead sentence (/dashboard). */
  quiet?: boolean;
}

export function PageHeader({ title, description, quiet = false }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <h1
        className={
          quiet
            ? "text-body text-muted-foreground font-sans font-semibold"
            : "text-display text-foreground font-sans font-bold"
        }
      >
        {title}
      </h1>
      {description && <p className="text-body text-muted-foreground">{description}</p>}
    </header>
  );
}
