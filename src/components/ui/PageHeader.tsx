export interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      <h1 className="text-display text-foreground font-sans font-bold">{title}</h1>
      {description && <p className="text-body text-muted-foreground">{description}</p>}
    </header>
  );
}
