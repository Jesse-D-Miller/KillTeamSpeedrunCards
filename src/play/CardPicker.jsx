import PrimaryOpCard from './PrimaryOpCard.jsx'

// The primary op cards to pick from; `selected` is the picked card's category.
function CardPicker({ cards, selected, onPick, disabled = false }) {
  return (
    <div className="card-picker">
      {cards.map((card) => (
        <button
          key={card.category}
          type="button"
          className={`card-pick${card.category === selected ? ' is-selected' : ''}`}
          onClick={() => onPick(card)}
          disabled={disabled}
          aria-pressed={card.category === selected}
          aria-label={card.label}
        >
          <PrimaryOpCard category={card.category} />
        </button>
      ))}
    </div>
  )
}

export default CardPicker
