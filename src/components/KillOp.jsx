import './KillOp.css'

function KillOp({ highlightRow = null, deadCount = null }) {
  const xLabels = [1, 2, 3, 4, 5]
  const yLabels = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const grid = [
    1, 2, 3, 4, 5,
    1, 2, 4, 5, 6,
    1, 3, 4, 6, 7,
    2, 3, 5, 6, 8,
    2, 4, 5, 7, 9,
    2, 4, 6, 8, 10,
    2, 4, 7, 9, 11,
    2, 5, 7, 10, 12,
    3, 5, 8, 10, 13,
    3, 6, 8, 11, 14,
  ]
  const highlightedRowIndex = yLabels.findIndex((label) => label === highlightRow)
  const highlightedColumnIndex = (() => {
    if (highlightedRowIndex < 0 || !Number.isFinite(deadCount)) return -1
    const rowValues = grid.slice(
      highlightedRowIndex * xLabels.length,
      (highlightedRowIndex + 1) * xLabels.length,
    )
    if (!rowValues.length || deadCount < rowValues[0]) return -1
    let index = -1
    rowValues.forEach((value, valueIndex) => {
      if (deadCount >= value) {
        index = valueIndex
      }
    })
    return index
  })()

  return (
    <div className="killop" role="img" aria-label="Kill Op table">
      <div className="killop__title">KILL OP</div>
      <div className="killop__axis-row">
        <div className="killop__x-square" />
        <div className="killop__x-label">KILL GRADE</div>
        <div className="killop__x-values">
          {xLabels.map((label, index) => (
            <span
              key={`x-${label}`}
              className={`killop__axis-value${index === highlightedColumnIndex ? ' is-highlighted-column' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="killop__body">
        <div className="killop__y-label">Starting number of enemy operatives</div>
        <div className="killop__axis-col">
          {yLabels.map((label) => (
            <span
              key={`y-${label}`}
              className={`killop__axis-value${highlightRow === label ? ' is-highlighted' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="killop__grid">
          {grid.map((value, index) => {
            const rowValue = yLabels[Math.floor(index / xLabels.length)]
            const isHighlighted = highlightRow === rowValue
            const columnIndex = index % xLabels.length
            const isHighlightedColumn = columnIndex === highlightedColumnIndex
            const isDeadMatch =
              highlightedRowIndex >= 0 &&
              rowValue === highlightRow &&
              columnIndex === highlightedColumnIndex
            return (
            <span
              key={`cell-${index}`}
              className={`killop__cell${isHighlighted ? ' is-highlighted' : ''}${isHighlightedColumn ? ' is-highlighted-column' : ''}${isDeadMatch ? ' is-dead-match' : ''}`}
            >
              {value}
            </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default KillOp
