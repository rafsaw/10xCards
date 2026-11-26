// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
//
// Three variants of the four-rating review screen, switchable via `?variant=` on
// the existing /review route. Answers issue #71: (a) do the buttons show the
// predicted interval, (b) what is the keyboard mapping.
//
// Nothing persists: `rate()` is an in-memory stub with a fake 250 ms latency, so
// /api/reviews is never called and the real schedule is untouched. Card state is
// seeded in memory (real due cards are used for their text when the account has
// any, otherwise the demo deck below).
import { useCallback, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrototypeSwitcher, type VariantMeta } from "./PrototypeSwitcher";
import { previewAll, schedule, type CardState, type Rating } from "./sm2-preview";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";

export interface PrototypeCard {
  id: string;
  front: string;
  back: string;
  tag: string | null;
  state: CardState;
}

export interface VariantProps {
  card: PrototypeCard;
  index: number;
  total: number;
  revealed: boolean;
  submitting: boolean;
  pendingRating: Rating | null;
  onReveal: () => void;
  onRate: (rating: Rating) => void;
}

const VARIANTS: VariantMeta[] = [
  { key: "A", name: "Bare row" },
  { key: "B", name: "Consequence-forward" },
  { key: "C", name: "Progressive" },
];

// Deliberately spread across SM-2 states so the predicted intervals differ a lot
// card to card: a brand-new card, two mid-life cards, a difficult one at the EF floor.
const DEMO_DECK: PrototypeCard[] = [
  {
    id: "demo-1",
    front: "What does `useCallback` actually memoize?",
    back: "The function identity between renders — not the result of calling it.",
    tag: "m2l1",
    state: { repetition: 0, efactor: 2.5, interval_days: 0 },
  },
  {
    id: "demo-2",
    front: "In SM-2, what does the ease factor control?",
    back: "The multiplier applied to the previous interval on every successful review.",
    tag: "m4l2",
    state: { repetition: 2, efactor: 2.5, interval_days: 6 },
  },
  {
    id: "demo-3",
    front: "Why does Postgres RLS need a policy per operation?",
    back: "SELECT, INSERT, UPDATE and DELETE are evaluated separately; a policy for one grants nothing for the others.",
    tag: "m3l4",
    state: { repetition: 5, efactor: 2.36, interval_days: 34 },
  },
  {
    id: "demo-4",
    front: "What is the lowest ease factor SM-2 allows?",
    back: "1.3 — below that the interval growth is so slow the card effectively never leaves daily review.",
    tag: "m4l2",
    state: { repetition: 4, efactor: 1.3, interval_days: 12 },
  },
];

interface LogEntry {
  front: string;
  rating: Rating;
  before: CardState;
  after: CardState;
}

export default function ReviewSessionPrototype({
  variant,
  dueCards,
}: {
  variant: string;
  dueCards: { id: string; front: string; back: string; tag: string | null }[];
}) {
  // Real card text when the account has due cards (so density is honest), demo
  // deck otherwise. Either way the SM-2 state is invented in memory.
  const [deck] = useState<PrototypeCard[]>(() =>
    dueCards.length > 0
      ? dueCards.slice(0, 8).map((c, i) => ({ ...c, state: DEMO_DECK[i % DEMO_DECK.length].state }))
      : DEMO_DECK,
  );

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRating, setPendingRating] = useState<Rating | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const lockRef = useRef(false);

  const card = index < deck.length ? deck[index] : null;

  const onRate = useCallback(
    (rating: Rating) => {
      if (!card || lockRef.current) return;
      lockRef.current = true;
      setSubmitting(true);
      setPendingRating(rating);

      // The stub: what POST /api/reviews would have done, in memory.
      window.setTimeout(() => {
        setLog((prev) => [
          { front: card.front, rating, before: card.state, after: schedule(card.state, rating) },
          ...prev,
        ]);
        setIndex((prev) => prev + 1);
        setRevealed(false);
        setSubmitting(false);
        setPendingRating(null);
        lockRef.current = false;
      }, 250);
    },
    [card],
  );

  const onReveal = useCallback(() => {
    setRevealed(true);
  }, []);

  function restart() {
    setIndex(0);
    setRevealed(false);
    setLog([]);
  }

  const current = VARIANTS.some((v) => v.key === variant) ? variant : "A";

  const Variant = current === "B" ? VariantB : current === "C" ? VariantC : VariantA;

  const body = !card ? (
    <div className="border-border bg-card space-y-3 rounded-lg border p-6 text-center">
      <p className="text-title font-serif">Session complete</p>
      <p className="text-meta text-muted-foreground">
        {deck.length} card{deck.length === 1 ? "" : "s"} rated. Nothing was saved.
      </p>
      <Button type="button" variant="outline" onClick={restart}>
        <RotateCcw className="size-4" />
        Restart
      </Button>
    </div>
  ) : (
    <Variant
      card={card}
      index={index}
      total={deck.length}
      revealed={revealed}
      submitting={submitting}
      pendingRating={pendingRating}
      onReveal={onReveal}
      onRate={onRate}
    />
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-lg border-2 border-dashed border-yellow-500 bg-yellow-500/10 px-3 py-2">
        <p className="text-meta font-mono">
          PROTOTYPE · variant {current} · ratings are stubbed in memory, nothing is saved
        </p>
      </div>

      {body}

      {/* Principle: surface the state. Current SM-2 state, what every rating would
          do to it, and the running log of this session. */}
      {card && <StateReadout state={card.state} />}
      {log.length > 0 && <SessionLog log={log} />}

      <PrototypeSwitcher variants={VARIANTS} current={current} />
    </div>
  );
}

function StateReadout({ state }: { state: CardState }) {
  const preview = previewAll(state);
  return (
    <details className="border-border bg-muted/40 rounded-lg border p-3 font-mono text-xs" open>
      <summary className="cursor-pointer select-none">card state &amp; predictions</summary>
      <p className="mt-2">
        repetition={state.repetition} efactor={state.efactor.toFixed(2)} interval_days={state.interval_days}
      </p>
      <table className="mt-2">
        <tbody>
          {(Object.keys(preview) as Rating[]).map((r) => (
            <tr key={r}>
              <td className="pr-4">{r}</td>
              <td className="pr-4">n={preview[r].repetition}</td>
              <td className="pr-4">ef={preview[r].efactor.toFixed(2)}</td>
              <td>interval={preview[r].interval_days} d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function SessionLog({ log }: { log: LogEntry[] }) {
  return (
    <details className="border-border bg-muted/40 rounded-lg border p-3 font-mono text-xs">
      <summary className="cursor-pointer select-none">session log ({log.length})</summary>
      <ul className="mt-2 space-y-1">
        {log.map((entry, i) => (
          <li key={i}>
            {entry.rating} · n {entry.before.repetition}→{entry.after.repetition} · ef {entry.before.efactor.toFixed(2)}
            →{entry.after.efactor.toFixed(2)} · {entry.before.interval_days}→{entry.after.interval_days} d ·{" "}
            {entry.front.slice(0, 40)}
          </li>
        ))}
      </ul>
    </details>
  );
}
