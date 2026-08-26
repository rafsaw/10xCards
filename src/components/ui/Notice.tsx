import * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "warning" | "error" | "success";

export interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /**
   * What element the `title` renders as.
   *
   * Defaults to `"p"`, which is what every existing call site gets and what this
   * primitive has always rendered. Pass a heading level when the title names a
   * region of the page rather than labelling an inline error — a relationship this
   * obvious visually has to be reachable programmatically too (WCAG 2.2 §1.3.1),
   * and a static server-rendered `aria-live` region cannot stand in for it: live
   * regions announce changes after load, so one that ships with its content
   * announces nothing.
   *
   * Opt-in on purpose. Four screens depend on this primitive, and silently turning
   * every `title` into a heading would rewrite their outlines.
   */
  titleAs?: "p" | "h2" | "h3";
}

const VARIANT_ICON: Record<NoticeVariant, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
};

const VARIANT_CLASSES: Record<NoticeVariant, string> = {
  info: "bg-info-surface border-info text-info",
  warning: "bg-warning-surface border-warning text-warning",
  error: "bg-destructive-surface border-destructive text-destructive",
  success: "bg-success-surface border-success text-success",
};

export function Notice({ variant = "info", title, children, action, titleAs = "p" }: NoticeProps) {
  const TitleTag = titleAs;
  const Icon = VARIANT_ICON[variant];
  const role = variant === "error" ? "alert" : "status";
  const ariaLive = variant === "error" ? "assertive" : "polite";

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={cn("rounded-paper flex items-start gap-3 border p-4", VARIANT_CLASSES[variant])}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="text-foreground flex-1 space-y-1">
        {title && <TitleTag className="font-bold">{title}</TitleTag>}
        <div className="text-sm">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
