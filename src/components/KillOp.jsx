import './KillOp.css'

function KillOp() {
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

  return (
    <div className="killop" role="img" aria-label="Kill Op table">
      <div className="killop__title">KILL OP</div>
      <div className="killop__axis-row">
        <div className="killop__x-square" />
        <div className="killop__x-label">KILL GRADE</div>
        <div className="killop__x-values">
          {xLabels.map((label) => (
            <span key={`x-${label}`} className="killop__axis-value">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="killop__body">
        <div className="killop__y-label">Starting number of enemy operatives</div>
        <div className="killop__axis-col">
          {yLabels.map((label) => (
            <span key={`y-${label}`} className="killop__axis-value">
              {label}
            </span>
          ))}
        </div>
        <div className="killop__grid">
          {grid.map((value, index) => (
            <span key={`cell-${index}`} className="killop__cell">
              {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default KillOp
