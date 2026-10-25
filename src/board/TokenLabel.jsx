// A name curved over the top of a disc, along an arc concentric with it (270deg,
// from lower-left over the top to lower-right), shrinking to fit between minFont
// and maxFont. Used for operative names and, smaller, for markers and tokens.
const LABEL_GAP = 0.08
// Rough glyph width for the uppercase condensed label face, in ems.
const LABEL_CHAR_EM = 0.58

function TokenLabel({ id, x, cy, r, text, className = 'board-token-label', maxFont = 0.34, minFont = 0.18 }) {
  const radius = r + LABEL_GAP
  const k = Math.SQRT1_2 * radius
  const arc = `M${x - k},${cy + k} A${radius},${radius} 0 1 1 ${x + k},${cy + k}`
  const arcLength = 1.5 * Math.PI * radius
  const fontSize = Math.max(minFont, Math.min(maxFont, (arcLength * 0.92) / (text.length * LABEL_CHAR_EM)))
  return (
    <>
      <path id={id} d={arc} fill="none" stroke="none" />
      <text className={className} style={{ fontSize }}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </>
  )
}

export default TokenLabel
