import * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "warning" | "error" | "success";

export interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
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

export function Notice({ variant = "info", title, children, action }: NoticeProps) {
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
        {title && <p className="font-bold">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
