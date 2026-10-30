import { BASE_SIZES_MM, DEFAULT_BASE_MM } from '../../shared/game.js'

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

// Marker and token disc sizes (diameter, mm). Operative bases use BASE_SIZES_MM.
const MARKER_SIZES_MM = [10, 15, 20, 25, 28.5, 32, 40, 50, 60]
const MM_PER_IN = 25.4

// Steps through `sizes` from `current`, even when current isn't one of them.
const stepSize = (sizes, current, direction) =>
  direction > 0 ? sizes.find((mm) => mm > current + 0.01) : sizes.findLast((mm) => mm < current - 0.01)

function SizeStepper({ label, value, sizes, onChange }) {
  return (
    <div className="select-field">
      <span className="muted">{label}</span>
      <div className="select-stepper">
        <button
          type="button"
          aria-label="Smaller base"
          onClick={() => onChange(stepSize(sizes, value, -1))}
          disabled={stepSize(sizes, value, -1) == null}
        >
          −
        </button>
        <span className="select-stepper-value">{Math.round(value * 10) / 10}mm</span>
        <button
          type="button"
          aria-label="Larger base"
          onClick={() => onChange(stepSize(sizes, value, 1))}
          disabled={stepSize(sizes, value, 1) == null}
        >
          +
        </button>
      </div>
    </div>
  )
}

// Select: edit whatever is selected. Changes are saved on the server straight away.
//   item: { type: 'token' | 'marker', value }.
// vantage / onVantage: your own operative's height on Vantage terrain (0, 2 or 4"),
// used by the Sightline tool; null for anything else.
export function SelectPanel({ item, act, onRemoved, onDetach, vantage = null, onVantage }) {
  const { type, value } = item
  const update = (patch) => act({ type: `${type}/update`, id: value.id, ...patch })
  return (
    <div className="rail-flyout anchored-flyout select-panel glass" aria-label="Edit selection">
      <label className="select-field">
        <span className="muted">Name</span>
        <input
          key={value.id}
          defaultValue={value.label}
          placeholder="Name"
          maxLength={24}
          // A renamed marker shows its new name rather than its short code.
          onBlur={(event) =>
            event.target.value !== value.label &&
            update(type === 'marker' ? { label: event.target.value, short: '' } : { label: event.target.value })
          }
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </label>

      {type === 'token' ? (
        <SizeStepper
          label="Base size"
          value={value.baseMm ?? DEFAULT_BASE_MM}
          sizes={BASE_SIZES_MM}
          onChange={(baseMm) => update({ baseMm })}
        />
      ) : (
        <SizeStepper
          label="Size"
          value={value.radius * 2 * MM_PER_IN}
          sizes={MARKER_SIZES_MM}
          onChange={(mm) => update({ radius: mm / MM_PER_IN / 2 })}
        />
      )}

      {vantage != null ? (
        <div className="select-field">
          <span className="muted">On Vantage</span>
          <div className="select-chips">
            {[0, 2, 4].map((height) => (
              <button
                key={height}
                type="button"
                className={`chip${vantage === height ? ' is-selected' : ''}`}
                onClick={() => onVantage(height)}
              >
                {height ? `${height}" up` : 'Floor'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="select-actions">
        {value.lastMove ? (
          <>
            <button type="button" className="chip is-accent" onClick={() => act({ type: 'token/undoStep', id: value.id })}>
              Undo 1&quot;
            </button>
            <button type="button" className="chip is-accent" onClick={() => act({ type: 'token/undoMove', id: value.id })}>
              Undo move
            </button>
          </>
        ) : null}
        {value.attachedTo ? (
          <button type="button" className="chip" onClick={onDetach}>
            Detach
          </button>
        ) : null}
        <button
          type="button"
          className="chip is-danger"
          onClick={() => {
            act({ type: `${type}/remove`, id: value.id })
            onRemoved()
          }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
