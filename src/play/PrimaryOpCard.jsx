import { useId } from 'react'
import { primaryOpCard } from '../rules/cards.js'

// The primary op cards, drawn after the printed ones (they used to be 14MB photos):
// black PRIMARY OP bars at both ends, a red-orange banner with the op's name at the
// top and again upside down at the bottom, each with a checker or stripe flourish,
// and two grey skulls facing each other in between (upside down on Kill and Tac op).
// Drawn on a 630 × 1100 card, the printed card's proportions.

const W = 630
const H = 1100
const BLACK = '#1d1d1d'
const ORANGE = '#e5481d'
const GREY = '#a9a9ab'
const PAPER = '#f3f2ee'
const FONT = "'DIN Condensed', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Arial Narrow', sans-serif"

// Per card: the name's printed width, which flourish ends the top banner (the bottom
// one has the other), and whether the skulls are upside down.
const DESIGN = {
  critOp: { name: 'CRIT OP', width: 360, top: 'checker', flipped: false },
  killOp: { name: 'KILL OP', width: 350, top: 'stripes', flipped: true },
  tacOp: { name: 'TAC OP', width: 325, top: 'stripes', flipped: true },
}

// Worn-print specks: the same scatter every time (a fixed seed per card).
const specks = (seed) => {
  let value = seed
  const next = () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
  return Array.from({ length: 46 }, () => ({ x: next() * W, y: 140 + next() * 820, r: 1.5 + next() * 4.5 }))
}

function Bar() {
  return (
    <g>
      <rect width={W} height={112} fill={BLACK} />
      <text x={W / 2} y={84} fill="#fff" fontFamily={FONT} fontWeight="700" fontSize="62" textAnchor="middle" textLength="250" lengthAdjust="spacingAndGlyphs">
        PRIMARY OP
      </text>
    </g>
  )
}

function Flourish({ kind }) {
  if (kind === 'checker') {
    // Squares that thin out towards the bottom of the banner.
    const squares = [
      [0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 3], [2, 4],
    ]
    return (
      <g fill={PAPER}>
        {squares.map(([col, row]) => (
          <rect key={`${col}-${row}`} x={522 + col * 26} y={140 + row * 26} width={26} height={26} />
        ))}
      </g>
    )
  }
  // Bold diagonal bands across the banner's end (clipped to the banner).
  return (
    <g fill={PAPER}>
      {[0, 1, 2].map((stripe) => {
        const x = 455 + stripe * 58
        return <polygon key={stripe} points={`${x},140 ${x + 30},140 ${x + 225},335 ${x + 195},335`} />
      })}
    </g>
  )
}

// clip: the id of a clip path the size of the banner.
function Banner({ name, width, flourish, clip }) {
  return (
    <g>
      <rect x={0} y={140} width={600} height={195} fill={ORANGE} />
      <g clipPath={`url(#${clip})`}>
        <Flourish kind={flourish} />
      </g>
      <text x={34} y={302} fill="#fff" fontFamily={FONT} fontWeight="700" fontSize="178" textLength={width} lengthAdjust="spacingAndGlyphs">
        {name}
      </text>
    </g>
  )
}

// A skull in profile, facing right, filling the left half of the card: the foreheads
// nearly meet in the middle and the gap between the faces widens towards the jaws.
// eye: 'bionic' (lens rings) or 'hollow' (a socket, with a lens ring further back).
function Skull({ eye }) {
  return (
    <g>
      <path
        fill={GREY}
        d="M0 330 L288 330 L302 384 L290 448 L262 478 L278 520 L250 560 L264 600 L250 664 L204 694 L120 704 L62 738 L0 738 Z"
      />
      {/* Teeth along the mouth. */}
      <path d="M150 628 H258" stroke={PAPER} strokeWidth="7" />
      {[166, 186, 206, 226, 246].map((x) => (
        <path key={x} d={`M${x} 628 V662`} stroke={PAPER} strokeWidth="6" />
      ))}
      {/* The mechanical arm sweeping in from the edge. */}
      <path d="M0 612 C48 572 104 588 132 640 L150 700" fill="none" stroke={PAPER} strokeWidth="13" />
      {eye === 'bionic' ? (
        <g fill="none" stroke={PAPER}>
          <circle cx={222} cy={492} r={44} strokeWidth="11" />
          <circle cx={222} cy={492} r={16} fill={PAPER} stroke="none" />
          <circle cx={196} cy={424} r={14} strokeWidth="7" />
        </g>
      ) : (
        <g>
          <path d="M196 470 C230 452 270 470 268 500 C266 530 228 538 204 520 C186 506 182 482 196 470 Z" fill={PAPER} />
          <circle cx={92} cy={590} r={36} fill="none" stroke={PAPER} strokeWidth="10" />
          <circle cx={92} cy={590} r={13} fill={PAPER} />
        </g>
      )}
    </g>
  )
}

function PrimaryOpCard({ category, className = '' }) {
  const clip = useId()
  const bannerClip = `${clip}-banner`
  const design = DESIGN[category]
  if (!design) return null
  const label = primaryOpCard({ category })?.label ?? design.name
  const bottomFlourish = design.top === 'checker' ? 'stripes' : 'checker'
  const seed = Object.keys(DESIGN).indexOf(category) + 7
  return (
    <svg className={`primary-op-card ${className}`.trim()} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Primary op: ${label}`}>
      <defs>
        <clipPath id={clip}>
          <rect width={W} height={H} rx={30} />
        </clipPath>
        <clipPath id={bannerClip}>
          <rect x={0} y={140} width={600} height={195} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={W} height={H} fill={PAPER} />
        <g transform={design.flipped ? `translate(0 ${H}) scale(1 -1)` : undefined}>
          <Skull eye="bionic" />
          <g transform={`translate(${W} 0) scale(-1 1)`}>
            <Skull eye="hollow" />
          </g>
        </g>
        <Banner name={design.name} width={design.width} flourish={design.top} clip={bannerClip} />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <Banner name={design.name} width={design.width} flourish={bottomFlourish} clip={bannerClip} />
        </g>
        <g fill={PAPER} opacity="0.85">
          {specks(seed).map((speck, index) => (
            <circle key={index} cx={speck.x} cy={speck.y} r={speck.r} />
          ))}
        </g>
        <Bar />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <Bar />
        </g>
      </g>
      <rect width={W} height={H} rx={30} fill="none" stroke="rgba(0, 0, 0, 0.35)" strokeWidth="3" />
    </svg>
  )
}

export default PrimaryOpCard
