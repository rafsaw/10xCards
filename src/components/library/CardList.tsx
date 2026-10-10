import CardRow from "./CardRow";

interface SavedCard {
  id: string;
  front: string;
  back: string;
  tag: string | null;
}

export default function CardList({
  cards,
  readOnly = false,
  tags = [],
}: {
  cards: SavedCard[];
  readOnly?: boolean;
  tags?: string[];
}) {
  return (
    <ul className="space-y-3">
      {cards.map((card) => (
        <CardRow key={card.id} card={card} readOnly={readOnly} tags={tags} />
      ))}
    </ul>
  );
}
