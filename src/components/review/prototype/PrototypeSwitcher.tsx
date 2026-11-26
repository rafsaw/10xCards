// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantMeta {
  key: string;
  name: string;
}

export function PrototypeSwitcher({ variants, current }: { variants: VariantMeta[]; current: string }) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next.key);
    window.location.href = url.toString();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
      if (target?.isContentEditable === true) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((target?.tagName ?? "").toUpperCase())) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1.5 text-white shadow-lg ring-2 ring-yellow-400">
      <button
        type="button"
        onClick={() => {
          go(-1);
        }}
        aria-label="Previous variant"
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 font-mono text-xs whitespace-nowrap">
        PROTOTYPE · {variants[index].key} ({variants[index].name}) · ←/→
      </span>
      <button
        type="button"
        onClick={() => {
          go(1);
        }}
        aria-label="Next variant"
        className="rounded-full p-1 hover:bg-white/20"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
