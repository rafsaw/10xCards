import * as React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <section className="border-border space-y-4 border-t py-12 text-center">
      {icon && (
        <div aria-hidden="true" className="text-muted-foreground flex justify-center">
          {icon}
        </div>
      )}
      <h2 className="text-title text-foreground font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm">{body}</p>
      {action && <div className="flex justify-center pt-2">{action}</div>}
    </section>
  );
}
