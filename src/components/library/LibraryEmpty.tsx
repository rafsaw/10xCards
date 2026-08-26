import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Page-local composition of /library's two empty branches, not a registry
 * primitive. It exists because `EmptyState`'s `action` takes a React node and an
 * Astro template cannot build one in an attribute value — the same reason
 * `LibrarySearch.astro` exists for the search row.
 */
export function LibraryEmpty({ q }: { q?: string }) {
  if (q) {
    return (
      <EmptyState
        title="No cards match your search"
        body={`Nothing in your library matches “${q}”. Try a different word, or clear the search.`}
        action={
          <Button asChild variant="outline" size="sm">
            <a href="/library">Clear search</a>
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Your library is empty"
      body="Cards you save appear here. Create one above, or generate a batch from a passage of text."
      action={
        <Button asChild variant="outline" size="sm">
          <a href="/generate">Generate cards</a>
        </Button>
      }
    />
  );
}
