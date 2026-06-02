import CardRow from "./CardRow";

interface SavedCard {
  id: string;
  front: string;
  back: string;
}

export default function CardList({ cards, readOnly = false }: { cards: SavedCard[]; readOnly?: boolean }) {
  return (
    <ul className="space-y-3">
      {cards.map((card) => (
        <CardRow key={card.id} card={card} readOnly={readOnly} />
      ))}
    </ul>
  );
}
