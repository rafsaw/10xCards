import { Notice } from "@/components/ui/Notice";
import CancelDeletionButton from "@/components/settings/CancelDeletionButton";

interface RetentionNoticeProps {
  formatted: string;
}

// Composes Notice + CancelDeletionButton as one React island so settings.astro hydrates a
// single tree instead of passing a second island as a prop across the Astro/React boundary.
// Source: .ai/specs/briefs/2026-08-24-screen-migration-settings.md
export default function RetentionNotice({ formatted }: RetentionNoticeProps) {
  return (
    <Notice
      variant="warning"
      action={
        <CancelDeletionButton className="border-warning text-warning hover:bg-warning-surface rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50" />
      }
    >
      Your account is scheduled for deletion on <strong>{formatted}</strong>. Until then it&apos;s read-only.
    </Notice>
  );
}
