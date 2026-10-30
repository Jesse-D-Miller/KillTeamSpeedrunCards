// The Vantage floor mark: one chevron for the 1st floor, two for the 2nd, none (a
// level line) for the ground. The same mark sits on the operative on the board.
function VantageMark({ floor }) {
  return (
    <svg className="vantage-mark" viewBox="-12 -12 24 24" aria-hidden="true">
      {floor ? (
        Array.from({ length: floor }, (_, index) => (
          <path key={index} d="M-8 3 0-5l8 8" transform={`translate(0 ${(index - (floor - 1) / 2) * 8})`} />
        ))
      ) : (
        <path d="M-8 4h16" />
      )}
    </svg>
  )
}

export default VantageMark
