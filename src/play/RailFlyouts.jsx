
// Glass panels that pop out of the map's tool rail, beside their button.

// Units: the operatives still to place, then "Place all".
export function UnitsFlyout({ unplaced, labelFor, onChoose, onPlaceAll }) {
  return (
    <nav className="rail-flyout anchored-flyout glass" aria-label="Place a unit">
      {unplaced.length ? (
        <>
          {unplaced.map((unit) => (
            <button key={unit.key} type="button" onClick={() => onChoose(unit)}>
              {labelFor(unit)}
            </button>
          ))}
          {unplaced.length > 1 ? (
            <button type="button" className="is-accent" onClick={onPlaceAll}>
              Place all in my drop zone
            </button>
          ) : null}
        </>
      ) : (
        <span className="muted flyout-note">All operatives placed. Drag them to adjust.</span>
      )}
    </nav>
  )
}

function Swatch({ entry }) {
  return (
    <span className={`flyout-swatch is-${entry.kind}`} aria-hidden="true">
      {entry.kind === 'base' ? '' : entry.short}
    </span>
  )
}

// Token: categories first; a category opens its list of tokens.
//   menu: 'categories' or a category id.
export function TokenFlyout({ categories, menu, onOpenCategory, onChoose }) {
  const category = categories.find((candidate) => candidate.id === menu)
  if (!category) {
    return (
      <nav className="rail-flyout anchored-flyout glass" aria-label="Token categories">
        {categories.map((candidate) => (
          <button key={candidate.id} type="button" className="flyout-category" onClick={() => onOpenCategory(candidate.id)}>
            <span>{candidate.name}</span>
            <span className="muted">{candidate.entries.length} ›</span>
          </button>
        ))}
      </nav>
    )
  }
  return (
    <nav className="rail-flyout anchored-flyout glass" aria-label={`${category.name} tokens`}>
      <button type="button" className="flyout-back" onClick={() => onOpenCategory('categories')}>
        ‹ {category.name}
      </button>
      {category.entries.length ? (
        category.entries.map((entry) => (
          <button key={entry.id} type="button" className="flyout-entry" onClick={() => onChoose(entry)}>
            <Swatch entry={entry} />
            <span>{entry.name}</span>
            {entry.chosen ? <span className="flyout-dot" title="In your equipment" /> : null}
          </button>
        ))
      ) : (
        <span className="muted flyout-note">No special tokens for this kill team.</span>
      )}
    </nav>
  )
}

