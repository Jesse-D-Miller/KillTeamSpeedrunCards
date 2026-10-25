function CardPicker({ cards, selectedSrc, onPick, disabled = false }) {
  return (
    <div className="card-picker">
      {cards.map((card) => (
        <button
          key={card.src}
          type="button"
          className={`card-pick${card.src === selectedSrc ? ' is-selected' : ''}`}
          onClick={() => onPick(card)}
          disabled={disabled}
          aria-pressed={card.src === selectedSrc}
        >
          <img src={card.src} alt={card.label} loading="lazy" />
        </button>
      ))}
    </div>
  )
}

export default CardPicker
